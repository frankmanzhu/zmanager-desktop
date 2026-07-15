use std::sync::{Arc, Mutex, mpsc};

use tauri::{Builder, Wry};

use super::{
    NativeFileDragCandidate, NativeFileDragError, NativeFileDragItem, NativeFileDragOutcome,
    NativeFileDragStreamProvider, NativePlatform, PlatformProfile,
    staged_file_drag::{PosixDragPathPolicy, StagedFileDrag, prepare_posix_drag_items},
};
use crate::dto::{SystemFileIconDto, SystemFileIconRequestEntry};

pub const PLATFORM_NAME: &str = "macos";

pub struct MacOsPlatform;

impl NativePlatform for MacOsPlatform {
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
        window.set_decorations(Self::integration_profile().window_decorations)
    }

    fn system_file_icons(entries: &[SystemFileIconRequestEntry]) -> Vec<SystemFileIconDto> {
        entries
            .iter()
            .map(|entry| SystemFileIconDto {
                key: entry.key.clone(),
                // The desktop shell retains its generic archive/folder icons when AppKit
                // cannot provide a bitmap. Native icon lookup can be added here without
                // changing the command or frontend seams.
                data_url: macos_system_file_icon_data_url(entry),
            })
            .collect()
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
}

fn macos_system_file_icon_data_url(entry: &SystemFileIconRequestEntry) -> Option<String> {
    let _lookup_path = if entry.is_directory {
        "/"
    } else {
        entry.path.trim()
    };
    None
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
