use tauri::{Builder, Wry};

use super::{
    NativeFileDragError, NativeFileDragItem, NativeFileDragOutcome, NativeFileDragStreamProvider,
    ShellActionProfile,
};
use crate::dto::{SystemFileIconDto, SystemFileIconRequestEntry};

/// Linux-specific shell integration surface.
///
/// This module is intentionally isolated so MIME and desktop packaging concerns
/// stay platform-owned and out of command payload handling.
pub const PLATFORM_NAME: &str = "linux";
pub const DESKTOP_ACTIONS_ENABLED: bool = true;

pub const DESKTOP_SHELL_ACTIONS: &[ShellActionProfile] = &[
    ShellActionProfile {
        label: "Compress using ZManager",
        quick_action: "compress",
    },
    ShellActionProfile {
        label: "Extract using ZManager",
        quick_action: "extract",
    },
];

pub fn is_desktop_actions_enabled() -> bool {
    DESKTOP_ACTIONS_ENABLED
}

pub fn associated_extensions() -> Vec<String> {
    crate::archive_file_types::associated_extensions()
}

pub fn shell_actions() -> &'static [ShellActionProfile] {
    DESKTOP_SHELL_ACTIONS
}

pub fn is_explorer_integration_enabled() -> bool {
    false
}

pub fn register_platform_services(builder: Builder<Wry>) -> Builder<Wry> {
    if is_desktop_actions_enabled() {
        let _ = associated_extensions();
    }

    builder
}

pub fn system_file_icons(entries: &[SystemFileIconRequestEntry]) -> Vec<SystemFileIconDto> {
    entries
        .iter()
        .map(|entry| SystemFileIconDto {
            key: entry.key.clone(),
            data_url: None,
        })
        .collect()
}

pub fn start_native_file_drag(
    _items: &[NativeFileDragItem],
    _stream_provider: NativeFileDragStreamProvider,
) -> Result<NativeFileDragOutcome, NativeFileDragError> {
    Err(NativeFileDragError::new(
        "Native drag-out is not implemented for Linux yet.",
        Some("Use Extract... while the Linux XDND/file-manager drag source is added."),
    ))
}
