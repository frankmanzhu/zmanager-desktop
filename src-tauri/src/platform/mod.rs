#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "linux")]
mod linux;

#[cfg(not(any(target_os = "windows", target_os = "linux")))]
compile_error!("ZManager Desktop requires a NativePlatform adapter for this operating system");

use std::io::Write;
use std::sync::Arc;
use tauri::{Builder, Wry};

use crate::dto::{SystemFileIconDto, SystemFileIconRequestEntry};

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

/// Complete native capability interface for a supported Desktop Shell platform.
///
/// Adding another operating system requires an adapter that implements every
/// method here before it can become the active platform.
pub(crate) trait NativePlatform {
    fn register_services(builder: Builder<Wry>) -> Builder<Wry>;
    fn integration_profile() -> PlatformProfile;
    fn system_file_icons(entries: &[SystemFileIconRequestEntry]) -> Vec<SystemFileIconDto>;
    fn start_native_file_drag(
        items: &[NativeFileDragItem],
        stream_provider: NativeFileDragStreamProvider,
    ) -> Result<NativeFileDragOutcome, NativeFileDragError>;
}

#[cfg(target_os = "windows")]
type ActivePlatform = windows::WindowsPlatform;

#[cfg(target_os = "linux")]
type ActivePlatform = linux::LinuxPlatform;

pub fn register_platform_services(builder: Builder<Wry>) -> Builder<Wry> {
    ActivePlatform::register_services(builder)
}

pub fn integration_profile() -> PlatformProfile {
    ActivePlatform::integration_profile()
}

pub fn system_file_icons(entries: &[SystemFileIconRequestEntry]) -> Vec<SystemFileIconDto> {
    ActivePlatform::system_file_icons(entries)
}

pub fn start_native_file_drag(
    items: &[NativeFileDragItem],
    stream_provider: NativeFileDragStreamProvider,
) -> Result<NativeFileDragOutcome, NativeFileDragError> {
    ActivePlatform::start_native_file_drag(items, stream_provider)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn active_platform_satisfies_the_complete_native_interface() {
        fn assert_native_platform<T: NativePlatform>() {}

        assert_native_platform::<ActivePlatform>();
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_profile_preserves_its_integration_capabilities() {
        let profile = integration_profile();

        assert_eq!(profile.platform, "windows");
        assert!(profile.explorer_integration_enabled);
        assert!(!profile.desktop_actions_enabled);
        assert!(!profile.associated_extensions.is_empty());
        assert!(!profile.shell_actions.is_empty());
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_profile_preserves_its_integration_capabilities() {
        let profile = integration_profile();

        assert_eq!(profile.platform, "linux");
        assert!(!profile.explorer_integration_enabled);
        assert!(profile.desktop_actions_enabled);
        assert!(!profile.associated_extensions.is_empty());
        assert!(!profile.shell_actions.is_empty());
    }
}
