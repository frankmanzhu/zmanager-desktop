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
    crate::platform::destination_identity(&path)
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
mod tests {
    use super::*;
    use std::panic::{AssertUnwindSafe, catch_unwind};
    use std::sync::atomic::{AtomicU64, Ordering};

    fn unique_path() -> PathBuf {
        static NEXT: AtomicU64 = AtomicU64::new(1);
        PathBuf::from(format!("/tmp/zmanager-destination-reservation-{}-{}.zip", std::process::id(), NEXT.fetch_add(1, Ordering::Relaxed)))
    }

    #[test]
    fn reservation_is_exclusive_until_guard_drops() {
        let path = unique_path();
        let first = try_reserve(path.clone()).expect("first reservation should succeed");
        assert!(try_reserve(path.clone()).is_none());
        drop(first);
        assert!(try_reserve(path).is_some());
    }

    #[test]
    fn reservation_releases_during_unwind() {
        let path = unique_path();
        let result = catch_unwind(AssertUnwindSafe(|| {
            let _reservation = try_reserve(path.clone()).expect("reservation should succeed");
            panic!("test panic");
        }));
        assert!(result.is_err());
        assert!(try_reserve(path).is_some());
    }
}
