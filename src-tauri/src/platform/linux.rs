use std::{
    cell::{Cell, RefCell},
    fs,
    path::PathBuf,
    rc::Rc,
    sync::{Arc, Mutex, OnceLock},
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use gio::prelude::*;
use gtk::prelude::*;
use tauri::{Builder, Manager, Wry};

use super::{
    NativeFileDragError, NativeFileDragItem, NativeFileDragOutcome, NativeFileDragStreamProvider,
    ShellActionProfile,
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
        label: "Compress using ZManager",
        quick_action: "compress",
    },
    ShellActionProfile {
        label: "Extract using ZManager",
        quick_action: "extract",
    },
];

const URI_LIST_TARGET_INFO: u32 = 1;
const GNOME_COPIED_FILES_TARGET_INFO: u32 = 2;

pub fn is_desktop_actions_enabled() -> bool {
    DESKTOP_ACTIONS_ENABLED
}

pub fn associated_extensions() -> Vec<String> {
    crate::archive_file_types::associated_extensions()
}

pub fn shell_actions() -> &'static [ShellActionProfile] {
    DESKTOP_SHELL_ACTIONS
}

pub fn is_explorer_integration_enabled() -> bool {
    false
}

pub fn register_platform_services(builder: Builder<Wry>) -> Builder<Wry> {
    if is_desktop_actions_enabled() {
        let _ = associated_extensions();
    }

    builder.setup(|app| {
        if let Some(webview_window) = app.get_webview_window("main") {
            let _ = webview_window.with_webview(|platform_webview| {
                install_webview_file_drag_source(platform_webview.inner());
            });
        }

        Ok(())
    })
}

pub fn system_file_icons(entries: &[SystemFileIconRequestEntry]) -> Vec<SystemFileIconDto> {
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

fn linux_system_file_icon_data_url(entry: &SystemFileIconRequestEntry) -> Option<String> {
    let _lookup_key = if entry.is_directory {
        "inode/directory"
    } else {
        entry.path.trim()
    };

    None
}

pub fn start_native_file_drag(
    items: &[NativeFileDragItem],
    stream_provider: NativeFileDragStreamProvider,
) -> Result<NativeFileDragOutcome, NativeFileDragError> {
    if items.is_empty() {
        return Err(NativeFileDragError::new(
            "No archive files are available to drag.",
            None::<String>,
        ));
    }

    let staged_drag = LinuxStagedDrag::create(items, stream_provider)?;
    linux_file_drag::start_drag(staged_drag)
}

pub fn prepare_native_file_drag_uris(
    items: &[NativeFileDragItem],
    stream_provider: NativeFileDragStreamProvider,
) -> Result<Vec<String>, NativeFileDragError> {
    if items.is_empty() {
        return Err(NativeFileDragError::new(
            "No archive files are available to drag.",
            None::<String>,
        ));
    }

    set_prepared_native_drag_payload(items.to_vec(), stream_provider);
    Ok(Vec::new())
}

struct LinuxPreparedDragPayload {
    items: Vec<NativeFileDragItem>,
    stream_provider: NativeFileDragStreamProvider,
    uris: Option<Vec<String>>,
}

fn prepared_native_drag_payload() -> &'static Mutex<Option<LinuxPreparedDragPayload>> {
    static PAYLOAD: OnceLock<Mutex<Option<LinuxPreparedDragPayload>>> = OnceLock::new();
    PAYLOAD.get_or_init(|| Mutex::new(None))
}

fn set_prepared_native_drag_payload(
    items: Vec<NativeFileDragItem>,
    stream_provider: NativeFileDragStreamProvider,
) {
    if let Ok(mut payload) = prepared_native_drag_payload().lock() {
        *payload = Some(LinuxPreparedDragPayload {
            items,
            stream_provider,
            uris: None,
        });
    }
}

fn current_prepared_native_drag_uris() -> Option<Vec<String>> {
    let mut payload = prepared_native_drag_payload().lock().ok()?;
    let payload = payload.as_mut()?;

    if let Some(uris) = payload.uris.clone() {
        return Some(uris);
    }

    let staged_drag =
        LinuxStagedDrag::create(&payload.items, Arc::clone(&payload.stream_provider)).ok()?;
    let uris = staged_drag.file_uris();
    staged_drag.keep_for_file_manager_copy();
    payload.uris = Some(uris.clone());
    Some(uris)
}

fn clear_prepared_native_drag_payload() {
    if let Ok(mut payload) = prepared_native_drag_payload().lock() {
        *payload = None;
    }
}

pub fn clear_prepared_native_file_drag() {
    clear_prepared_native_drag_payload();
}

fn install_webview_file_drag_source(webview: impl IsA<gtk::Widget>) {
    let widget = webview.upcast::<gtk::Widget>();
    widget.drag_source_set(
        gdk::ModifierType::BUTTON1_MASK,
        &[
            gtk::TargetEntry::new(
                "text/uri-list",
                gtk::TargetFlags::OTHER_APP,
                URI_LIST_TARGET_INFO,
            ),
            gtk::TargetEntry::new(
                "x-special/gnome-copied-files",
                gtk::TargetFlags::OTHER_APP,
                GNOME_COPIED_FILES_TARGET_INFO,
            ),
        ],
        gdk::DragAction::COPY,
    );
    widget.drag_source_add_uri_targets();
    widget.drag_source_set_icon_name("zmanager-desktop");

    widget.connect_drag_data_get(move |_source, _context, selection_data, info, _time| {
        let Some(uris) = current_prepared_native_drag_uris() else {
            return;
        };
        if uris.is_empty() {
            return;
        }

        if info == GNOME_COPIED_FILES_TARGET_INFO {
            let payload = format!("copy\n{}\n", uris.join("\n"));
            selection_data.set(
                &gdk::Atom::intern("x-special/gnome-copied-files"),
                8,
                payload.as_bytes(),
            );
            return;
        }

        let uri_refs = uris.iter().map(String::as_str).collect::<Vec<_>>();
        selection_data.set_uris(&uri_refs);
    });

    widget.connect_drag_end(move |_source, _context| {
        clear_prepared_native_drag_payload();
    });
}

struct LinuxStagedDrag {
    root: Option<PathBuf>,
    file_paths: Vec<PathBuf>,
}

impl LinuxStagedDrag {
    fn create(
        items: &[NativeFileDragItem],
        stream_provider: NativeFileDragStreamProvider,
    ) -> Result<Self, NativeFileDragError> {
        let root = unique_drag_root();
        fs::create_dir_all(&root).map_err(|error| {
            NativeFileDragError::new(
                format!("Unable to prepare Linux drag-out folder: {error}"),
                Some("Try extracting normally while the drag-out folder is checked."),
            )
        })?;

        let mut file_paths = Vec::with_capacity(items.len());
        for item in items {
            let relative_path = linux_drag_relative_path(&item.display_path)?;
            let output_path = root.join(relative_path);
            if let Some(parent) = output_path.parent() {
                fs::create_dir_all(parent).map_err(|error| {
                    NativeFileDragError::new(
                        format!("Unable to create drag-out folder: {error}"),
                        Some("Try extracting normally while the drag-out folder is checked."),
                    )
                })?;
            }

            let mut output = fs::File::create(&output_path).map_err(|error| {
                NativeFileDragError::new(
                    format!("Unable to stage drag-out file: {error}"),
                    Some("Try extracting normally while the temporary folder is checked."),
                )
            })?;
            stream_provider(&item.entry_path, &mut output)?;
            file_paths.push(output_path);
        }

        Ok(Self {
            root: Some(root),
            file_paths,
        })
    }

    fn file_uris(&self) -> Vec<String> {
        self.file_paths
            .iter()
            .map(|path| gio::File::for_path(path).uri().to_string())
            .collect()
    }

    fn keep_for_file_manager_copy(mut self) {
        let Some(root) = self.root.take() else {
            return;
        };

        thread::spawn(move || {
            thread::sleep(Duration::from_secs(600));
            let _ = fs::remove_dir_all(root);
        });
    }
}

impl Drop for LinuxStagedDrag {
    fn drop(&mut self) {
        if let Some(root) = self.root.take() {
            let _ = fs::remove_dir_all(root);
        }
    }
}

fn unique_drag_root() -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    std::env::temp_dir().join(format!("zmanager-drag-out-{}-{nonce}", std::process::id()))
}

fn linux_drag_relative_path(display_path: &str) -> Result<PathBuf, NativeFileDragError> {
    let components = display_path
        .split(['/', '\\'])
        .filter(|component| !component.is_empty())
        .collect::<Vec<_>>();

    if components.is_empty() {
        return Err(NativeFileDragError::new(
            "Archive entry has no file name for drag-out.",
            None::<String>,
        ));
    }

    let mut relative_path = PathBuf::new();
    for component in components {
        if component == "." || component == ".." || component.contains('\0') {
            return Err(NativeFileDragError::new(
                format!("Archive entry has an unsafe drag-out path: {display_path}"),
                None::<String>,
            ));
        }
        relative_path.push(component);
    }

    Ok(relative_path)
}

mod linux_file_drag {
    use super::*;

    const URI_LIST_TARGET_INFO: u32 = 1;

    pub fn start_drag(
        staged_drag: LinuxStagedDrag,
    ) -> Result<NativeFileDragOutcome, NativeFileDragError> {
        if gtk::init().is_err() {
            return Err(NativeFileDragError::new(
                "Unable to initialize Linux drag-out.",
                Some("Start ZManager from a graphical desktop session and try again."),
            ));
        }

        let uris = staged_drag
            .file_paths
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
            &[gtk::TargetEntry::new(
                "text/uri-list",
                gtk::TargetFlags::OTHER_APP,
                URI_LIST_TARGET_INFO,
            )],
            gdk::DragAction::COPY,
        );
        source.drag_source_add_uri_targets();
        source.drag_source_set_icon_name("zmanager-desktop");

        let data_uris = uris.clone();
        source.connect_drag_data_get(move |_source, _context, selection_data, _info, _time| {
            let uri_refs = data_uris.iter().map(String::as_str).collect::<Vec<_>>();
            selection_data.set_uris(&uri_refs);
        });

        let drag_finished_for_end = Rc::clone(&drag_finished);
        let drag_failed_for_end = Rc::clone(&drag_failed);
        let dropped_for_end = Rc::clone(&dropped);
        let staged_drag_for_end = Rc::clone(&staged_drag);
        source.connect_drag_end(move |_source, context| {
            let was_dropped = !drag_failed_for_end.get()
                || context.selected_action().contains(gdk::DragAction::COPY);
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

        let target_list = gtk::TargetList::new(&[gtk::TargetEntry::new(
            "text/uri-list",
            gtk::TargetFlags::OTHER_APP,
            URI_LIST_TARGET_INFO,
        )]);
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
}

#[cfg(test)]
mod tests {
    use std::{collections::HashMap, sync::Arc};

    use super::*;

    #[test]
    fn linux_staged_drag_writes_nested_files_and_cleans_up() {
        let payloads = Arc::new(HashMap::from([(
            "docs/readme.txt".to_string(),
            b"drag payload".to_vec(),
        )]));
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

        let staged = LinuxStagedDrag::create(
            &[NativeFileDragItem {
                entry_path: "docs/readme.txt".to_string(),
                display_path: "docs\\readme.txt".to_string(),
                size: Some(12),
                modified_unix_seconds: None,
            }],
            provider,
        )
        .expect("stage drag files");
        let root = staged.root.clone().expect("test staged root");
        let file_path = staged.file_paths[0].clone();

        assert_eq!(
            fs::read(&file_path).expect("read staged file"),
            b"drag payload"
        );
        drop(staged);
        assert!(!root.exists(), "staged drag root should be cleaned up");
    }

    #[test]
    fn linux_drag_relative_path_rejects_traversal() {
        assert!(linux_drag_relative_path("../escape.txt").is_err());
        assert!(linux_drag_relative_path("folder/../../escape.txt").is_err());
    }

    #[test]
    fn linux_prepare_native_drag_uris_writes_payload_and_sets_drag_slot() {
        let provider: NativeFileDragStreamProvider = Arc::new(move |entry_path, writer| {
            assert_eq!(entry_path, "root.txt");
            writer
                .write_all(b"prepared drag payload")
                .map_err(|error| {
                    NativeFileDragError::new(
                        format!("unable to write test payload: {error}"),
                        None::<String>,
                    )
                })?;
            Ok(21)
        });

        let prepared_uris = prepare_native_file_drag_uris(
            &[NativeFileDragItem {
                entry_path: "root.txt".to_string(),
                display_path: "root.txt".to_string(),
                size: Some(21),
                modified_unix_seconds: None,
            }],
            provider,
        )
        .expect("prepare native drag uris");

        assert!(prepared_uris.is_empty());
        let uris = current_prepared_native_drag_uris().expect("lazy GTK drag URI payload");
        let staged_path = gio::File::for_uri(&uris[0])
            .path()
            .expect("prepared URI should resolve to a local staged path");
        assert_eq!(
            fs::read(&staged_path).expect("read staged prepared payload"),
            b"prepared drag payload"
        );

        clear_prepared_native_drag_payload();
        let root = staged_path.parent().expect("staged file root");
        let _ = fs::remove_dir_all(root);
    }
}
