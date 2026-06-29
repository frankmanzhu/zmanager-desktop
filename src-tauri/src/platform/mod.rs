#[cfg(target_os = "windows")]
mod windows;

#[cfg(not(target_os = "windows"))]
mod linux;

use std::io::Write;
use std::sync::Arc;

pub struct PlatformProfile {
    pub platform: &'static str,
    pub explorer_integration_enabled: bool,
    pub desktop_actions_enabled: bool,
    pub associated_extensions: Vec<String>,
    pub shell_actions: &'static [ShellActionProfile],
}

pub struct ShellActionProfile {
    pub label: &'static str,
    pub quick_action: &'static str,
}

#[derive(Clone, Debug)]
pub struct NativeFileDragItem {
    pub entry_path: String,
    pub display_path: String,
    pub size: Option<u64>,
    #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
    pub modified_unix_seconds: Option<u64>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NativeFileDragOutcome {
    Dropped,
    #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
    Cancelled,
    NoDrop,
}

pub type NativeFileDragStreamProvider =
    Arc<dyn Fn(&str, &mut dyn Write) -> Result<u64, NativeFileDragError> + Send + Sync>;

#[derive(Debug)]
pub struct NativeFileDragError {
    pub message: String,
    pub hint: Option<String>,
}

impl NativeFileDragError {
    pub fn new(message: impl Into<String>, hint: Option<impl Into<String>>) -> Self {
        Self {
            message: message.into(),
            hint: hint.map(Into::into),
        }
    }
}

#[cfg(target_os = "windows")]
pub use windows::register_platform_services;

#[cfg(not(target_os = "windows"))]
pub use linux::register_platform_services;

#[cfg(target_os = "windows")]
pub use windows::system_file_icons;

#[cfg(not(target_os = "windows"))]
pub use linux::system_file_icons;

#[cfg(target_os = "windows")]
pub use windows::start_native_file_drag;

#[cfg(not(target_os = "windows"))]
pub use linux::start_native_file_drag;

#[cfg(not(target_os = "windows"))]
pub use linux::prepare_native_file_drag_uris;

#[cfg(not(target_os = "windows"))]
pub use linux::clear_prepared_native_file_drag;

#[cfg(target_os = "windows")]
pub fn integration_profile() -> PlatformProfile {
    PlatformProfile {
        platform: windows::PLATFORM_NAME,
        explorer_integration_enabled: windows::is_explorer_integration_enabled(),
        desktop_actions_enabled: windows::is_desktop_actions_enabled(),
        associated_extensions: windows::associated_extensions(),
        shell_actions: windows::shell_actions(),
    }
}

#[cfg(not(target_os = "windows"))]
pub fn integration_profile() -> PlatformProfile {
    PlatformProfile {
        platform: linux::PLATFORM_NAME,
        explorer_integration_enabled: linux::is_explorer_integration_enabled(),
        desktop_actions_enabled: linux::is_desktop_actions_enabled(),
        associated_extensions: linux::associated_extensions(),
        shell_actions: linux::shell_actions(),
    }
}
