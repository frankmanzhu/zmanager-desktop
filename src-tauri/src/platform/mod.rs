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

use std::collections::HashMap;
use std::fs::File;
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

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultHandlerRequest {
    pub action: DefaultHandlerAction,
    pub extensions: Vec<String>,
    pub bundle_id: String,
    pub handlers: Option<HashMap<String, String>>,
}

#[derive(Clone, Copy, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DefaultHandlerAction {
    Status,
    Set,
    Restore,
}

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultHandlerEntry {
    pub file_extension: String,
    pub content_type: Option<String>,
    pub handler_bundle_id: Option<String>,
    pub is_current_application: bool,
    pub error_code: Option<i32>,
}

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyReplacementMigrationRequest {
    pub schema_version: u32,
    pub legacy_bundle_id: String,
    pub current_application_path: String,
    pub legacy_account_state_directory: String,
    pub temporary_directory: String,
    pub legacy_application_candidates: Vec<String>,
}

#[derive(Clone, Debug, Default, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyReplacementPreferences {
    pub default_archive_format: Option<String>,
    pub default_clean_source_enabled: Option<bool>,
    pub legacy_default_create_profile: Option<String>,
    pub default_output_location: Option<String>,
    pub custom_output_folder_path: Option<String>,
    pub quick_open_extraction_enabled: Option<bool>,
    pub quick_extraction_location: Option<String>,
    pub quick_extraction_folder_path: Option<String>,
    pub preview_cleanup_policy: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplacementMigrationDiagnostic {
    pub key: String,
    pub code: String,
}

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyReplacementMigrationSnapshot {
    pub schema_version: u32,
    pub preferences: LegacyReplacementPreferences,
    pub default_handler_restore: HashMap<String, String>,
    pub legacy_account_state_directory: Option<String>,
    pub stale_preview_roots: Vec<String>,
    pub legacy_registration_paths: Vec<String>,
    pub registration_owners: HashMap<String, String>,
    pub diagnostics: Vec<ReplacementMigrationDiagnostic>,
}

impl LegacyReplacementMigrationSnapshot {
    pub fn empty() -> Self {
        Self {
            schema_version: 1,
            preferences: LegacyReplacementPreferences::default(),
            default_handler_restore: HashMap::new(),
            legacy_account_state_directory: None,
            stale_preview_roots: Vec::new(),
            legacy_registration_paths: Vec::new(),
            registration_owners: HashMap::new(),
            diagnostics: Vec::new(),
        }
    }
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyRegistrationReconcileRequest {
    pub schema_version: u32,
    pub legacy_bundle_id: String,
    pub current_application_path: String,
    pub legacy_application_paths: Vec<String>,
}

#[derive(Clone, Debug, serde::Deserialize)]
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
#[serde(rename_all = "camelCase")]
pub struct LegacyRegistrationReconcileResult {
    pub diagnostics: Vec<ReplacementMigrationDiagnostic>,
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
    #[cfg_attr(target_os = "macos", allow(dead_code))]
    pub size: Option<u64>,
    #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
    pub modified_unix_seconds: Option<u64>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NativeFileDragOutcome {
    Pending,
    #[cfg_attr(target_os = "macos", allow(dead_code))]
    Dropped,
    #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
    Cancelled,
    #[cfg_attr(target_os = "macos", allow(dead_code))]
    NoDrop,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NativeFileDragStart {
    pub outcome: NativeFileDragOutcome,
    pub session_id: Option<String>,
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
    fn default_handlers(
        request: &DefaultHandlerRequest,
    ) -> Result<Vec<DefaultHandlerEntry>, String>;
    fn read_replacement_migration(
        request: &LegacyReplacementMigrationRequest,
    ) -> Result<LegacyReplacementMigrationSnapshot, String>;
    fn reconcile_legacy_registrations(
        request: &LegacyRegistrationReconcileRequest,
    ) -> Result<Vec<ReplacementMigrationDiagnostic>, String>;
    fn set_owner_only_file_permissions(file: &File) -> std::io::Result<()>;
    fn native_drag_requires_preflight() -> bool;
    fn consume_shell_action_request(token: &str) -> Result<Vec<u8>, String>;
    fn prepare_native_file_drag(
        candidates: &[NativeFileDragCandidate],
        strip_components: usize,
    ) -> Result<Vec<NativeFileDragItem>, NativeFileDragError>;
    fn start_native_file_drag(
        window: &tauri::WebviewWindow<Wry>,
        items: &[NativeFileDragItem],
        stream_provider: NativeFileDragStreamProvider,
        registry: &crate::native_drag_session::NativeDragSessionRegistry,
    ) -> Result<NativeFileDragStart, NativeFileDragError>;
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

pub fn default_handlers(
    request: &DefaultHandlerRequest,
) -> Result<Vec<DefaultHandlerEntry>, String> {
    ActivePlatform::default_handlers(request)
}

pub fn read_replacement_migration(
    request: &LegacyReplacementMigrationRequest,
) -> Result<LegacyReplacementMigrationSnapshot, String> {
    ActivePlatform::read_replacement_migration(request)
}

pub fn reconcile_legacy_registrations(
    request: &LegacyRegistrationReconcileRequest,
) -> Result<Vec<ReplacementMigrationDiagnostic>, String> {
    ActivePlatform::reconcile_legacy_registrations(request)
}

pub fn set_owner_only_file_permissions(file: &File) -> std::io::Result<()> {
    ActivePlatform::set_owner_only_file_permissions(file)
}

pub fn native_drag_requires_preflight() -> bool {
    ActivePlatform::native_drag_requires_preflight()
}

pub fn consume_shell_action_request(token: &str) -> Result<Vec<u8>, String> {
    ActivePlatform::consume_shell_action_request(token)
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
    registry: &crate::native_drag_session::NativeDragSessionRegistry,
) -> Result<NativeFileDragStart, NativeFileDragError> {
    ActivePlatform::start_native_file_drag(window, items, stream_provider, registry)
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
