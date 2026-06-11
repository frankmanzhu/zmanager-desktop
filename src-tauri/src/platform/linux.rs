use tauri::{Builder, Wry};

/// Linux-specific shell integration placeholder.
/// Keep MIME/desktop registration and file-manager behavior here.
pub fn register_platform_services(builder: Builder<Wry>) -> Builder<Wry> {
    builder
}
