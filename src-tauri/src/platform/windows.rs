use tauri::{Builder, Wry};

use super::ShellActionProfile;

/// Windows-specific shell integration profile values.
pub const PLATFORM_NAME: &str = "windows";
pub const EXPLORER_ACTIONS_ENABLED: bool = true;

/// Archive extensions that map to Windows shell associations when enabled.
pub const EXPLORER_ASSOCIATED_EXTENSIONS: &[&str] = &[
    "zip", "zipx", "7z", "rar", "tar", "tar.gz", "tgz", "gz", "tar.xz", "txz", "xz", "tar.zst",
    "tzst", "zst", "tzap",
];

pub const EXPLORER_SHELL_ACTIONS: &[ShellActionProfile] = &[
    ShellActionProfile {
        label: "Compress using ZManager",
        quick_action: "compress",
    },
    ShellActionProfile {
        label: "Extract using ZManager",
        quick_action: "extract",
    },
];

pub fn is_explorer_integration_enabled() -> bool {
    EXPLORER_ACTIONS_ENABLED
}

pub fn associated_extensions() -> &'static [&'static str] {
    EXPLORER_ASSOCIATED_EXTENSIONS
}

pub fn shell_actions() -> &'static [ShellActionProfile] {
    EXPLORER_SHELL_ACTIONS
}

pub fn is_desktop_actions_enabled() -> bool {
    // Windows integration profile currently reserves explorer actions only.
    false
}

pub fn register_platform_services(builder: Builder<Wry>) -> Builder<Wry> {
    if is_explorer_integration_enabled() {
        let _ = associated_extensions();
    }

    builder
}
