use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write as _;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::Manager;

use crate::error::CommandErrorDto;
use crate::platform::{DefaultHandlerAction, DefaultHandlerEntry, DefaultHandlerRequest};

const STATE_VERSION: u32 = 1;
const STATE_FILE_NAME: &str = "default-handler-restore.json";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DefaultHandlerSnapshot {
    pub entries: Vec<DefaultHandlerEntry>,
    pub can_restore: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RestoreState {
    version: u32,
    bundle_id: String,
    handlers: HashMap<String, String>,
}

#[tauri::command]
pub fn default_handler_status(
    app: tauri::AppHandle,
) -> Result<DefaultHandlerSnapshot, CommandErrorDto> {
    let state_path = restore_state_path(&app)?;
    let request = request(&app, DefaultHandlerAction::Status, None);
    Ok(DefaultHandlerSnapshot {
        entries: crate::platform::default_handlers(&request).map_err(operation_error)?,
        can_restore: state_path.is_file(),
    })
}

#[tauri::command]
pub fn default_handler_set(
    app: tauri::AppHandle,
) -> Result<DefaultHandlerSnapshot, CommandErrorDto> {
    let state_path = restore_state_path(&app)?;
    let status =
        crate::platform::default_handlers(&request(&app, DefaultHandlerAction::Status, None))
            .map_err(operation_error)?;
    if !state_path.exists() {
        let handlers = status
            .iter()
            .filter_map(|entry| {
                entry
                    .handler_bundle_id
                    .as_ref()
                    .filter(|_| !entry.is_current_application)
                    .map(|handler| (entry.file_extension.clone(), handler.clone()))
            })
            .collect();
        write_restore_state(
            &state_path,
            &RestoreState {
                version: STATE_VERSION,
                bundle_id: app.config().identifier.clone(),
                handlers,
            },
        )?;
    }
    let entries =
        crate::platform::default_handlers(&request(&app, DefaultHandlerAction::Set, None))
            .map_err(operation_error)?;
    ensure_no_handler_errors(&entries)?;
    Ok(DefaultHandlerSnapshot {
        entries,
        can_restore: true,
    })
}

#[tauri::command]
pub fn default_handler_restore(
    app: tauri::AppHandle,
) -> Result<DefaultHandlerSnapshot, CommandErrorDto> {
    let state_path = restore_state_path(&app)?;
    let state = read_restore_state(&state_path)?;
    if state.version != STATE_VERSION || state.bundle_id != app.config().identifier {
        return Err(operation_error(
            "Default-handler restore state is incompatible".to_string(),
        ));
    }
    let entries = crate::platform::default_handlers(&request(
        &app,
        DefaultHandlerAction::Restore,
        Some(state.handlers),
    ))
    .map_err(operation_error)?;
    ensure_no_handler_errors(&entries)?;
    fs::remove_file(&state_path).map_err(|error| operation_error(error.to_string()))?;
    Ok(DefaultHandlerSnapshot {
        entries,
        can_restore: false,
    })
}

fn request(
    app: &tauri::AppHandle,
    action: DefaultHandlerAction,
    handlers: Option<HashMap<String, String>>,
) -> DefaultHandlerRequest {
    DefaultHandlerRequest {
        action,
        extensions: crate::archive_file_types::associated_extensions(),
        bundle_id: app.config().identifier.clone(),
        handlers,
    }
}

fn restore_state_path(app: &tauri::AppHandle) -> Result<PathBuf, CommandErrorDto> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(STATE_FILE_NAME))
        .map_err(|error| operation_error(error.to_string()))
}

pub(crate) fn migrate_legacy_restore_state(
    app: &tauri::AppHandle,
    legacy_handlers_by_content_type: &HashMap<String, String>,
) -> Result<bool, CommandErrorDto> {
    let state_path = restore_state_path(app)?;
    if state_path.exists() || legacy_handlers_by_content_type.is_empty() {
        return Ok(false);
    }
    let status =
        crate::platform::default_handlers(&request(app, DefaultHandlerAction::Status, None))
            .map_err(operation_error)?;
    let handlers = map_legacy_handlers_to_extensions(
        &status,
        legacy_handlers_by_content_type,
        &app.config().identifier,
    );
    if handlers.is_empty() {
        return Ok(false);
    }
    write_restore_state(
        &state_path,
        &RestoreState {
            version: STATE_VERSION,
            bundle_id: app.config().identifier.clone(),
            handlers,
        },
    )?;
    Ok(true)
}

fn map_legacy_handlers_to_extensions(
    entries: &[DefaultHandlerEntry],
    legacy_handlers_by_content_type: &HashMap<String, String>,
    current_bundle_id: &str,
) -> HashMap<String, String> {
    entries
        .iter()
        .filter_map(|entry| {
            let content_type = entry.content_type.as_ref()?;
            let handler = legacy_handlers_by_content_type.get(content_type)?;
            (handler != current_bundle_id)
                .then(|| (entry.file_extension.clone(), handler.clone()))
        })
        .collect()
}

fn ensure_no_handler_errors(entries: &[DefaultHandlerEntry]) -> Result<(), CommandErrorDto> {
    let failures = entries
        .iter()
        .filter(|entry| entry.error_code.is_some())
        .map(|entry| entry.file_extension.as_str())
        .collect::<Vec<_>>();
    if failures.is_empty() {
        Ok(())
    } else {
        Err(operation_error(format!(
            "Launch Services rejected default-handler updates for: {}",
            failures.join(", ")
        )))
    }
}

fn write_restore_state(path: &Path, state: &RestoreState) -> Result<(), CommandErrorDto> {
    let parent = path
        .parent()
        .ok_or_else(|| operation_error("Default-handler state path has no parent".to_string()))?;
    fs::create_dir_all(parent).map_err(|error| operation_error(error.to_string()))?;
    let temporary = parent.join(format!(".{STATE_FILE_NAME}.{}.tmp", std::process::id()));
    let bytes = serde_json::to_vec(state).map_err(|error| operation_error(error.to_string()))?;
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)
        .map_err(|error| operation_error(error.to_string()))?;
    crate::platform::set_owner_only_file_permissions(&file)
        .map_err(|error| operation_error(error.to_string()))?;
    if let Err(error) = file.write_all(&bytes).and_then(|_| file.sync_all()) {
        let _ = fs::remove_file(&temporary);
        return Err(operation_error(error.to_string()));
    }
    fs::rename(&temporary, path).map_err(|error| {
        let _ = fs::remove_file(&temporary);
        operation_error(error.to_string())
    })
}

fn read_restore_state(path: &Path) -> Result<RestoreState, CommandErrorDto> {
    let bytes = fs::read(path).map_err(|error| operation_error(error.to_string()))?;
    if bytes.len() > 1_048_576 {
        return Err(operation_error(
            "Default-handler restore state is oversized".to_string(),
        ));
    }
    serde_json::from_slice(&bytes).map_err(|error| operation_error(error.to_string()))
}

fn operation_error(message: String) -> CommandErrorDto {
    CommandErrorDto::operation_failed(message)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restore_state_is_versioned_atomic_and_owner_only() {
        let root = std::env::temp_dir().join(format!(
            "zmanager-default-handler-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        let path = root.join(STATE_FILE_NAME);
        let state = RestoreState {
            version: STATE_VERSION,
            bundle_id: "com.example.zmanager".to_string(),
            handlers: HashMap::from([("zip".to_string(), "com.apple.ArchiveUtility".to_string())]),
        };
        write_restore_state(&path, &state).unwrap();
        let loaded = read_restore_state(&path).unwrap();
        assert_eq!(loaded.version, STATE_VERSION);
        assert_eq!(loaded.handlers["zip"], "com.apple.ArchiveUtility");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt as _;
            assert_eq!(
                fs::metadata(&path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        assert!(root.read_dir().unwrap().all(|entry| {
            !entry
                .unwrap()
                .file_name()
                .to_string_lossy()
                .ends_with(".tmp")
        }));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn legacy_content_type_restore_state_maps_only_known_extensions() {
        let entries = vec![
            DefaultHandlerEntry {
                file_extension: "zip".to_string(),
                content_type: Some("public.zip-archive".to_string()),
                handler_bundle_id: Some("com.frankmanzhu.zmanager".to_string()),
                is_current_application: true,
                error_code: None,
            },
            DefaultHandlerEntry {
                file_extension: "tzap".to_string(),
                content_type: Some("com.frankmanzhu.zmanager.tzap".to_string()),
                handler_bundle_id: Some("com.frankmanzhu.zmanager".to_string()),
                is_current_application: true,
                error_code: None,
            },
        ];
        let legacy = HashMap::from([
            (
                "public.zip-archive".to_string(),
                "com.apple.ArchiveUtility".to_string(),
            ),
            (
                "com.frankmanzhu.zmanager.tzap".to_string(),
                "com.frankmanzhu.zmanager".to_string(),
            ),
            ("public.unknown".to_string(), "com.example.Other".to_string()),
        ]);

        assert_eq!(
            map_legacy_handlers_to_extensions(
                &entries,
                &legacy,
                "com.frankmanzhu.zmanager"
            ),
            HashMap::from([(
                "zip".to_string(),
                "com.apple.ArchiveUtility".to_string()
            )])
        );
    }
}
