use std::path::Path;

use crate::dto::SourceAttributeDto;
use zmanager_core::manifest::PermissionSnapshot;

pub(crate) struct SourcePlatformMetadata {
    pub attributes: Option<Vec<SourceAttributeDto>>,
    pub uid: Option<u32>,
    pub gid: Option<u32>,
    pub owner: Option<String>,
    pub group: Option<String>,
}

pub(crate) fn source_table_column_ids() -> &'static [&'static str] {
    #[cfg(target_os = "windows")]
    {
        &["attributes"]
    }
    #[cfg(target_os = "macos")]
    {
        &["attributes", "mode", "uid", "gid", "owner", "group"]
    }
    #[cfg(target_os = "linux")]
    {
        &["mode", "uid", "gid", "owner", "group"]
    }
}

pub(crate) fn source_platform_metadata(source_path: &Path, permissions: &PermissionSnapshot) -> SourcePlatformMetadata {
    let mut attributes = Vec::new();
    if permissions.readonly {
        attributes.push(SourceAttributeDto { namespace: "portable".into(), code: "readonly".into() });
    }

    append_native_attributes(source_path, &mut attributes);
    let (uid, gid, owner, group) = unix_identity(source_path);

    SourcePlatformMetadata { attributes: (!attributes.is_empty()).then_some(attributes), uid, gid, owner, group }
}

#[cfg(target_os = "macos")]
fn append_native_attributes(source_path: &Path, attributes: &mut Vec<SourceAttributeDto>) {
    use std::os::darwin::fs::MetadataExt;

    const FLAGS: &[(u32, &str)] = &[
        (libc::UF_NODUMP, "nodump"),
        (libc::UF_IMMUTABLE, "immutable"),
        (libc::UF_APPEND, "append-only"),
        (libc::UF_OPAQUE, "opaque"),
        (libc::UF_HIDDEN, "hidden"),
        (libc::SF_ARCHIVED, "archived"),
        (libc::SF_IMMUTABLE, "system-immutable"),
        (libc::SF_APPEND, "system-append"),
    ];

    if let Ok(metadata) = std::fs::symlink_metadata(source_path) {
        let flags = metadata.st_flags();
        for (mask, name) in FLAGS {
            if flags & mask != 0 {
                attributes.push(SourceAttributeDto { namespace: "bsd".into(), code: (*name).into() });
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn append_native_attributes(source_path: &Path, attributes: &mut Vec<SourceAttributeDto>) {
    use std::os::windows::fs::MetadataExt;

    const FLAGS: &[(u32, &str)] = &[
        (0x0000_0001, "readonly"),
        (0x0000_0002, "hidden"),
        (0x0000_0004, "system"),
        (0x0000_0040, "device"),
        (0x0000_0100, "temporary"),
        (0x0000_0200, "sparse"),
        (0x0000_0400, "reparse"),
        (0x0000_0800, "compressed"),
        (0x0000_1000, "offline"),
        (0x0000_4000, "encrypted"),
    ];

    if let Ok(metadata) = std::fs::symlink_metadata(source_path) {
        let value = metadata.file_attributes();
        for (mask, name) in FLAGS {
            if value & mask != 0 {
                attributes.push(SourceAttributeDto { namespace: "windows".into(), code: (*name).into() });
            }
        }
    }
}

#[cfg(target_os = "linux")]
fn append_native_attributes(_source_path: &Path, _attributes: &mut Vec<SourceAttributeDto>) {}

#[cfg(unix)]
fn unix_identity(source_path: &Path) -> (Option<u32>, Option<u32>, Option<String>, Option<String>) {
    use std::os::unix::fs::MetadataExt;

    let Ok(metadata) = std::fs::symlink_metadata(source_path) else {
        return (None, None, None, None);
    };
    let uid = metadata.uid();
    let gid = metadata.gid();
    (Some(uid), Some(gid), resolve_user_name(uid), resolve_group_name(gid))
}

#[cfg(windows)]
fn unix_identity(_source_path: &Path) -> (Option<u32>, Option<u32>, Option<String>, Option<String>) {
    (None, None, None, None)
}

#[cfg(unix)]
fn resolve_user_name(uid: u32) -> Option<String> {
    let mut buffer = vec![0u8; 16_384];
    let mut password: libc::passwd = unsafe { std::mem::zeroed() };
    let mut result: *mut libc::passwd = std::ptr::null_mut();
    let status = unsafe { libc::getpwuid_r(uid, &mut password, buffer.as_mut_ptr().cast(), buffer.len(), &mut result) };
    if status != 0 || result.is_null() {
        return None;
    }
    unsafe { std::ffi::CStr::from_ptr(password.pw_name) }.to_str().ok().map(str::to_owned)
}

#[cfg(unix)]
fn resolve_group_name(gid: u32) -> Option<String> {
    let mut buffer = vec![0u8; 16_384];
    let mut group: libc::group = unsafe { std::mem::zeroed() };
    let mut result: *mut libc::group = std::ptr::null_mut();
    let status = unsafe { libc::getgrgid_r(gid, &mut group, buffer.as_mut_ptr().cast(), buffer.len(), &mut result) };
    if status != 0 || result.is_null() {
        return None;
    }
    unsafe { std::ffi::CStr::from_ptr(group.gr_name) }.to_str().ok().map(str::to_owned)
}
