use std::collections::{HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::Manager;
use zmanager_core::local_identity_store::{
    FileTzapLocalIdentityStore, TzapLocalIdentityInventory, TzapLocalIdentityStore,
};

use crate::error::CommandErrorDto;
use crate::platform::{
    LegacyRegistrationReconcileRequest, LegacyReplacementMigrationRequest,
    LegacyReplacementMigrationSnapshot, LegacyReplacementPreferences,
    ReplacementMigrationDiagnostic,
};

const SCHEMA_VERSION: u32 = 1;
const STATE_FILE_NAME: &str = "replacement-migration-v1.json";
const LEGACY_BUNDLE_ID: &str = "com.frankmanzhu.zmanager";
const ACCOUNT_KEY: &str = "default";
const MAX_STATE_BYTES: usize = 1_048_576;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplacementMigrationPrepareResponse {
    pub schema_version: u32,
    pub completed: bool,
    pub requires_completion: bool,
    pub preferences: LegacyReplacementPreferences,
    pub diagnostics: Vec<ReplacementMigrationDiagnostic>,
    pub rollback: ReplacementMigrationRollback,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplacementMigrationRollback {
    pub legacy_state_retained: bool,
    pub reversible_keys: Vec<String>,
    pub irreversible_operations: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ReplacementMigrationCompleteRequest {
    pub schema_version: u32,
    pub applied_preference_keys: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MigrationState {
    version: u32,
    started_at_unix_seconds: u64,
    completed_at_unix_seconds: Option<u64>,
    steps: MigrationSteps,
    backup: MigrationBackup,
    applied_preference_keys: Vec<String>,
    diagnostics: Vec<ReplacementMigrationDiagnostic>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MigrationSteps {
    native_state_read: bool,
    default_handler_restore_migrated: bool,
    identity_inventory_migrated: bool,
    stale_preview_roots_cleaned: bool,
    registrations_reconciled: bool,
    frontend_preferences_applied: bool,
}

impl MigrationSteps {
    fn complete(&self) -> bool {
        self.native_state_read
            && self.default_handler_restore_migrated
            && self.identity_inventory_migrated
            && self.stale_preview_roots_cleaned
            && self.registrations_reconciled
            && self.frontend_preferences_applied
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct MigrationBackup {
    preferences: LegacyReplacementPreferences,
    default_handler_restore: HashMap<String, String>,
    registration_owners: HashMap<String, String>,
    legacy_account_state_directory: Option<String>,
    stale_preview_roots: Vec<String>,
    legacy_registration_paths: Vec<String>,
}

#[tauri::command]
pub fn replacement_migration_prepare(
    app: tauri::AppHandle,
) -> Result<ReplacementMigrationPrepareResponse, CommandErrorDto> {
    if crate::native_integration::capability_applicability(
        crate::platform::integration_profile().platform,
        crate::native_integration::NativeCapabilityId::ReplacementMigration,
    ) == crate::native_integration::NativeCapabilityApplicability::NotApplicable
    {
        return Ok(ReplacementMigrationPrepareResponse {
            schema_version: SCHEMA_VERSION,
            completed: true,
            requires_completion: false,
            preferences: LegacyReplacementPreferences::default(),
            diagnostics: Vec::new(),
            rollback: rollback_summary(Vec::new()),
        });
    }
    let data_directory = app
        .path()
        .app_data_dir()
        .map_err(|error| migration_error("migration_state_path_failed", error))?;
    let state_path = data_directory.join(STATE_FILE_NAME);
    match load_state(&state_path) {
        LoadedState::Current(state) if state.completed_at_unix_seconds.is_some() => {
            return Ok(response(&state, true));
        }
        LoadedState::Future(version) => {
            return Ok(ReplacementMigrationPrepareResponse {
                schema_version: version,
                completed: true,
                requires_completion: false,
                preferences: LegacyReplacementPreferences::default(),
                diagnostics: vec![diagnostic("migration.state", "future_version")],
                rollback: rollback_summary(Vec::new()),
            });
        }
        _ => {}
    }

    let mut state = match load_state(&state_path) {
        LoadedState::Current(state) => *state,
        LoadedState::Missing => initialize_state(),
        LoadedState::Corrupt => {
            preserve_unreadable_state(&state_path, "corrupt")?;
            let mut state = initialize_state();
            state
                .diagnostics
                .push(diagnostic("migration.state", "corrupt"));
            state
        }
        LoadedState::Future(_) => unreachable!("future state returned above"),
    };

    if !state.steps.native_state_read {
        let snapshot = read_legacy_snapshot(&app);
        state.backup = MigrationBackup {
            preferences: snapshot.preferences,
            default_handler_restore: snapshot.default_handler_restore,
            registration_owners: snapshot.registration_owners,
            legacy_account_state_directory: snapshot.legacy_account_state_directory,
            stale_preview_roots: snapshot.stale_preview_roots,
            legacy_registration_paths: snapshot.legacy_registration_paths,
        };
        state
            .diagnostics
            .extend(sanitize_diagnostics(snapshot.diagnostics));
        state.steps.native_state_read = true;
        write_state(&state_path, &state)?;
    }

    if !state.steps.stale_preview_roots_cleaned {
        cleanup_stale_preview_roots(&state.backup.stale_preview_roots, &mut state.diagnostics);
        state.steps.stale_preview_roots_cleaned = true;
        write_state(&state_path, &state)?;
    }

    if !state.steps.default_handler_restore_migrated {
        if let Err(error) = crate::default_handlers::migrate_legacy_restore_state(
            &app,
            &state.backup.default_handler_restore,
        ) {
            state
                .diagnostics
                .push(diagnostic("defaultOpenerSavedPreviousHandlers", error.code));
        }
        state.steps.default_handler_restore_migrated = true;
        write_state(&state_path, &state)?;
    }

    if !state.steps.identity_inventory_migrated {
        let new_root = data_directory.join("tzap-state");
        if let Some(legacy_root) = state.backup.legacy_account_state_directory.as_deref()
            && let Err(code) = migrate_identity_inventory(Path::new(legacy_root), &new_root)
        {
            state
                .diagnostics
                .push(diagnostic("account.identityInventory", code));
        }
        state.steps.identity_inventory_migrated = true;
        write_state(&state_path, &state)?;
    }

    if !state.steps.registrations_reconciled {
        if !state.backup.legacy_registration_paths.is_empty() {
            let request = LegacyRegistrationReconcileRequest {
                schema_version: SCHEMA_VERSION,
                legacy_bundle_id: LEGACY_BUNDLE_ID.to_string(),
                current_application_path: current_application_path(),
                legacy_application_paths: state.backup.legacy_registration_paths.clone(),
            };
            match crate::platform::reconcile_legacy_registrations(&request) {
                Ok(diagnostics) => state.diagnostics.extend(sanitize_diagnostics(diagnostics)),
                Err(_) => state
                    .diagnostics
                    .push(diagnostic("registration.reconcile", "operation_failed")),
            }
        }
        state.steps.registrations_reconciled = true;
        write_state(&state_path, &state)?;
    }

    Ok(response(&state, false))
}

#[tauri::command]
pub fn replacement_migration_complete(
    app: tauri::AppHandle,
    request: ReplacementMigrationCompleteRequest,
) -> Result<(), CommandErrorDto> {
    if request.schema_version != SCHEMA_VERSION
        || request.applied_preference_keys.len() > 16
        || request
            .applied_preference_keys
            .iter()
            .any(|key| !allowed_preference_keys().contains(key.as_str()))
    {
        return Err(CommandErrorDto::invalid_request(
            "Replacement migration completion is invalid",
        ));
    }
    let state_path = app
        .path()
        .app_data_dir()
        .map(|path| path.join(STATE_FILE_NAME))
        .map_err(|error| migration_error("migration_state_path_failed", error))?;
    let mut state = if let LoadedState::Current(state) = load_state(&state_path) {
        *state
    } else {
        return Err(CommandErrorDto::invalid_request(
            "Replacement migration was not prepared",
        ));
    };
    state.applied_preference_keys = request.applied_preference_keys;
    state.steps.frontend_preferences_applied = true;
    if state.steps.complete() {
        state.completed_at_unix_seconds = Some(now_unix_seconds());
    }
    write_state(&state_path, &state)
}

fn initialize_state() -> MigrationState {
    MigrationState {
        version: SCHEMA_VERSION,
        started_at_unix_seconds: now_unix_seconds(),
        completed_at_unix_seconds: None,
        steps: MigrationSteps::default(),
        backup: MigrationBackup {
            preferences: LegacyReplacementPreferences::default(),
            default_handler_restore: HashMap::new(),
            registration_owners: HashMap::new(),
            legacy_account_state_directory: None,
            stale_preview_roots: Vec::new(),
            legacy_registration_paths: Vec::new(),
        },
        applied_preference_keys: Vec::new(),
        diagnostics: Vec::new(),
    }
}

fn read_legacy_snapshot(app: &tauri::AppHandle) -> LegacyReplacementMigrationSnapshot {
    let home = app.path().home_dir().unwrap_or_else(|_| PathBuf::from("/"));
    let legacy_account = home
        .join("Library/Application Support/ZManager/tzap-state")
        .to_string_lossy()
        .into_owned();
    let candidates = vec![
        "/Applications/ZManager.app".to_string(),
        home.join("Applications/ZManager.app")
            .to_string_lossy()
            .into_owned(),
    ];
    let request = LegacyReplacementMigrationRequest {
        schema_version: SCHEMA_VERSION,
        legacy_bundle_id: LEGACY_BUNDLE_ID.to_string(),
        current_application_path: current_application_path(),
        legacy_account_state_directory: legacy_account,
        temporary_directory: std::env::temp_dir().to_string_lossy().into_owned(),
        legacy_application_candidates: candidates,
    };
    crate::platform::read_replacement_migration(&request).unwrap_or_else(|_| {
        let mut snapshot = LegacyReplacementMigrationSnapshot::empty();
        snapshot
            .diagnostics
            .push(diagnostic("migration.nativeReader", "operation_failed"));
        snapshot
    })
}

fn current_application_path() -> String {
    let Ok(executable) = std::env::current_exe() else {
        return String::new();
    };
    executable
        .ancestors()
        .find(|path| path.extension().is_some_and(|extension| extension == "app"))
        .unwrap_or(executable.as_path())
        .to_string_lossy()
        .into_owned()
}

fn migrate_identity_inventory(legacy_root: &Path, new_root: &Path) -> Result<(), &'static str> {
    let legacy_store = FileTzapLocalIdentityStore::new(legacy_root);
    let legacy = legacy_store
        .load_inventory(ACCOUNT_KEY)
        .map_err(|_| "legacy_read_failed")?;
    if inventory_is_empty(&legacy) {
        return Ok(());
    }
    let new_store = FileTzapLocalIdentityStore::new(new_root);
    let current = new_store
        .load_inventory(ACCOUNT_KEY)
        .map_err(|_| "current_read_failed")?;
    if !inventory_is_empty(&current) {
        return Ok(());
    }
    let mut new_store = FileTzapLocalIdentityStore::new(new_root);
    new_store
        .save_inventory(ACCOUNT_KEY, legacy)
        .map_err(|_| "current_write_failed")
}

fn inventory_is_empty(inventory: &TzapLocalIdentityInventory) -> bool {
    inventory == &TzapLocalIdentityInventory::empty()
}

fn cleanup_stale_preview_roots(
    roots: &[String],
    diagnostics: &mut Vec<ReplacementMigrationDiagnostic>,
) {
    let temporary = std::env::temp_dir();
    for root in roots.iter().take(128) {
        let path = Path::new(root);
        let safe = path.starts_with(&temporary)
            && path
                .file_name()
                .is_some_and(|name| name.to_string_lossy().starts_with("zmanager-preview-"))
            && fs::symlink_metadata(path)
                .is_ok_and(|metadata| metadata.is_dir() && !metadata.file_type().is_symlink());
        if safe && fs::remove_dir_all(path).is_err() {
            diagnostics.push(diagnostic("previewRoots", "cleanup_failed"));
        }
    }
}

fn response(state: &MigrationState, completed: bool) -> ReplacementMigrationPrepareResponse {
    ReplacementMigrationPrepareResponse {
        schema_version: SCHEMA_VERSION,
        completed,
        requires_completion: !completed,
        preferences: if completed {
            LegacyReplacementPreferences::default()
        } else {
            state.backup.preferences.clone()
        },
        diagnostics: state.diagnostics.clone(),
        rollback: rollback_summary(state.applied_preference_keys.clone()),
    }
}

fn rollback_summary(reversible_keys: Vec<String>) -> ReplacementMigrationRollback {
    ReplacementMigrationRollback {
        legacy_state_retained: true,
        reversible_keys,
        irreversible_operations: vec!["stalePreviewRoots".to_string()],
    }
}

enum LoadedState {
    Missing,
    Current(Box<MigrationState>),
    Future(u32),
    Corrupt,
}

fn load_state(path: &Path) -> LoadedState {
    let bytes = match fs::read(path) {
        Ok(bytes) if bytes.len() <= MAX_STATE_BYTES => bytes,
        Ok(_) => return LoadedState::Corrupt,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return LoadedState::Missing,
        Err(_) => return LoadedState::Corrupt,
    };
    let Ok(value) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
        return LoadedState::Corrupt;
    };
    let Some(version) = value.get("version").and_then(serde_json::Value::as_u64) else {
        return LoadedState::Corrupt;
    };
    if version > u64::from(SCHEMA_VERSION) {
        return LoadedState::Future(version.min(u64::from(u32::MAX)) as u32);
    }
    if version != u64::from(SCHEMA_VERSION) {
        return LoadedState::Corrupt;
    }
    serde_json::from_value(value)
        .map(|s| LoadedState::Current(Box::new(s)))
        .unwrap_or(LoadedState::Corrupt)
}

fn write_state(path: &Path, state: &MigrationState) -> Result<(), CommandErrorDto> {
    let parent = path
        .parent()
        .ok_or_else(|| migration_error("migration_state_path_failed", "missing parent"))?;
    fs::create_dir_all(parent)
        .map_err(|error| migration_error("migration_state_write_failed", error))?;
    let temporary = parent.join(format!(".{STATE_FILE_NAME}.{}.tmp", std::process::id()));
    let bytes = serde_json::to_vec_pretty(state)
        .map_err(|error| migration_error("migration_state_write_failed", error))?;
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)
        .map_err(|error| migration_error("migration_state_write_failed", error))?;
    crate::platform::set_owner_only_file_permissions(&file)
        .map_err(|error| migration_error("migration_state_write_failed", error))?;
    if let Err(error) = file.write_all(&bytes).and_then(|_| file.sync_all()) {
        let _ = fs::remove_file(&temporary);
        return Err(migration_error("migration_state_write_failed", error));
    }
    fs::rename(&temporary, path).map_err(|error| {
        let _ = fs::remove_file(&temporary);
        migration_error("migration_state_write_failed", error)
    })
}

fn preserve_unreadable_state(path: &Path, reason: &str) -> Result<(), CommandErrorDto> {
    if !path.exists() {
        return Ok(());
    }
    let backup = path.with_file_name(format!(
        "replacement-migration-v1.{reason}.{}.{}.json",
        now_unix_seconds(),
        std::process::id()
    ));
    if backup.exists() {
        return Err(migration_error(
            "migration_state_preserve_failed",
            "preservation path already exists",
        ));
    }
    fs::rename(path, backup)
        .map_err(|error| migration_error("migration_state_preserve_failed", error))
}

fn sanitize_diagnostics(
    diagnostics: Vec<ReplacementMigrationDiagnostic>,
) -> Vec<ReplacementMigrationDiagnostic> {
    diagnostics
        .into_iter()
        .take(128)
        .filter(|item| valid_diagnostic_field(&item.key) && valid_diagnostic_field(&item.code))
        .collect()
}

fn valid_diagnostic_field(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
}

fn diagnostic(key: &str, code: &str) -> ReplacementMigrationDiagnostic {
    ReplacementMigrationDiagnostic {
        key: key.to_string(),
        code: code.to_string(),
    }
}

fn allowed_preference_keys() -> HashSet<&'static str> {
    HashSet::from([
        "defaultArchiveFormat",
        "defaultCleanSourceEnabled",
        "defaultOutputLocation",
        "customOutputFolderPath",
        "defaultExtractionBehavior",
        "customExtractFolderPath",
        "previewCleanupPolicy",
    ])
}

fn migration_error(code: &'static str, error: impl std::fmt::Display) -> CommandErrorDto {
    CommandErrorDto::operation_failed(format!("{code}: {error}"))
}

fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use zmanager_core::device_identity::generate_recipient_encryption_key;
    use zmanager_core::local_identity_store::TzapRecipientEncryptionKeyRecord;

    fn temporary_root(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "zmanager-replacement-migration-{label}-{}-{}",
            std::process::id(),
            now_unix_seconds()
        ))
    }

    #[test]
    fn state_is_versioned_atomic_owner_only_and_retryable() {
        let root = temporary_root("state");
        let path = root.join(STATE_FILE_NAME);
        let mut state = MigrationState {
            version: SCHEMA_VERSION,
            started_at_unix_seconds: 1,
            completed_at_unix_seconds: None,
            steps: MigrationSteps {
                native_state_read: true,
                ..MigrationSteps::default()
            },
            backup: MigrationBackup {
                preferences: LegacyReplacementPreferences::default(),
                default_handler_restore: HashMap::new(),
                registration_owners: HashMap::new(),
                legacy_account_state_directory: None,
                stale_preview_roots: Vec::new(),
                legacy_registration_paths: Vec::new(),
            },
            applied_preference_keys: Vec::new(),
            diagnostics: Vec::new(),
        };
        write_state(&path, &state).unwrap();
        let reloaded = if let LoadedState::Current(state) = load_state(&path) {
            *state
        } else {
            panic!("expected current state")
        };
        assert!(reloaded.steps.native_state_read);
        assert!(!reloaded.steps.complete());
        state.steps = MigrationSteps {
            native_state_read: true,
            default_handler_restore_migrated: true,
            identity_inventory_migrated: true,
            stale_preview_roots_cleaned: true,
            registrations_reconciled: true,
            frontend_preferences_applied: true,
        };
        assert!(state.steps.complete());
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
    fn future_and_corrupt_state_do_not_parse_as_current() {
        let root = temporary_root("invalid");
        fs::create_dir_all(&root).unwrap();
        let path = root.join(STATE_FILE_NAME);
        fs::write(&path, br#"{"version":99}"#).unwrap();
        assert!(matches!(load_state(&path), LoadedState::Future(99)));
        fs::write(&path, b"not json").unwrap();
        assert!(matches!(load_state(&path), LoadedState::Corrupt));
        preserve_unreadable_state(&path, "corrupt").unwrap();
        assert!(!path.exists());
        let preserved = root
            .read_dir()
            .unwrap()
            .filter_map(Result::ok)
            .find(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .starts_with("replacement-migration-v1.corrupt.")
            });
        assert_eq!(fs::read(preserved.unwrap().path()).unwrap(), b"not json");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn core_owned_inventory_migration_preserves_secrets_and_new_state_wins() {
        let root = temporary_root("identity");
        let legacy = root.join("legacy");
        let current = root.join("current");
        let legacy_inventory = inventory_with_key("legacy", 7);
        FileTzapLocalIdentityStore::new(&legacy)
            .save_inventory(ACCOUNT_KEY, legacy_inventory.clone())
            .unwrap();
        migrate_identity_inventory(&legacy, &current).unwrap();
        assert_eq!(
            FileTzapLocalIdentityStore::new(&current)
                .load_inventory(ACCOUNT_KEY)
                .unwrap(),
            legacy_inventory
        );

        let current_inventory = inventory_with_key("current", 8);
        FileTzapLocalIdentityStore::new(&current)
            .save_inventory(ACCOUNT_KEY, current_inventory.clone())
            .unwrap();
        migrate_identity_inventory(&legacy, &current).unwrap();
        assert_eq!(
            FileTzapLocalIdentityStore::new(&current)
                .load_inventory(ACCOUNT_KEY)
                .unwrap(),
            current_inventory
        );
        let _ = fs::remove_dir_all(root);
    }

    fn inventory_with_key(label: &str, created_at: u64) -> TzapLocalIdentityInventory {
        let material = generate_recipient_encryption_key().unwrap();
        let mut inventory = TzapLocalIdentityInventory::empty();
        inventory
            .recipient_encryption_keys
            .push(TzapRecipientEncryptionKeyRecord {
                key_id: format!("recipient-{created_at}"),
                algorithm: material.algorithm.to_string(),
                public_key_fingerprint: material.public_key_fingerprint,
                public_key_der: material.public_key_spki_der,
                private_key_der: material.private_key_der,
                created_at_unix_seconds: created_at,
                label: Some(label.to_string()),
            });
        inventory
    }

    #[test]
    fn diagnostics_reject_values_and_keep_normalized_keys_only() {
        let sanitized = sanitize_diagnostics(vec![
            diagnostic("previewRoots", "cleanup_failed"),
            diagnostic("secret", "value with spaces"),
            diagnostic("access_token=secret", "failed"),
        ]);
        assert_eq!(
            sanitized,
            vec![diagnostic("previewRoots", "cleanup_failed")]
        );
    }
}
