use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock, mpsc};

use tauri::{Builder, Wry};

use super::{
    NativeFileDragCandidate, NativeFileDragError, NativeFileDragItem, NativeFileDragOutcome,
    NativeFileDragStreamProvider, NativePlatform, PlatformProfile,
    staged_file_drag::{PosixDragPathPolicy, StagedFileDrag, prepare_posix_drag_items},
};
use crate::dto::{SystemFileIconDto, SystemFileIconRequestEntry};

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
    ) -> Result<NativeFileDragOutcome, NativeFileDragError> {
        if items.is_empty() {
            return Err(NativeFileDragError::invalid_request(
                "No archive files are available to drag.",
            ));
        }

        let staged_drag = StagedFileDrag::create("macOS", items, stream_provider)?;
        start_macos_file_drag(window, staged_drag)
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

fn start_macos_file_drag(
    window: &tauri::WebviewWindow<Wry>,
    staged_drag: StagedFileDrag,
) -> Result<NativeFileDragOutcome, NativeFileDragError> {
    let drag_paths = staged_drag.drag_paths().to_vec();
    if drag_paths.is_empty() {
        return Err(NativeFileDragError::invalid_request(
            "No staged files are available to drag.",
        ));
    }

    let staged_drag = Arc::new(Mutex::new(Some(staged_drag)));
    let staged_for_callback = Arc::clone(&staged_drag);
    let window = window.clone();
    let drag_window = window.clone();
    let (start_sender, start_receiver) = mpsc::sync_channel(1);
    let (outcome_sender, outcome_receiver) = mpsc::sync_channel(1);

    window
        .run_on_main_thread(move || {
            let result = drag::start_drag(
                &drag_window,
                drag::DragItem::Files(drag_paths),
                drag::Image::Raw(include_bytes!("../../icons/icon.png").to_vec()),
                move |result, _cursor_position| {
                    let outcome = match result {
                        drag::DragResult::Dropped => {
                            if let Some(staged) = staged_for_callback
                                .lock()
                                .expect("macOS staged drag mutex poisoned")
                                .take()
                            {
                                staged.keep_for_file_manager_copy();
                            }
                            NativeFileDragOutcome::Dropped
                        }
                        drag::DragResult::Cancel => {
                            let _ = staged_for_callback
                                .lock()
                                .expect("macOS staged drag mutex poisoned")
                                .take();
                            NativeFileDragOutcome::Cancelled
                        }
                    };
                    let _ = outcome_sender.send(outcome);
                },
                drag::Options::default(),
            )
            .map_err(|error| error.to_string());
            let _ = start_sender.send(result);
        })
        .map_err(|error| {
            NativeFileDragError::new(
                format!("Unable to schedule macOS drag-out: {error}"),
                Some("Try dragging again, or use Extract... if Finder rejects the drag."),
            )
        })?;

    start_receiver
        .recv()
        .map_err(|error| {
            NativeFileDragError::new(
                format!("macOS drag-out did not start: {error}"),
                Some("Try dragging again, or use Extract... if Finder rejects the drag."),
            )
        })?
        .map_err(|error| {
            NativeFileDragError::new(
                format!("macOS drag-out could not be started: {error}"),
                Some("Try dragging again, or use Extract... if Finder rejects the drag."),
            )
        })?;

    outcome_receiver.recv().map_err(|error| {
        NativeFileDragError::new(
            format!("macOS drag-out ended without an outcome: {error}"),
            Some("Try dragging again, or use Extract... if Finder rejects the drag."),
        )
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
