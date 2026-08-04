use keyring::{Entry, Error as KeyringError};
use serde_json::{json, Value};
use zmanager_core::auth_client::{TzapAuthError, TzapBearerToken, TzapSessionRecord, TzapSessionStore};
use zmanager_core::trust::TzapIdentityAssurance;

pub struct Store;

impl TzapSessionStore for Store {
    fn save_session(
        &mut self,
        account_key: &str,
        session: TzapSessionRecord,
    ) -> Result<(), TzapAuthError> {
        Ok(())
    }

    fn load_session(&self, account_key: &str) -> Option<TzapSessionRecord> {
        None
    }

    fn clear_session(&mut self, account_key: &str) -> Result<(), TzapAuthError> {
        Ok(())
    }
}
