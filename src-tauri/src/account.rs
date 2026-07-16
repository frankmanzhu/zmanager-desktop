use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};
use zmanager_core::auth_client::{
    AUTH_HANDOFF_LIFETIME_SECONDS, TzapHostedAuthEnvironment, TzapHostedAuthLaunchConfig,
    TzapOAuthStateTracker, TzapPendingAuthState,
};
use zmanager_core::device_identity::generate_recipient_encryption_key;
use zmanager_core::local_identity_store::{
    FileTzapLocalIdentityStore, TzapLocalIdentityStore, TzapRecipientEncryptionKeyRecord,
};

use crate::error::{CommandErrorDto, ErrorSeverityDto};

const ACCOUNT_KEY: &str = "default";
const CLIENT_ID: &str = "zmanager-desktop";
const REDIRECT_URI: &str = "zmanager://auth-callback";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccountSnapshotDto {
    pub auth_status: String,
    pub pending_state: Option<String>,
    pub certificates: Vec<AccountCertificateDto>,
    pub recipient_keys: Vec<AccountRecipientKeyDto>,
    pub contacts: Vec<AccountContactDto>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccountCertificateDto {
    pub certificate_id: String,
    pub certificate_sha256: String,
    pub state: String,
    pub assurance_level: String,
    pub not_after_unix_seconds: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccountRecipientKeyDto {
    pub key_id: String,
    pub algorithm: String,
    pub public_key_fingerprint: String,
    pub created_at_unix_seconds: u64,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccountContactDto {
    pub contact_id: String,
    pub display_name: String,
    pub signing_certificate_sha256: String,
    pub recipient_public_key_fingerprint: String,
    pub verification_state: String,
    pub missing_status_caveat: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccountHostedAuthLaunchDto {
    pub launch_url: String,
    pub state: String,
    pub expires_at_unix_seconds: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AccountBeginHostedAuthRequest {
    #[serde(default)]
    pub local_service: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AccountHostedAuthCallbackRequest {
    pub state: String,
    pub result: String,
    pub error_code: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AccountGenerateRecipientKeyRequest {
    pub label: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AccountIdRequest {
    pub id: String,
}

struct AccountRuntimeState {
    pending: Option<TzapPendingAuthState>,
    auth_status: String,
}

pub struct AccountRuntime(Mutex<AccountRuntimeState>);

impl AccountRuntime {
    pub fn new() -> Self {
        Self(Mutex::new(AccountRuntimeState {
            pending: None,
            auth_status: "signedOut".to_string(),
        }))
    }
}

#[tauri::command]
pub fn account_snapshot(
    app: AppHandle,
    runtime: State<'_, AccountRuntime>,
) -> Result<AccountSnapshotDto, CommandErrorDto> {
    snapshot_at(&account_state_dir(&app)?, &runtime)
}

#[tauri::command]
pub fn account_begin_hosted_auth(
    request: AccountBeginHostedAuthRequest,
    runtime: State<'_, AccountRuntime>,
) -> Result<AccountHostedAuthLaunchDto, CommandErrorDto> {
    let now = current_unix_seconds();
    let mut tracker = TzapOAuthStateTracker::new();
    let pending = tracker.begin("hosted", REDIRECT_URI, now);
    let environment = if request.local_service {
        TzapHostedAuthEnvironment::Local
    } else {
        TzapHostedAuthEnvironment::Prod
    };
    let config = TzapHostedAuthLaunchConfig::for_environment(environment, CLIENT_ID, REDIRECT_URI);
    let launch_url = config
        .launch_url(&pending)
        .map_err(|error| account_error("account_auth_launch_failed", error))?;
    let response = AccountHostedAuthLaunchDto {
        launch_url,
        state: pending.state.clone(),
        expires_at_unix_seconds: now.saturating_add(AUTH_HANDOFF_LIFETIME_SECONDS),
    };
    let mut state = runtime.0.lock().expect("account runtime lock poisoned");
    state.pending = Some(pending);
    state.auth_status = "pending".to_string();
    Ok(response)
}

#[tauri::command]
pub fn account_apply_hosted_callback(
    request: AccountHostedAuthCallbackRequest,
    runtime: State<'_, AccountRuntime>,
) -> Result<(), CommandErrorDto> {
    validate_callback(&request)?;
    let mut state = runtime.0.lock().expect("account runtime lock poisoned");
    let Some(pending) = state.pending.as_ref() else {
        return Err(CommandErrorDto::invalid_request(
            "No hosted sign-in is pending",
        ));
    };
    if pending.state != request.state {
        return Err(CommandErrorDto::invalid_request(
            "Hosted sign-in state did not match",
        ));
    }
    state.pending = None;
    state.auth_status = match request.result.as_str() {
        "completed" => "callbackCompleted",
        "cancelled" => "cancelled",
        "failed" => "failed",
        _ => unreachable!(),
    }
    .to_string();
    Ok(())
}

#[tauri::command]
pub fn account_forget(
    app: AppHandle,
    runtime: State<'_, AccountRuntime>,
) -> Result<AccountSnapshotDto, CommandErrorDto> {
    let mut store = FileTzapLocalIdentityStore::new(account_state_dir(&app)?);
    store
        .clear_inventory(ACCOUNT_KEY)
        .map_err(|error| account_error("account_forget_failed", error))?;
    let mut state = runtime.0.lock().expect("account runtime lock poisoned");
    state.pending = None;
    state.auth_status = "signedOut".to_string();
    drop(state);
    snapshot_at(&account_state_dir(&app)?, &runtime)
}

#[tauri::command]
pub fn account_generate_recipient_key(
    request: AccountGenerateRecipientKeyRequest,
    app: AppHandle,
    runtime: State<'_, AccountRuntime>,
) -> Result<AccountSnapshotDto, CommandErrorDto> {
    let root = account_state_dir(&app)?;
    let mut store = FileTzapLocalIdentityStore::new(&root);
    let mut inventory = store
        .load_inventory(ACCOUNT_KEY)
        .map_err(|error| account_error("account_inventory_failed", error))?;
    let material = generate_recipient_encryption_key()
        .map_err(|error| account_error("account_key_generation_failed", error))?;
    let now = current_unix_seconds();
    let key_id = format!(
        "recipient-{}-{}",
        now,
        inventory.recipient_encryption_keys.len() + 1
    );
    inventory
        .recipient_encryption_keys
        .push(TzapRecipientEncryptionKeyRecord {
            key_id,
            algorithm: material.algorithm.to_string(),
            public_key_fingerprint: material.public_key_fingerprint,
            public_key_der: material.public_key_spki_der,
            private_key_der: material.private_key_der,
            created_at_unix_seconds: now,
            label: request.label.filter(|label| !label.trim().is_empty()),
        });
    store
        .save_inventory(ACCOUNT_KEY, inventory)
        .map_err(|error| account_error("account_inventory_save_failed", error))?;
    snapshot_at(&root, &runtime)
}

#[tauri::command]
pub fn account_remove_recipient_key(
    request: AccountIdRequest,
    app: AppHandle,
    runtime: State<'_, AccountRuntime>,
) -> Result<AccountSnapshotDto, CommandErrorDto> {
    mutate_inventory(&account_state_dir(&app)?, &runtime, |inventory| {
        inventory
            .recipient_encryption_keys
            .retain(|key| key.key_id != request.id);
    })
}

#[tauri::command]
pub fn account_remove_contact(
    request: AccountIdRequest,
    app: AppHandle,
    runtime: State<'_, AccountRuntime>,
) -> Result<AccountSnapshotDto, CommandErrorDto> {
    mutate_inventory(&account_state_dir(&app)?, &runtime, |inventory| {
        inventory
            .contacts
            .retain(|contact| contact.contact_id != request.id);
    })
}

fn account_state_dir(app: &AppHandle) -> Result<PathBuf, CommandErrorDto> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("tzap-state"))
        .map_err(|error| account_error("account_state_path_failed", error))
}

fn snapshot_at(
    root: &Path,
    runtime: &AccountRuntime,
) -> Result<AccountSnapshotDto, CommandErrorDto> {
    let store = FileTzapLocalIdentityStore::new(root);
    let inventory = store
        .load_inventory(ACCOUNT_KEY)
        .map_err(|error| account_error("account_inventory_failed", error))?;
    let state = runtime.0.lock().expect("account runtime lock poisoned");
    Ok(AccountSnapshotDto {
        auth_status: state.auth_status.clone(),
        pending_state: state.pending.as_ref().map(|pending| pending.state.clone()),
        certificates: inventory
            .enrolled_certificates
            .into_iter()
            .map(|certificate| AccountCertificateDto {
                certificate_id: certificate.certificate_id,
                certificate_sha256: certificate.certificate_sha256,
                state: certificate.state.as_str().to_string(),
                assurance_level: format!("{:?}", certificate.public_metadata.assurance_level),
                not_after_unix_seconds: certificate.not_after_unix_seconds,
            })
            .collect(),
        recipient_keys: inventory
            .recipient_encryption_keys
            .into_iter()
            .map(|key| AccountRecipientKeyDto {
                key_id: key.key_id,
                algorithm: key.algorithm,
                public_key_fingerprint: key.public_key_fingerprint,
                created_at_unix_seconds: key.created_at_unix_seconds,
                label: key.label,
            })
            .collect(),
        contacts: inventory
            .contacts
            .into_iter()
            .map(|contact| AccountContactDto {
                contact_id: contact.contact_id,
                display_name: contact.display_name,
                signing_certificate_sha256: contact.signing_certificate_sha256,
                recipient_public_key_fingerprint: contact.recipient_public_key_fingerprint,
                verification_state: format!("{:?}", contact.verification_state),
                missing_status_caveat: contact.missing_status_caveat,
            })
            .collect(),
    })
}

fn mutate_inventory(
    root: &Path,
    runtime: &AccountRuntime,
    mutate: impl FnOnce(&mut zmanager_core::local_identity_store::TzapLocalIdentityInventory),
) -> Result<AccountSnapshotDto, CommandErrorDto> {
    let mut store = FileTzapLocalIdentityStore::new(root);
    let mut inventory = store
        .load_inventory(ACCOUNT_KEY)
        .map_err(|error| account_error("account_inventory_failed", error))?;
    mutate(&mut inventory);
    store
        .save_inventory(ACCOUNT_KEY, inventory)
        .map_err(|error| account_error("account_inventory_save_failed", error))?;
    snapshot_at(root, runtime)
}

fn validate_callback(request: &AccountHostedAuthCallbackRequest) -> Result<(), CommandErrorDto> {
    if !(16..=256).contains(&request.state.len())
        || !request
            .state
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
        || !matches!(
            request.result.as_str(),
            "completed" | "cancelled" | "failed"
        )
        || request
            .error_code
            .as_ref()
            .is_some_and(|code| code.len() > 128)
    {
        return Err(CommandErrorDto::invalid_request(
            "Hosted callback is invalid",
        ));
    }
    Ok(())
}

fn account_error(code: &'static str, error: impl std::fmt::Display) -> CommandErrorDto {
    CommandErrorDto::new(
        code,
        error.to_string(),
        None::<String>,
        ErrorSeverityDto::Error,
        true,
    )
}

fn current_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn callback_rejects_unknown_results_and_secret_shaped_state() {
        assert!(
            validate_callback(&AccountHostedAuthCallbackRequest {
                state: "state-1234567890".to_string(),
                result: "completed".to_string(),
                error_code: None,
            })
            .is_ok()
        );
        assert!(
            validate_callback(&AccountHostedAuthCallbackRequest {
                state: "state=access_token=secret".to_string(),
                result: "completed".to_string(),
                error_code: None,
            })
            .is_err()
        );
    }

    #[test]
    fn empty_core_inventory_maps_to_a_secret_free_snapshot() {
        let root =
            std::env::temp_dir().join(format!("zmanager-account-test-{}", current_unix_seconds()));
        let runtime = AccountRuntime::new();
        let snapshot = snapshot_at(&root, &runtime).unwrap();
        assert_eq!(snapshot.auth_status, "signedOut");
        assert!(snapshot.certificates.is_empty());
        assert!(snapshot.recipient_keys.is_empty());
        assert!(snapshot.contacts.is_empty());
        assert!(
            !serde_json::to_string(&snapshot)
                .unwrap()
                .contains("private")
        );
    }
}
