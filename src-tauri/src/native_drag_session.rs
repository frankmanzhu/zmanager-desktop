use std::collections::{HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io::Write as _;
use std::path::{Component, Path};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use unicode_normalization::UnicodeNormalization;

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
    promises: HashMap<String, Vec<NativeFileDragItem>>,
    stream_provider: NativeFileDragStreamProvider,
    created: Instant,
    completed: HashSet<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NativeFilePromiseDescriptor {
    pub promise_path: String,
    pub promised_name: String,
    pub is_directory: bool,
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
        let promises = group_promises(items)?;
        state.sessions.insert(
            id.clone(),
            DragSession {
                promises,
                stream_provider,
                created: Instant::now(),
                completed: HashSet::new(),
            },
        );
        Ok(id)
    }

    pub fn descriptors(
        items: &[NativeFileDragItem],
    ) -> Result<Vec<NativeFilePromiseDescriptor>, NativeFileDragError> {
        let promises = group_promises(items)?;
        let mut descriptors = promises
            .into_iter()
            .map(|(promise_path, members)| NativeFilePromiseDescriptor {
                promised_name: promise_path.clone(),
                is_directory: members
                    .iter()
                    .any(|member| member.display_path != promise_path),
                promise_path,
            })
            .collect::<Vec<_>>();
        descriptors.sort_by(|left, right| left.promise_path.cmp(&right.promise_path));
        Ok(descriptors)
    }

    pub fn write_promise(
        &self,
        session_id: &str,
        promise_path: &str,
        destination: &Path,
    ) -> Result<u64, NativeFileDragError> {
        validate_destination(destination)?;
        let (members, provider) = {
            let state = self.0.lock().expect("native drag registry lock poisoned");
            let session = state.sessions.get(session_id).ok_or_else(|| {
                NativeFileDragError::invalid_request("Native drag session expired")
            })?;
            let Some(members) = session.promises.get(promise_path) else {
                return Err(NativeFileDragError::invalid_request(
                    "Native drag item is unavailable",
                ));
            };
            if session.completed.contains(promise_path) {
                return Err(NativeFileDragError::invalid_request(
                    "Native drag item was already written",
                ));
            }
            (members.clone(), Arc::clone(&session.stream_provider))
        };

        let is_directory = members
            .iter()
            .any(|member| member.display_path != promise_path);
        let result = if is_directory {
            write_directory_promise(destination, promise_path, &members, &provider)
        } else {
            write_file_promise(destination, &members[0].entry_path, &provider)
        };
        let written = result?;

        let mut state = self.0.lock().expect("native drag registry lock poisoned");
        if let Some(session) = state.sessions.get_mut(session_id) {
            session.completed.insert(promise_path.to_string());
            if session.completed.len() >= session.promises.len() {
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

fn group_promises(
    items: &[NativeFileDragItem],
) -> Result<HashMap<String, Vec<NativeFileDragItem>>, NativeFileDragError> {
    let mut normalized_promises =
        HashMap::<String, (String, Vec<NativeFileDragItem>)>::new();
    for item in items {
        let mut components = item.display_path.split('/').filter(|part| !part.is_empty());
        let Some(root) = components.next() else {
            return Err(NativeFileDragError::invalid_request(
                "Native drag item has no promised name",
            ));
        };
        if root == "." || root == ".." || root.as_bytes().len() > 255 {
            return Err(NativeFileDragError::invalid_request(
                "Native drag item has an invalid promised name",
            ));
        }
        let collision_key = root.nfd().flat_map(char::to_lowercase).collect::<String>();
        let promise = normalized_promises
            .entry(collision_key)
            .or_insert_with(|| (root.to_string(), Vec::new()));
        if promise.0 != root {
            return Err(NativeFileDragError::invalid_request(format!(
                "promised top-level names collide on macOS: {} and {root}",
                promise.0
            )));
        }
        promise.1.push(item.clone());
    }
    if normalized_promises.is_empty() {
        return Err(NativeFileDragError::invalid_request(
            "Native drag has no promises",
        ));
    }
    let mut promises = HashMap::new();
    for (_, (root, members)) in normalized_promises {
        if members.len() > 1 && members.iter().any(|member| member.display_path == root) {
            return Err(NativeFileDragError::invalid_request(format!(
                "promised name is both a file and directory: {root}"
            )));
        }
        promises.insert(root, members);
    }
    Ok(promises)
}

fn write_directory_promise(
    destination: &Path,
    promise_path: &str,
    members: &[NativeFileDragItem],
    provider: &NativeFileDragStreamProvider,
) -> Result<u64, NativeFileDragError> {
    fs::create_dir(destination).map_err(io_drag_error)?;
    let result = (|| {
        let mut total = 0_u64;
        for member in members {
            let relative = member
                .display_path
                .strip_prefix(promise_path)
                .and_then(|path| path.strip_prefix('/'))
                .ok_or_else(|| {
                    NativeFileDragError::invalid_request("Invalid promised directory member")
                })?;
            let relative_path = Path::new(relative);
            if relative_path.as_os_str().is_empty()
                || relative_path.is_absolute()
                || relative_path
                    .components()
                    .any(|part| matches!(part, Component::ParentDir))
            {
                return Err(NativeFileDragError::invalid_request(
                    "Invalid promised directory member",
                ));
            }
            total = total.saturating_add(write_file_promise(
                &destination.join(relative_path),
                &member.entry_path,
                provider,
            )?);
        }
        Ok(total)
    })();
    if result.is_err() {
        let _ = fs::remove_dir_all(destination);
    }
    result
}

fn write_file_promise(
    destination: &Path,
    entry_path: &str,
    provider: &NativeFileDragStreamProvider,
) -> Result<u64, NativeFileDragError> {
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
    }
    result
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
            registry
                .write_promise(&id, "demo.txt", &destination)
                .unwrap(),
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
        assert!(
            registry
                .write_promise(&id, "bad.txt", &destination)
                .is_err()
        );
        assert!(!destination.exists());
        registry.cancel(&id);
        registry.cancel(&id);
        registry.shutdown();
        registry.shutdown();
        assert_eq!(registry.count(), 0);
    }

    #[test]
    fn groups_nested_members_into_one_top_level_directory_promise() {
        let calls = Arc::new(Mutex::new(Vec::<String>::new()));
        let observed = Arc::clone(&calls);
        let provider: NativeFileDragStreamProvider = Arc::new(move |entry, writer| {
            observed.lock().unwrap().push(entry.to_string());
            writer.write_all(entry.as_bytes()).unwrap();
            Ok(entry.len() as u64)
        });
        let items = vec![item("docs/a.txt"), item("docs/nested/b.txt")];
        let descriptors = NativeDragSessionRegistry::descriptors(&items).unwrap();
        assert_eq!(
            descriptors,
            vec![NativeFilePromiseDescriptor {
                promise_path: "docs".to_string(),
                promised_name: "docs".to_string(),
                is_directory: true,
            }]
        );
        let registry = NativeDragSessionRegistry::new();
        let id = registry.create(&items, provider).unwrap();
        let root =
            std::env::temp_dir().join(format!("zmanager-promise-dir-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        assert!(registry.write_promise(&id, "docs", &root).is_ok());
        assert_eq!(fs::read(root.join("a.txt")).unwrap(), b"docs/a.txt");
        assert_eq!(
            fs::read(root.join("nested/b.txt")).unwrap(),
            b"docs/nested/b.txt"
        );
        assert_eq!(calls.lock().unwrap().len(), 2);
        assert_eq!(registry.count(), 0);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_case_and_unicode_equivalent_top_level_names() {
        let provider: NativeFileDragStreamProvider = Arc::new(|_, _| Ok(0));
        let registry = NativeDragSessionRegistry::new();
        assert!(
            registry
                .create(&[item("Docs/a.txt"), item("docs/b.txt")], Arc::clone(&provider))
                .is_err()
        );
        assert!(
            registry
                .create(&[item("Café/a.txt"), item("Cafe\u{301}/b.txt")], provider)
                .is_err()
        );
    }

    #[test]
    fn destination_conflicts_are_not_overwritten_or_deleted() {
        let provider: NativeFileDragStreamProvider = Arc::new(|_, writer| {
            writer.write_all(b"replacement").unwrap();
            Ok(11)
        });
        let registry = NativeDragSessionRegistry::new();
        let root = std::env::temp_dir().join(format!(
            "zmanager-promise-conflict-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let destination = root.join("existing.txt");
        fs::write(&destination, b"original").unwrap();
        let id = registry.create(&[item("existing.txt")], provider).unwrap();
        assert!(
            registry
                .write_promise(&id, "existing.txt", &destination)
                .is_err()
        );
        assert_eq!(fs::read(&destination).unwrap(), b"original");
        registry.cancel(&id);
        let _ = fs::remove_dir_all(root);
    }
}
