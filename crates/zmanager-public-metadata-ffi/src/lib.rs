use std::ffi::{CStr, CString, c_char};
use std::fs;
use std::path::PathBuf;

use serde_json::json;

const ABI_VERSION: u32 = 1;
const MAX_PATH_BYTES: usize = 4096;
const MAX_ARCHIVE_BYTES: u64 = 1 << 40;

#[unsafe(no_mangle)]
pub extern "C" fn zmanager_public_metadata_ffi_version() -> u32 {
    ABI_VERSION
}

/// Returns bounded public TZAP metadata as owned UTF-8 JSON.
///
/// The caller must release the result with
/// [`zmanager_public_metadata_string_free`]. The function reads public headers
/// only; it accepts no password, key, account, mutation, or job input.
///
/// # Safety
///
/// `archive_path` must be null or point to a valid NUL-terminated byte string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn zmanager_public_metadata_summary_json(
    archive_path: *const c_char,
) -> *mut c_char {
    let result = bounded_summary(archive_path);
    owned_json(result)
}

/// Releases a string returned by this ABI.
///
/// # Safety
///
/// `value` must be null or a pointer returned by this crate that has not
/// already been released.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn zmanager_public_metadata_string_free(value: *mut c_char) {
    if !value.is_null() {
        drop(unsafe { CString::from_raw(value) });
    }
}

fn bounded_summary(archive_path: *const c_char) -> serde_json::Value {
    if archive_path.is_null() {
        return error("invalid_path", "Archive path is required.");
    }
    let bytes = unsafe { CStr::from_ptr(archive_path) }.to_bytes();
    if bytes.len() > MAX_PATH_BYTES {
        return error("path_too_long", "Archive path exceeds the metadata limit.");
    }
    let Ok(path) = std::str::from_utf8(bytes) else {
        return error("invalid_path", "Archive path is not valid UTF-8.");
    };
    let path = PathBuf::from(path);
    match fs::metadata(&path) {
        Ok(metadata) if !metadata.is_file() => {
            return error("invalid_path", "Archive path is not a regular file.");
        }
        Ok(metadata) if metadata.len() > MAX_ARCHIVE_BYTES => {
            return error(
                "archive_too_large",
                "Archive exceeds the metadata inspection limit.",
            );
        }
        Err(source) => return error("metadata_failed", &source.to_string()),
        _ => {}
    }

    match zmanager_core::tzap_backend::summarize_tzap_public_metadata(&path) {
        Ok(summary) => json!({
            "ok": true,
            "metadata": {
                "expected_volume_count": summary.expected_volume_count,
                "present_volume_count": summary.present_volume_count,
                "missing_volume_indices": summary.missing_volume_indices,
                "total_size": summary.total_size,
                "expected_volume_size": summary.expected_volume_size,
                "format": {
                    "format_version": summary.format.format_version,
                    "volume_format_revision": summary.format.volume_format_revision,
                    "compression_algorithm": summary.format.compression_algorithm,
                    "encryption_algorithm": summary.format.encryption_algorithm,
                    "recovery_algorithm": summary.format.recovery_algorithm,
                    "key_derivation": summary.format.key_derivation,
                    "password_required": summary.format.password_required,
                    "bit_rot_buffer_percentage": summary.format.bit_rot_buffer_percentage,
                    "volume_loss_tolerance": summary.format.volume_loss_tolerance
                }
            }
        }),
        Err(source) => error("invalid_metadata", &source.to_string()),
    }
}

fn error(code: &str, message: &str) -> serde_json::Value {
    json!({ "ok": false, "code": code, "message": message })
}

fn owned_json(value: serde_json::Value) -> *mut c_char {
    CString::new(value.to_string())
        .expect("serialized metadata JSON cannot contain NUL")
        .into_raw()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Seek, SeekFrom, Write};

    fn call(path: &CStr) -> serde_json::Value {
        let pointer = unsafe { zmanager_public_metadata_summary_json(path.as_ptr()) };
        let value = unsafe { CStr::from_ptr(pointer) }
            .to_str()
            .expect("result should be UTF-8");
        let parsed = serde_json::from_str(value).expect("result should be JSON");
        unsafe { zmanager_public_metadata_string_free(pointer) };
        parsed
    }

    #[test]
    fn null_and_malformed_metadata_fail_safely() {
        let pointer = unsafe { zmanager_public_metadata_summary_json(std::ptr::null()) };
        let parsed: serde_json::Value =
            serde_json::from_str(unsafe { CStr::from_ptr(pointer) }.to_str().unwrap()).unwrap();
        unsafe { zmanager_public_metadata_string_free(pointer) };
        assert_eq!(parsed["code"], "invalid_path");

        let path =
            std::env::temp_dir().join(format!("zmanager-invalid-metadata-{}", std::process::id()));
        fs::write(&path, b"not a tzap").unwrap();
        let c_path = CString::new(path.to_str().unwrap()).unwrap();
        assert_eq!(call(&c_path)["code"], "invalid_metadata");
        fs::remove_file(path).unwrap();
    }

    #[test]
    fn oversized_sparse_fixture_fails_before_parsing() {
        let path = std::env::temp_dir().join(format!(
            "zmanager-oversized-metadata-{}",
            std::process::id()
        ));
        let mut file = fs::File::create(&path).unwrap();
        file.seek(SeekFrom::Start(MAX_ARCHIVE_BYTES)).unwrap();
        file.write_all(&[0]).unwrap();
        let c_path = CString::new(path.to_str().unwrap()).unwrap();
        assert_eq!(call(&c_path)["code"], "archive_too_large");
        fs::remove_file(path).unwrap();
    }
}
