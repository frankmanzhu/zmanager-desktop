use tauri::{Builder, Wry};

/// Windows-specific shell integration profile values.
pub const PLATFORM_NAME: &str = "windows";
pub const EXPLORER_ACTIONS_ENABLED: bool = false;

/// Archive extensions that map to Windows shell associations when enabled.
pub const EXPLORER_ASSOCIATED_EXTENSIONS: &[&str] = &[
    "zip",
    "7z",
    "rar",
    "tar",
    "tzst",
    "tzap",
];

pub fn is_explorer_integration_enabled() -> bool {
    EXPLORER_ACTIONS_ENABLED
}

pub fn associated_extensions() -> &'static [&'static str] {
    EXPLORER_ASSOCIATED_EXTENSIONS
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
