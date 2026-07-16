#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "linux")]
mod linux;

#[cfg(target_os = "macos")]
mod macos;

#[cfg(any(target_os = "linux", target_os = "macos"))]
mod staged_file_drag;

#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
mod windows_drag_path;

#[cfg(not(any(target_os = "windows", target_os = "linux", target_os = "macos")))]
compile_error!("ZManager Desktop requires a NativePlatform adapter for this operating system");

use std::io::Write;
use std::sync::Arc;
use tauri::{Builder, Wry};

use crate::dto::{SystemFileIconDto, SystemFileIconRequestEntry};
use crate::native_launch_inbox::NativeLaunchInbox;

pub struct PlatformProfile {
    pub platform: &'static str,
    pub selected_item_actions_enabled: bool,
    pub background_actions_enabled: bool,
    pub file_associations_enabled: bool,
    pub window_decorations: bool,
    pub custom_window_chrome: bool,
    pub manual_window_resize: bool,
    pub associated_extensions: Vec<String>,
    pub shell_actions: &'static [ShellActionProfile],
}

pub struct ShellActionProfile {
    pub label: &'static str,
    pub quick_action: &'static str,
}

#[derive(Clone, Debug)]
pub struct NativeFileDragCandidate {
    pub entry_path: String,
    pub size: Option<u64>,
    pub modified_unix_seconds: Option<u64>,
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
    #[cfg_attr(target_os = "macos", allow(dead_code))]
    NoDrop,
}

pub type NativeFileDragStreamProvider =
    Arc<dyn Fn(&str, &mut dyn Write) -> Result<u64, NativeFileDragError> + Send + Sync>;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NativeFileDragErrorKind {
    InvalidRequest,
    UnsafeArchive,
    OperationFailed,
}

#[derive(Debug)]
pub struct NativeFileDragError {
    pub kind: NativeFileDragErrorKind,
    pub message: String,
    pub hint: Option<String>,
}

impl NativeFileDragError {
    pub fn new(message: impl Into<String>, hint: Option<impl Into<String>>) -> Self {
        Self {
            kind: NativeFileDragErrorKind::OperationFailed,
            message: message.into(),
            hint: hint.map(Into::into),
        }
    }

    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self {
            kind: NativeFileDragErrorKind::InvalidRequest,
            message: message.into(),
            hint: None,
        }
    }

    pub fn unsafe_archive(message: impl Into<String>) -> Self {
        Self {
            kind: NativeFileDragErrorKind::UnsafeArchive,
            message: message.into(),
            hint: None,
        }
    }
}

/// Complete native capability interface for a supported Desktop Shell platform.
///
/// Adding another operating system requires an adapter that implements every
/// method here before it can become the active platform.
pub(crate) trait NativePlatform {
    fn initialize_native_host(inbox: NativeLaunchInbox) -> Result<(), String>;
    fn register_services(builder: Builder<Wry>) -> Builder<Wry>;
    fn integration_profile() -> PlatformProfile;
    fn configure_main_window(window: &tauri::WebviewWindow<Wry>) -> Result<(), tauri::Error>;
    fn system_file_icons(entries: &[SystemFileIconRequestEntry]) -> Vec<SystemFileIconDto>;
    fn prepare_native_file_drag(
        candidates: &[NativeFileDragCandidate],
        strip_components: usize,
    ) -> Result<Vec<NativeFileDragItem>, NativeFileDragError>;
    fn start_native_file_drag(
        window: &tauri::WebviewWindow<Wry>,
        items: &[NativeFileDragItem],
        stream_provider: NativeFileDragStreamProvider,
    ) -> Result<NativeFileDragOutcome, NativeFileDragError>;
    fn shutdown();
}

#[cfg(target_os = "windows")]
type ActivePlatform = windows::WindowsPlatform;

#[cfg(target_os = "linux")]
type ActivePlatform = linux::LinuxPlatform;

#[cfg(target_os = "macos")]
type ActivePlatform = macos::MacOsPlatform;

pub fn register_platform_services(builder: Builder<Wry>) -> Builder<Wry> {
    ActivePlatform::register_services(builder)
}

pub fn initialize_native_host(inbox: NativeLaunchInbox) -> Result<(), String> {
    ActivePlatform::initialize_native_host(inbox)
}

pub fn integration_profile() -> PlatformProfile {
    ActivePlatform::integration_profile()
}

pub fn configure_main_window(window: &tauri::WebviewWindow<Wry>) -> Result<(), tauri::Error> {
    ActivePlatform::configure_main_window(window)
}

pub fn system_file_icons(entries: &[SystemFileIconRequestEntry]) -> Vec<SystemFileIconDto> {
    ActivePlatform::system_file_icons(entries)
}

pub fn prepare_native_file_drag(
    candidates: &[NativeFileDragCandidate],
    strip_components: usize,
) -> Result<Vec<NativeFileDragItem>, NativeFileDragError> {
    ActivePlatform::prepare_native_file_drag(candidates, strip_components)
}

pub fn start_native_file_drag(
    window: &tauri::WebviewWindow<Wry>,
    items: &[NativeFileDragItem],
    stream_provider: NativeFileDragStreamProvider,
) -> Result<NativeFileDragOutcome, NativeFileDragError> {
    ActivePlatform::start_native_file_drag(window, items, stream_provider)
}

pub fn shutdown() {
    ActivePlatform::shutdown();
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
        assert!(profile.selected_item_actions_enabled);
        assert!(profile.background_actions_enabled);
        assert!(profile.file_associations_enabled);
        assert!(profile.window_decorations);
        assert!(!profile.custom_window_chrome);
        assert!(!profile.manual_window_resize);
        assert!(!profile.associated_extensions.is_empty());
        assert!(!profile.shell_actions.is_empty());
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_profile_preserves_its_integration_capabilities() {
        let profile = integration_profile();

        assert_eq!(profile.platform, "linux");
        assert!(profile.selected_item_actions_enabled);
        assert!(profile.background_actions_enabled);
        assert!(profile.file_associations_enabled);
        assert!(!profile.window_decorations);
        assert!(profile.custom_window_chrome);
        assert!(profile.manual_window_resize);
        assert!(!profile.associated_extensions.is_empty());
        assert!(!profile.shell_actions.is_empty());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_profile_preserves_native_window_capabilities() {
        let profile = integration_profile();

        assert_eq!(profile.platform, "macos");
        assert!(!profile.selected_item_actions_enabled);
        assert!(!profile.background_actions_enabled);
        assert!(profile.file_associations_enabled);
        assert!(profile.window_decorations);
        assert!(!profile.custom_window_chrome);
        assert!(!profile.manual_window_resize);
        assert!(!profile.associated_extensions.is_empty());
        assert!(profile.shell_actions.is_empty());
    }
}
