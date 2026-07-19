use std::{
    cell::{Cell, RefCell},
    rc::Rc,
};

use gio::prelude::*;
use gtk::prelude::*;
use tauri::{Builder, Wry};

use super::{
    DefaultHandlerEntry, DefaultHandlerRequest, LegacyRegistrationReconcileRequest,
    LegacyReplacementMigrationRequest, LegacyReplacementMigrationSnapshot, NativeFileDragCandidate,
    NativeFileDragError, NativeFileDragItem, NativeFileDragOutcome, NativeFileDragStart,
    NativeFileDragStreamProvider, NativePlatform, PlatformProfile, ShellActionProfile,
    staged_file_drag::{PosixDragPathPolicy, StagedFileDrag, prepare_posix_drag_items},
};
use crate::dto::{SystemFileIconDto, SystemFileIconRequestEntry};

/// Linux-specific shell integration surface.
///
/// This module is intentionally isolated so MIME and desktop packaging concerns
/// stay platform-owned and out of command payload handling.
pub const PLATFORM_NAME: &str = "linux";
pub const DESKTOP_ACTIONS_ENABLED: bool = true;

pub const DESKTOP_SHELL_ACTIONS: &[ShellActionProfile] = &[
    ShellActionProfile {
        label: "ZManager > Extract Here",
        quick_action: "extractHere",
    },
    ShellActionProfile {
        label: "ZManager > Extract to Archive Folder",
        quick_action: "extractToFolder",
    },
    ShellActionProfile {
        label: "ZManager > Open archive",
        quick_action: "open",
    },
    ShellActionProfile {
        label: "ZManager > Add to archive...",
        quick_action: "compress",
    },
    ShellActionProfile {
        label: "ZManager > Add to .tzap",
        quick_action: "compressTzap",
    },
    ShellActionProfile {
        label: "ZManager > Add to .zip",
        quick_action: "compressZip",
    },
    ShellActionProfile {
        label: "ZManager > Add to .7z",
        quick_action: "compressSevenZ",
    },
    ShellActionProfile {
        label: "ZManager > Add to .tzst",
        quick_action: "compressTarZst",
    },
];

pub struct LinuxPlatform;

impl NativePlatform for LinuxPlatform {
    fn initialize_native_host(
        _inbox: crate::native_launch_inbox::NativeLaunchInbox,
    ) -> Result<(), String> {
        Ok(())
    }

    fn register_services(builder: Builder<Wry>) -> Builder<Wry> {
        if DESKTOP_ACTIONS_ENABLED {
            let _ = crate::archive_file_types::associated_extensions();
        }

        builder
    }

    fn integration_profile() -> PlatformProfile {
        PlatformProfile {
            platform: PLATFORM_NAME,
            selected_item_actions_enabled: DESKTOP_ACTIONS_ENABLED,
            background_actions_enabled: DESKTOP_ACTIONS_ENABLED,
            file_associations_enabled: true,
            window_decorations: false,
            custom_window_chrome: true,
            manual_window_resize: true,
            associated_extensions: crate::archive_file_types::associated_extensions(),
            shell_actions: DESKTOP_SHELL_ACTIONS,
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
                // Linux file managers/theme icons are resolved by the shell. Touch the
                // request fields so DTO drift is caught even though we do not return
                // per-file icon bitmaps on this platform.
                data_url: linux_system_file_icon_data_url(entry),
            })
            .collect()
    }

    fn default_handlers(
        _request: &DefaultHandlerRequest,
    ) -> Result<Vec<DefaultHandlerEntry>, String> {
        Err("Default-handler control is owned by the Linux desktop environment".to_string())
    }

    fn read_replacement_migration(
        _request: &LegacyReplacementMigrationRequest,
    ) -> Result<LegacyReplacementMigrationSnapshot, String> {
        Ok(LegacyReplacementMigrationSnapshot::empty())
    }

    fn reconcile_legacy_registrations(
        _request: &LegacyRegistrationReconcileRequest,
    ) -> Result<Vec<super::ReplacementMigrationDiagnostic>, String> {
        Ok(Vec::new())
    }

    fn set_owner_only_file_permissions(file: &std::fs::File) -> std::io::Result<()> {
        use std::os::unix::fs::PermissionsExt as _;
        file.set_permissions(std::fs::Permissions::from_mode(0o600))
    }

    fn native_drag_requires_preflight() -> bool {
        true
    }

    fn consume_shell_action_request(_token: &str) -> Result<Vec<u8>, String> {
        Err("Opaque App Group shell-action requests are available only on macOS".to_string())
    }

    fn prepare_native_file_drag(
        candidates: &[NativeFileDragCandidate],
        strip_components: usize,
    ) -> Result<Vec<NativeFileDragItem>, NativeFileDragError> {
        prepare_posix_drag_items(
            candidates,
            strip_components,
            PosixDragPathPolicy {
                platform_label: "Linux",
                collision_case_sensitive: true,
                max_component_bytes: Some(255),
            },
        )
    }

    fn start_native_file_drag(
        _window: &tauri::WebviewWindow<Wry>,
        items: &[NativeFileDragItem],
        stream_provider: NativeFileDragStreamProvider,
        _registry: &crate::native_drag_session::NativeDragSessionRegistry,
    ) -> Result<NativeFileDragStart, NativeFileDragError> {
        if items.is_empty() {
            return Err(NativeFileDragError::new(
                "No archive files are available to drag.",
                None::<String>,
            ));
        }

        let staged_drag = StagedFileDrag::create("Linux", items, stream_provider)?;
        Ok(NativeFileDragStart {
            outcome: linux_file_drag::start_drag(staged_drag)?,
            session_id: None,
        })
    }

    fn shutdown() {}
}

fn linux_system_file_icon_data_url(entry: &SystemFileIconRequestEntry) -> Option<String> {
    let _lookup_key = if entry.is_directory {
        "inode/directory"
    } else {
        entry.path.trim()
    };

    None
}

mod linux_file_drag {
    use super::*;

    const URI_LIST_TARGET_INFO: u32 = 1;
    const GNOME_COPIED_FILES_TARGET_INFO: u32 = 2;
    const URI_LIST_TARGET: &str = "text/uri-list";
    const GNOME_COPIED_FILES_TARGET: &str = "x-special/gnome-copied-files";

    fn gnome_copied_files_payload(uris: &[String]) -> String {
        format!("copy\n{}\n", uris.join("\n"))
    }

    fn drag_selected_copy_action(selected_action: gdk::DragAction) -> bool {
        selected_action.contains(gdk::DragAction::COPY)
    }

    pub fn start_drag(
        staged_drag: StagedFileDrag,
    ) -> Result<NativeFileDragOutcome, NativeFileDragError> {
        if gtk::init().is_err() {
            return Err(NativeFileDragError::new(
                "Unable to initialize Linux drag-out.",
                Some("Start ZManager from a graphical desktop session and try again."),
            ));
        }

        let uris = staged_drag
            .drag_paths()
            .iter()
            .map(|path| gio::File::for_path(path).uri().to_string())
            .collect::<Vec<_>>();
        if uris.is_empty() {
            return Err(NativeFileDragError::new(
                "No staged files are available to drag.",
                None::<String>,
            ));
        }

        let drag_finished = Rc::new(Cell::new(false));
        let drag_failed = Rc::new(Cell::new(false));
        let dropped = Rc::new(Cell::new(false));
        let staged_drag = Rc::new(RefCell::new(Some(staged_drag)));
        let window = gtk::Window::new(gtk::WindowType::Popup);
        window.set_default_size(1, 1);
        window.set_decorated(false);
        window.set_keep_above(true);

        let source = gtk::EventBox::new();
        source.set_visible_window(false);
        window.add(&source);
        window.show_all();

        source.drag_source_set(
            gdk::ModifierType::BUTTON1_MASK,
            &[
                gtk::TargetEntry::new(
                    URI_LIST_TARGET,
                    gtk::TargetFlags::OTHER_APP,
                    URI_LIST_TARGET_INFO,
                ),
                gtk::TargetEntry::new(
                    GNOME_COPIED_FILES_TARGET,
                    gtk::TargetFlags::OTHER_APP,
                    GNOME_COPIED_FILES_TARGET_INFO,
                ),
            ],
            gdk::DragAction::COPY,
        );
        source.drag_source_add_uri_targets();
        source.drag_source_set_icon_name("zmanager-desktop");

        let data_uris = uris.clone();
        source.connect_drag_data_get(move |_source, _context, selection_data, info, _time| {
            if info == GNOME_COPIED_FILES_TARGET_INFO {
                selection_data.set(
                    &gdk::Atom::intern(GNOME_COPIED_FILES_TARGET),
                    8,
                    gnome_copied_files_payload(&data_uris).as_bytes(),
                );
                return;
            }

            let uri_refs = data_uris.iter().map(String::as_str).collect::<Vec<_>>();
            selection_data.set_uris(&uri_refs);
        });

        let drag_finished_for_end = Rc::clone(&drag_finished);
        let drag_failed_for_end = Rc::clone(&drag_failed);
        let dropped_for_end = Rc::clone(&dropped);
        let staged_drag_for_end = Rc::clone(&staged_drag);
        source.connect_drag_end(move |_source, context| {
            let was_dropped =
                !drag_failed_for_end.get() && drag_selected_copy_action(context.selected_action());
            dropped_for_end.set(was_dropped);
            drag_finished_for_end.set(true);
            if let Some(staged_drag) = staged_drag_for_end.borrow_mut().take() {
                if was_dropped {
                    staged_drag.keep_for_file_manager_copy();
                }
            }
        });

        let drag_finished_for_failed = Rc::clone(&drag_finished);
        let drag_failed_for_failed = Rc::clone(&drag_failed);
        let staged_drag_for_failed = Rc::clone(&staged_drag);
        source.connect_drag_failed(move |_source, _context, _result| {
            drag_failed_for_failed.set(true);
            drag_finished_for_failed.set(true);
            let _ = staged_drag_for_failed.borrow_mut().take();
            glib::Propagation::Proceed
        });

        let target_list = gtk::TargetList::new(&[
            gtk::TargetEntry::new(
                URI_LIST_TARGET,
                gtk::TargetFlags::OTHER_APP,
                URI_LIST_TARGET_INFO,
            ),
            gtk::TargetEntry::new(
                GNOME_COPIED_FILES_TARGET,
                gtk::TargetFlags::OTHER_APP,
                GNOME_COPIED_FILES_TARGET_INFO,
            ),
        ]);
        let current_event = gtk::current_event();
        let Some(_context) = source.drag_begin_with_coordinates(
            &target_list,
            gdk::DragAction::COPY,
            1,
            current_event.as_ref(),
            -1,
            -1,
        ) else {
            let _ = staged_drag.borrow_mut().take();
            window.close();
            return Err(NativeFileDragError::new(
                "Linux file drag-out could not be started.",
                Some("Try dragging again, or use Extract... if the file manager rejects the drag."),
            ));
        };

        while !drag_finished.get() {
            gtk::main_iteration_do(true);
        }

        let _ = staged_drag.borrow_mut().take();
        window.close();

        if dropped.get() {
            Ok(NativeFileDragOutcome::Dropped)
        } else {
            Ok(NativeFileDragOutcome::NoDrop)
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn linux_drag_success_requires_selected_copy_action() {
            assert!(drag_selected_copy_action(gdk::DragAction::COPY));
            assert!(!drag_selected_copy_action(gdk::DragAction::empty()));
            assert!(!drag_selected_copy_action(gdk::DragAction::MOVE));
        }

        #[test]
        fn gnome_copied_files_payload_uses_copy_header_and_uri_lines() {
            let payload = gnome_copied_files_payload(&[
                "file:///tmp/zmanager/a.txt".to_string(),
                "file:///tmp/zmanager/b.txt".to_string(),
            ]);

            assert_eq!(
                payload,
                "copy\nfile:///tmp/zmanager/a.txt\nfile:///tmp/zmanager/b.txt\n"
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{collections::HashMap, fs, sync::Arc};

    use super::*;

    #[test]
    fn linux_staged_drag_writes_nested_files_and_cleans_up() {
        let payloads = Arc::new(HashMap::from([
            ("docs/readme.txt".to_string(), b"drag payload".to_vec()),
            ("root.txt".to_string(), b"root payload".to_vec()),
        ]));
        let provider_payloads = Arc::clone(&payloads);
        let provider: NativeFileDragStreamProvider = Arc::new(move |entry_path, writer| {
            let bytes = provider_payloads.get(entry_path).ok_or_else(|| {
                NativeFileDragError::new(
                    format!("missing test payload for {entry_path}"),
                    None::<String>,
                )
            })?;
            writer.write_all(bytes).map_err(|error| {
                NativeFileDragError::new(
                    format!("unable to write test payload: {error}"),
                    None::<String>,
                )
            })?;
            Ok(bytes.len() as u64)
        });

        let staged = StagedFileDrag::create(
            "Linux",
            &[
                NativeFileDragItem {
                    entry_path: "docs/readme.txt".to_string(),
                    display_path: "docs\\readme.txt".to_string(),
                    size: Some(12),
                    modified_unix_seconds: None,
                },
                NativeFileDragItem {
                    entry_path: "root.txt".to_string(),
                    display_path: "root.txt".to_string(),
                    size: Some(12),
                    modified_unix_seconds: None,
                },
            ],
            provider,
        )
        .expect("stage drag files");
        let root = staged.root().expect("test staged root").to_path_buf();
        let nested_file_path = root.join("docs/readme.txt");
        let root_file_path = root.join("root.txt");

        assert_eq!(
            fs::read(&nested_file_path).expect("read staged nested file"),
            b"drag payload"
        );
        assert_eq!(
            fs::read(&root_file_path).expect("read staged root file"),
            b"root payload"
        );
        assert_eq!(
            staged.drag_paths(),
            vec![root.join("docs"), root.join("root.txt")]
        );
        drop(staged);
        assert!(!root.exists(), "staged drag root should be cleaned up");
    }

    #[test]
    fn linux_drag_policy_rejects_traversal_but_allows_windows_specific_names() {
        let items =
            LinuxPlatform::prepare_native_file_drag(&[candidate("root/folder/report?.txt")], 1)
                .expect("Linux should allow question marks in file names");
        assert_eq!(items[0].display_path, "folder/report?.txt");

        for (path, strip_components) in [
            ("../escape.txt", 0),
            ("folder/./file.txt", 0),
            ("folder/file.txt", 2),
            ("folder/\0file.txt", 0),
        ] {
            assert!(
                LinuxPlatform::prepare_native_file_drag(&[candidate(path)], strip_components,)
                    .is_err(),
                "{path} should be rejected"
            );
        }
    }

    #[test]
    fn linux_drag_policy_uses_case_sensitive_collisions() {
        let case_distinct = LinuxPlatform::prepare_native_file_drag(
            &[candidate("one/Foo.txt"), candidate("two/foo.txt")],
            1,
        )
        .expect("case-distinct Linux paths should coexist");
        assert_eq!(
            case_distinct
                .iter()
                .map(|item| item.display_path.as_str())
                .collect::<Vec<_>>(),
            vec!["Foo.txt", "foo.txt"]
        );

        assert!(
            LinuxPlatform::prepare_native_file_drag(
                &[candidate("one/file.txt"), candidate("two/file.txt")],
                1,
            )
            .is_err()
        );
    }

    fn candidate(path: &str) -> NativeFileDragCandidate {
        NativeFileDragCandidate {
            entry_path: path.to_string(),
            size: Some(1),
            modified_unix_seconds: None,
        }
    }
}
