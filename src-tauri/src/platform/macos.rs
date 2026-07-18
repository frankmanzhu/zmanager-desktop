use std::ffi::c_void;
use std::path::Path;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;
use tauri::{Builder, Emitter, Manager, Wry};

use super::{
    NativeFileDragCandidate, NativeFileDragError, NativeFileDragItem, NativeFileDragOutcome,
    NativeFileDragStart, NativeFileDragStreamProvider, NativePlatform, PlatformProfile,
    staged_file_drag::{PosixDragPathPolicy, prepare_posix_drag_items},
};
use crate::dto::{SystemFileIconDto, SystemFileIconRequestEntry};
use crate::native_drag_session::NativeDragSessionRegistry;

pub const PLATFORM_NAME: &str = "macos";

pub struct MacOsPlatform;

static HOST_CALLBACK_RECEIVED: AtomicBool = AtomicBool::new(false);
static NATIVE_LAUNCH_INBOX: OnceLock<crate::native_launch_inbox::NativeLaunchInbox> =
    OnceLock::new();

unsafe extern "C" {
    fn zmanager_macos_host_start(
        callback: Option<extern "C" fn(*const u8, usize, *mut c_void)>,
        context: *mut c_void,
    ) -> i32;
    fn zmanager_macos_host_shutdown();
    fn zmanager_macos_system_file_icons(
        bytes: *const u8,
        length: usize,
        callback: Option<extern "C" fn(*const u8, usize, *mut c_void)>,
        context: *mut c_void,
    ) -> i32;
    fn zmanager_macos_start_promise_drag(
        view: *mut c_void,
        session_bytes: *const u8,
        session_length: usize,
        item_bytes: *const u8,
        item_length: usize,
        write: Option<extern "C" fn(*const u8, usize, *const u8, usize, *mut c_void) -> i32>,
        outcome: Option<extern "C" fn(i32, *mut c_void)>,
        release: Option<extern "C" fn(*mut c_void)>,
        context: *mut c_void,
    ) -> i32;
}

extern "C" fn host_callback(bytes: *const u8, length: usize, _context: *mut c_void) {
    if bytes.is_null() || length > 1_048_576 {
        return;
    }
    let payload = unsafe { std::slice::from_raw_parts(bytes, length) };
    let Ok(value) = serde_json::from_slice::<serde_json::Value>(payload) else {
        return;
    };
    if value["kind"] == "hostStarted" && value["mainThread"] == true {
        HOST_CALLBACK_RECEIVED.store(true, Ordering::Release);
        if value["appGroupSelfTest"] == true && value["filePromiseSelfTest"] == true {
            eprintln!("ZMANAGER_MACOS_INSTALLED_LINKAGE_SELF_TEST_OK");
        }
        return;
    }
    if let Ok(event) =
        serde_json::from_value::<crate::native_launch_inbox::NativeInboundEvent>(value)
        && let Some(inbox) = NATIVE_LAUNCH_INBOX.get()
    {
        let _ = inbox.ingest(event);
    }
}

impl NativePlatform for MacOsPlatform {
    fn initialize_native_host(
        inbox: crate::native_launch_inbox::NativeLaunchInbox,
    ) -> Result<(), String> {
        let _ = NATIVE_LAUNCH_INBOX.set(inbox);
        let result =
            unsafe { zmanager_macos_host_start(Some(host_callback), std::ptr::null_mut()) };
        if result != 0 && result != 2 {
            return Err(format!("macOS Native Host failed to start: {result}"));
        }
        Ok(())
    }

    fn register_services(builder: Builder<Wry>) -> Builder<Wry> {
        builder
    }

    fn integration_profile() -> PlatformProfile {
        PlatformProfile {
            platform: PLATFORM_NAME,
            selected_item_actions_enabled: false,
            background_actions_enabled: false,
            file_associations_enabled: true,
            window_decorations: true,
            custom_window_chrome: false,
            manual_window_resize: false,
            associated_extensions: crate::archive_file_types::associated_extensions(),
            shell_actions: &[],
        }
    }

    fn configure_main_window(window: &tauri::WebviewWindow<Wry>) -> Result<(), tauri::Error> {
        window.set_decorations(Self::integration_profile().window_decorations)?;
        if HOST_CALLBACK_RECEIVED.load(Ordering::Acquire) {
            eprintln!("ZMANAGER_MACOS_HOST_CALLBACK_OK");
        }
        Ok(())
    }

    fn system_file_icons(entries: &[SystemFileIconRequestEntry]) -> Vec<SystemFileIconDto> {
        let Ok(input) = serde_json::to_vec(entries) else {
            return icon_fallback(entries);
        };
        let mut output = Vec::<u8>::new();
        let result = unsafe {
            zmanager_macos_system_file_icons(
                input.as_ptr(),
                input.len(),
                Some(icon_operation_callback),
                (&mut output as *mut Vec<u8>).cast(),
            )
        };
        if result != 0 {
            return icon_fallback(entries);
        }
        serde_json::from_slice(&output).unwrap_or_else(|_| icon_fallback(entries))
    }

    fn prepare_native_file_drag(
        candidates: &[NativeFileDragCandidate],
        strip_components: usize,
    ) -> Result<Vec<NativeFileDragItem>, NativeFileDragError> {
        prepare_posix_drag_items(
            candidates,
            strip_components,
            PosixDragPathPolicy {
                platform_label: "macOS",
                // Finder destinations are commonly case-insensitive. Rejecting the
                // collision before staging gives deterministic behavior on both APFS modes.
                collision_case_sensitive: false,
                max_component_bytes: Some(255),
            },
        )
    }

    fn start_native_file_drag(
        window: &tauri::WebviewWindow<Wry>,
        items: &[NativeFileDragItem],
        stream_provider: NativeFileDragStreamProvider,
        registry: &NativeDragSessionRegistry,
    ) -> Result<NativeFileDragStart, NativeFileDragError> {
        if items.is_empty() {
            return Err(NativeFileDragError::invalid_request(
                "No archive files are available to drag.",
            ));
        }
        start_macos_file_promise_drag(window, items, stream_provider, registry)
    }

    fn shutdown() {
        unsafe { zmanager_macos_host_shutdown() };
        eprintln!("ZMANAGER_MACOS_HOST_SHUTDOWN_OK");
    }
}

extern "C" fn icon_operation_callback(bytes: *const u8, length: usize, context: *mut c_void) {
    if bytes.is_null() || context.is_null() || length > 8 * 1_048_576 {
        return;
    }
    let output = unsafe { &mut *context.cast::<Vec<u8>>() };
    output.extend_from_slice(unsafe { std::slice::from_raw_parts(bytes, length) });
}

fn icon_fallback(entries: &[SystemFileIconRequestEntry]) -> Vec<SystemFileIconDto> {
    entries
        .iter()
        .map(|entry| SystemFileIconDto {
            key: entry.key.clone(),
            data_url: None,
        })
        .collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PromiseDragItemDto {
    entry_path: String,
    promised_name: String,
    file_type: &'static str,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PromiseDragOutcomeEvent {
    session_id: String,
    outcome: &'static str,
}

struct PromiseDragContext {
    registry: NativeDragSessionRegistry,
    session_id: String,
    app_handle: tauri::AppHandle<Wry>,
}

extern "C" fn promise_write_callback(
    entry_bytes: *const u8,
    entry_length: usize,
    destination_bytes: *const u8,
    destination_length: usize,
    context: *mut c_void,
) -> i32 {
    if context.is_null()
        || entry_bytes.is_null()
        || destination_bytes.is_null()
        || entry_length == 0
        || entry_length > 4_096
        || destination_length == 0
        || destination_length > 32_768
    {
        return 1;
    }
    let context = unsafe { &*context.cast::<PromiseDragContext>() };
    let entry = unsafe { std::slice::from_raw_parts(entry_bytes, entry_length) };
    let destination = unsafe { std::slice::from_raw_parts(destination_bytes, destination_length) };
    let (Ok(entry), Ok(destination)) =
        (std::str::from_utf8(entry), std::str::from_utf8(destination))
    else {
        return 2;
    };
    match context
        .registry
        .write_promise(&context.session_id, entry, Path::new(destination))
    {
        Ok(_) => 0,
        Err(_) => 3,
    }
}

extern "C" fn promise_outcome_callback(outcome: i32, context: *mut c_void) {
    if context.is_null() {
        return;
    }
    let context = unsafe { &*context.cast::<PromiseDragContext>() };
    let outcome = if outcome == 0 { "dropped" } else { "cancelled" };
    if outcome == "cancelled" {
        context.registry.cancel(&context.session_id);
    }
    let _ = context.app_handle.emit(
        "native-file-drag-outcome",
        PromiseDragOutcomeEvent {
            session_id: context.session_id.clone(),
            outcome,
        },
    );
}

extern "C" fn promise_release_callback(context: *mut c_void) {
    if context.is_null() {
        return;
    }
    let context = unsafe { Box::from_raw(context.cast::<PromiseDragContext>()) };
    context.registry.cancel(&context.session_id);
}

fn start_macos_file_promise_drag(
    window: &tauri::WebviewWindow<Wry>,
    items: &[NativeFileDragItem],
    stream_provider: NativeFileDragStreamProvider,
    registry: &NativeDragSessionRegistry,
) -> Result<NativeFileDragStart, NativeFileDragError> {
    let descriptors = NativeDragSessionRegistry::descriptors(items)?;
    let session_id = registry.create(items, stream_provider)?;
    let promise_items = descriptors
        .into_iter()
        .map(|descriptor| PromiseDragItemDto {
            entry_path: descriptor.promise_path,
            promised_name: descriptor.promised_name,
            file_type: if descriptor.is_directory {
                "public.folder"
            } else {
                "public.data"
            },
        })
        .collect::<Vec<_>>();
    let item_json = serde_json::to_vec(&promise_items).map_err(|error| {
        NativeFileDragError::new(
            format!("Unable to describe macOS file promises: {error}"),
            None::<String>,
        )
    })?;
    let view = window.ns_view().map_err(|error| {
        NativeFileDragError::new(
            format!("Unable to access the macOS drag source view: {error}"),
            None::<String>,
        )
    })?;
    let context = Box::new(PromiseDragContext {
        registry: registry.clone(),
        session_id: session_id.clone(),
        app_handle: window.app_handle().clone(),
    });
    let context = Box::into_raw(context).cast::<c_void>();
    let result = unsafe {
        zmanager_macos_start_promise_drag(
            view,
            session_id.as_ptr(),
            session_id.len(),
            item_json.as_ptr(),
            item_json.len(),
            Some(promise_write_callback),
            Some(promise_outcome_callback),
            Some(promise_release_callback),
            context,
        )
    };
    if result != 0 {
        let context = unsafe { Box::from_raw(context.cast::<PromiseDragContext>()) };
        context.registry.cancel(&context.session_id);
        return Err(NativeFileDragError::new(
            format!("macOS file-promise drag could not be started: {result}"),
            Some("Try dragging again, or use Extract... if Finder rejects the drag."),
        ));
    }
    Ok(NativeFileDragStart {
        outcome: NativeFileDragOutcome::Pending,
        session_id: Some(session_id),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn candidate(path: &str) -> NativeFileDragCandidate {
        NativeFileDragCandidate {
            entry_path: path.to_string(),
            size: Some(1),
            modified_unix_seconds: None,
        }
    }

    #[test]
    fn macos_drag_policy_uses_posix_paths_and_allows_windows_specific_names() {
        let items = MacOsPlatform::prepare_native_file_drag(&[candidate("docs/report?.txt")], 0)
            .expect("macOS should allow question marks in file names");

        assert_eq!(items[0].display_path, "docs/report?.txt");
    }

    #[test]
    fn macos_drag_policy_rejects_case_insensitive_collisions_after_stripping() {
        assert!(
            MacOsPlatform::prepare_native_file_drag(
                &[candidate("one/Readme.txt"), candidate("two/README.txt")],
                1,
            )
            .is_err()
        );
    }
}
