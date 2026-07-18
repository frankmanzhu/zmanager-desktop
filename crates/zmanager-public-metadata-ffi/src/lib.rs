use std::ffi::{CStr, CString, c_char};
use std::fs;
use std::path::PathBuf;

use serde_json::json;
use zmanager_core::tzap_backend::TzapX509TrustOptions;

const ABI_VERSION: u32 = 1;
const MAX_PATH_BYTES: usize = 4096;
const MAX_ARCHIVE_BYTES: u64 = 1 << 40;
const MAX_SIGNATURE_INSPECTION_BYTES: u64 = 256 << 20;

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
    match fs::symlink_metadata(&path) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            return error("invalid_path", "Archive path must not be a symbolic link.");
        }
        Ok(metadata) if !metadata.is_file() => {
            return error("invalid_path", "Archive path is not a regular file.");
        }
        Ok(metadata) if metadata.len() > MAX_ARCHIVE_BYTES => {
            return error(
                "archive_too_large",
                "Archive exceeds the metadata inspection limit.",
            );
        }
        Err(_) => return error("metadata_failed", "Archive metadata could not be read."),
        _ => {}
    }

    match zmanager_core::tzap_backend::summarize_tzap_public_metadata(&path) {
        Ok(summary) => {
            let format = &summary.format;
            let signature = if summary.total_size > MAX_SIGNATURE_INSPECTION_BYTES {
                json!({
                    "status": "unavailable",
                    "message": "Signature inspection was skipped because the volume set exceeds the preview limit."
                })
            } else {
                signature_json(&path)
            };
            json!({
                "ok": true,
                "metadata": {
                "expected_volume_count": summary.expected_volume_count,
                "present_volume_count": summary.present_volume_count,
                "missing_volume_indices": summary.missing_volume_indices,
                "total_size": summary.total_size,
                "expected_volume_size": summary.expected_volume_size,
                    "format": {
                        "format_version": format.format_version,
                        "volume_format_revision": format.volume_format_revision,
                        "archive_uuid": hex_lower(&format.archive_uuid),
                        "session_id": hex_lower(&format.session_id),
                        "compression_algorithm": format.compression_algorithm,
                        "encryption_algorithm": format.encryption_algorithm,
                        "recovery_algorithm": format.recovery_algorithm,
                        "key_derivation": format.key_derivation,
                        "password_required": format.password_required,
                        "bit_rot_buffer_percentage": format.bit_rot_buffer_percentage,
                        "volume_loss_tolerance": format.volume_loss_tolerance,
                        "data_shard_count": format.data_shard_count,
                        "parity_shard_count": format.parity_shard_count,
                        "index_data_shard_count": format.index_data_shard_count,
                        "index_parity_shard_count": format.index_parity_shard_count,
                        "index_root_data_shard_count": format.index_root_data_shard_count,
                        "index_root_parity_shard_count": format.index_root_parity_shard_count,
                        "block_size": format.block_size,
                        "chunk_size": format.chunk_size,
                        "envelope_target_size": format.envelope_target_size,
                        "has_dictionary": format.has_dictionary
                    }
                },
                "signature": signature
            })
        }
        Err(_) => error(
            "invalid_metadata",
            "This does not look like a valid TZAP archive.",
        ),
    }
}

fn signature_json(path: &std::path::Path) -> serde_json::Value {
    match zmanager_core::tzap_backend::verify_tzap_x509_public_no_key(
        path,
        &TzapX509TrustOptions {
            trusted_ca_certificates: Vec::new(),
            trusted_system_roots: true,
            include_official_tzap_root: true,
        },
    ) {
        Ok(report) => json!({
            "status": "verified",
            "verification_mode": "public-no-key",
            "root_auth": {
                "signature_verified": true,
                "trust_validated": true,
                "subject": report.subject,
                "issuer": report.issuer,
                "serial_number": report.serial_number_hex,
                "certificate_sha256": hex_lower(&report.certificate_sha256),
                "signed_at_unix_seconds": report.signed_at_unix_seconds,
                "verified_chain_subjects": report.verified_chain_subjects,
                "trust_anchor_subject": report.trust_anchor_subject,
                "total_data_block_count": report.total_data_block_count
            }
        }),
        Err(_) => match zmanager_core::tzap_backend::inspect_tzap_x509_public_no_key_signer(path) {
            Ok(report) => json!({
                "status": "unverified",
                "verification_mode": "public-no-key-inspection",
                "message": "The embedded signer certificate is valid, but system trust was not established.",
                "root_auth": {
                    "signature_verified": true,
                    "trust_validated": false,
                    "subject": report.subject,
                    "issuer": report.issuer,
                    "serial_number": report.serial_number_hex,
                    "certificate_sha256": hex_lower(&report.certificate_sha256),
                    "signed_at_unix_seconds": report.signed_at_unix_seconds,
                    "verified_chain_subjects": [],
                    "trust_anchor_subject": null,
                    "total_data_block_count": report.total_data_block_count
                }
            }),
            Err(_) => json!({
                "status": "unavailable",
                "message": "No public signer certificate is available."
            }),
        },
    }
}

fn hex_lower(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
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
