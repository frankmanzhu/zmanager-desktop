use tauri::{Builder, Wry};

/// Windows-specific shell integration placeholder.
/// Keep Explorer integration here while command features remain platform-neutral.
pub fn register_platform_services(builder: Builder<Wry>) -> Builder<Wry> {
    builder
}
