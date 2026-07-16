use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write as _;
use std::path::{Component, Path};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use crate::platform::{NativeFileDragError, NativeFileDragItem, NativeFileDragStreamProvider};

const MAX_SESSIONS: usize = 16;
const SESSION_TIMEOUT: Duration = Duration::from_secs(15 * 60);

#[derive(Clone)]
pub struct NativeDragSessionRegistry(Arc<Mutex<RegistryState>>);

struct RegistryState {
    next_id: u64,
    sessions: HashMap<String, DragSession>,
    shutdown: bool,
}

struct DragSession {
    items: HashMap<String, NativeFileDragItem>,
    stream_provider: NativeFileDragStreamProvider,
    created: Instant,
    completed: usize,
    cancelled: bool,
}

impl NativeDragSessionRegistry {
    pub fn new() -> Self {
        Self(Arc::new(Mutex::new(RegistryState {
            next_id: 1,
            sessions: HashMap::new(),
            shutdown: false,
        })))
    }

    pub fn create(
        &self,
        items: &[NativeFileDragItem],
        stream_provider: NativeFileDragStreamProvider,
    ) -> Result<String, NativeFileDragError> {
        if items.is_empty() {
            return Err(NativeFileDragError::invalid_request(
                "Native drag has no items",
            ));
        }
        let mut state = self.0.lock().expect("native drag registry lock poisoned");
        state.retain_live();
        if state.shutdown || state.sessions.len() >= MAX_SESSIONS {
            return Err(NativeFileDragError::new(
                "Native drag session capacity is unavailable",
                None::<String>,
            ));
        }
        let id = format!("drag-{}-{}", std::process::id(), state.next_id);
        state.next_id = state.next_id.saturating_add(1);
        state.sessions.insert(
            id.clone(),
            DragSession {
                items: items
                    .iter()
                    .cloned()
                    .map(|item| (item.entry_path.clone(), item))
                    .collect(),
                stream_provider,
                created: Instant::now(),
                completed: 0,
                cancelled: false,
            },
        );
        Ok(id)
    }

    pub fn write_item(
        &self,
        session_id: &str,
        entry_path: &str,
        destination: &Path,
    ) -> Result<u64, NativeFileDragError> {
        validate_destination(destination)?;
        let provider = {
            let state = self.0.lock().expect("native drag registry lock poisoned");
            let session = state.sessions.get(session_id).ok_or_else(|| {
                NativeFileDragError::invalid_request("Native drag session expired")
            })?;
            if session.cancelled || !session.items.contains_key(entry_path) {
                return Err(NativeFileDragError::invalid_request(
                    "Native drag item is unavailable",
                ));
            }
            Arc::clone(&session.stream_provider)
        };
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(io_drag_error)?;
        }
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(destination)
            .map_err(io_drag_error)?;
        let result = provider(entry_path, &mut file).and_then(|written| {
            file.flush().map_err(io_drag_error)?;
            Ok(written)
        });
        if result.is_err() {
            let _ = fs::remove_file(destination);
            return result;
        }
        let written = result?;
        let mut state = self.0.lock().expect("native drag registry lock poisoned");
        if let Some(session) = state.sessions.get_mut(session_id) {
            session.completed = session.completed.saturating_add(1);
            if session.completed >= session.items.len() {
                state.sessions.remove(session_id);
            }
        }
        Ok(written)
    }

    pub fn cancel(&self, session_id: &str) {
        self.0
            .lock()
            .expect("native drag registry lock poisoned")
            .sessions
            .remove(session_id);
    }

    pub fn shutdown(&self) {
        let mut state = self.0.lock().expect("native drag registry lock poisoned");
        state.shutdown = true;
        state.sessions.clear();
    }

    #[cfg(test)]
    fn count(&self) -> usize {
        self.0.lock().unwrap().sessions.len()
    }
}

impl RegistryState {
    fn retain_live(&mut self) {
        self.sessions
            .retain(|_, session| session.created.elapsed() <= SESSION_TIMEOUT);
    }
}

fn validate_destination(path: &Path) -> Result<(), NativeFileDragError> {
    if !path.is_absolute()
        || path
            .components()
            .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(NativeFileDragError::invalid_request(
            "Finder destination is invalid",
        ));
    }
    Ok(())
}

fn io_drag_error(error: std::io::Error) -> NativeFileDragError {
    NativeFileDragError::new(
        format!("Unable to write promised Finder item: {error}"),
        Some("Remove a conflicting item or choose another Finder destination."),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    fn item(path: &str) -> NativeFileDragItem {
        NativeFileDragItem {
            entry_path: path.to_string(),
            display_path: path.to_string(),
            size: Some(7),
            modified_unix_seconds: None,
        }
    }

    #[test]
    fn creates_descriptors_without_streaming_until_destination_arrives() {
        let calls = Arc::new(AtomicUsize::new(0));
        let observed = Arc::clone(&calls);
        let provider: NativeFileDragStreamProvider = Arc::new(move |_, writer| {
            observed.fetch_add(1, Ordering::SeqCst);
            writer.write_all(b"payload").unwrap();
            Ok(7)
        });
        let registry = NativeDragSessionRegistry::new();
        let id = registry.create(&[item("demo.txt")], provider).unwrap();
        assert_eq!(calls.load(Ordering::SeqCst), 0);
        let root = std::env::temp_dir().join(format!("zmanager-promise-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let destination = root.join("demo.txt");
        assert_eq!(
            registry.write_item(&id, "demo.txt", &destination).unwrap(),
            7
        );
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert_eq!(fs::read(&destination).unwrap(), b"payload");
        assert_eq!(registry.count(), 0);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn failure_cleans_partial_output_and_cancel_shutdown_are_idempotent() {
        let provider: NativeFileDragStreamProvider = Arc::new(move |_, writer| {
            writer.write_all(b"partial").unwrap();
            Err(NativeFileDragError::new("stream failed", None::<String>))
        });
        let registry = NativeDragSessionRegistry::new();
        let id = registry.create(&[item("bad.txt")], provider).unwrap();
        let destination = std::env::temp_dir().join(format!("zmanager-bad-{}", std::process::id()));
        let _ = fs::remove_file(&destination);
        assert!(registry.write_item(&id, "bad.txt", &destination).is_err());
        assert!(!destination.exists());
        registry.cancel(&id);
        registry.cancel(&id);
        registry.shutdown();
        registry.shutdown();
        assert_eq!(registry.count(), 0);
    }
}
