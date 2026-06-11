use tauri::{Builder, Wry};

/// Linux-specific shell integration surface.
///
/// This module is intentionally isolated so MIME and desktop packaging concerns
/// stay platform-owned and out of command payload handling.
pub const PLATFORM_NAME: &str = "linux";
pub const DESKTOP_ACTIONS_ENABLED: bool = false;

/// Reserved MIME-like extension mapping to support future `.desktop` and MIME metadata.
pub const DESKTOP_ASSOCIATED_EXTENSIONS: &[&str] = &[
    "zip",
    "7z",
    "rar",
    "tar",
    "tzst",
    "tzap",
];

pub fn is_desktop_actions_enabled() -> bool {
    DESKTOP_ACTIONS_ENABLED
}

pub fn associated_extensions() -> &'static [&'static str] {
    DESKTOP_ASSOCIATED_EXTENSIONS
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
