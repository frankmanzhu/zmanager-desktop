use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

static RESERVED_DESTINATIONS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

fn reservations() -> &'static Mutex<HashSet<String>> {
    RESERVED_DESTINATIONS.get_or_init(|| Mutex::new(HashSet::new()))
}

fn identity(path: &Path) -> String {
    let path = if let Some(parent) = path.parent() {
        let normalized_parent = parent.canonicalize().unwrap_or_else(|_| parent.to_path_buf());
        normalized_parent.join(path.file_name().unwrap_or_else(|| std::ffi::OsStr::new("")))
    } else {
        path.to_path_buf()
    };
    let value = path.to_string_lossy().replace('\\', "/");
    if cfg!(windows) { value.to_lowercase() } else { value }
}

#[derive(Debug)]
pub(crate) struct DestinationReservation {
    key: String,
    path: PathBuf,
}

impl DestinationReservation {
    pub(crate) fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for DestinationReservation {
    fn drop(&mut self) {
        if let Ok(mut reserved) = reservations().lock() {
            reserved.remove(&self.key);
        }
    }
}

pub(crate) fn try_reserve(path: impl Into<PathBuf>) -> Option<DestinationReservation> {
    let path = path.into();
    let key = identity(&path);
    let mut reserved = reservations().lock().ok()?;
    if !reserved.insert(key.clone()) {
        return None;
    }
    Some(DestinationReservation { key, path })
}

#[cfg(test)]
pub(crate) fn is_reserved(path: &Path) -> bool {
    reservations().lock().unwrap().contains(&identity(path))
}
