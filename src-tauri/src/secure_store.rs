//! Native OS secure-store adapter for TZAP private material.

use keyring::{Entry, Error as KeyringError};
use zmanager_core::identity_catalog::{
    TzapSecretMaterialStore, TzapSecretPurpose, TzapSecretRef, TzapSecretStoreError,
};
use zmanager_core::secrets::SecretBytes;

const SERVICE_NAME: &str = "org.tzap.zmanager.identity";

#[derive(Debug, Clone)]
pub struct NativeTzapSecretStore {
    account_scope: String,
}

impl NativeTzapSecretStore {
    pub fn new(account_scope: impl Into<String>) -> Result<Self, TzapSecretStoreError> {
        let account_scope = account_scope.into();
        if account_scope.is_empty()
            || account_scope.contains(':')
            || account_scope.contains('/')
            || account_scope.contains('\\')
        {
            return Err(TzapSecretStoreError::InvalidReference);
        }
        Ok(Self { account_scope })
    }

    fn entry(
        &self,
        purpose: TzapSecretPurpose,
        reference: &TzapSecretRef,
    ) -> Result<Entry, TzapSecretStoreError> {
        TzapSecretRef::parse(reference.as_str().to_owned())?;
        Entry::new(
            SERVICE_NAME,
            &format!(
                "{}:{}:{}",
                self.account_scope,
                purpose.as_str(),
                reference.as_str()
            ),
        )
        .map_err(|error| map_keyring_error(error, reference))
    }
}

impl TzapSecretMaterialStore for NativeTzapSecretStore {
    fn put(
        &mut self,
        purpose: TzapSecretPurpose,
        material: SecretBytes,
    ) -> Result<TzapSecretRef, TzapSecretStoreError> {
        if material.is_empty() {
            return Err(TzapSecretStoreError::Corrupt);
        }
        let reference = TzapSecretRef::generate();
        let entry = self.entry(purpose, &reference)?;
        entry
            .set_secret(material.expose_secret())
            .map_err(|error| map_keyring_error(error, &reference))?;
        Ok(reference)
    }

    fn put_at(
        &mut self,
        purpose: TzapSecretPurpose,
        reference: &TzapSecretRef,
        material: SecretBytes,
    ) -> Result<(), TzapSecretStoreError> {
        if material.is_empty() {
            return Err(TzapSecretStoreError::Corrupt);
        }
        let entry = self.entry(purpose, reference)?;
        entry
            .set_secret(material.expose_secret())
            .map_err(|error| map_keyring_error(error, reference))
    }

    fn resolve(
        &self,
        purpose: TzapSecretPurpose,
        reference: &TzapSecretRef,
    ) -> Result<SecretBytes, TzapSecretStoreError> {
        let entry = self.entry(purpose, reference)?;
        entry
            .get_secret()
            .map(SecretBytes::from)
            .map_err(|error| map_keyring_error(error, reference))
    }

    fn delete(
        &mut self,
        purpose: TzapSecretPurpose,
        reference: &TzapSecretRef,
    ) -> Result<(), TzapSecretStoreError> {
        let entry = self.entry(purpose, reference)?;
        entry
            .delete_credential()
            .map_err(|error| map_keyring_error(error, reference))
    }
}

fn map_keyring_error(error: KeyringError, reference: &TzapSecretRef) -> TzapSecretStoreError {
    match error {
        KeyringError::NoEntry => TzapSecretStoreError::Missing {
            reference: reference.clone(),
        },
        KeyringError::BadEncoding(_) | KeyringError::Ambiguous(_) => TzapSecretStoreError::Corrupt,
        KeyringError::NoStorageAccess(_) => TzapSecretStoreError::Locked,
        KeyringError::PlatformFailure(_) => TzapSecretStoreError::Unavailable,
        KeyringError::Invalid(_, _) | KeyringError::TooLong(_, _) => TzapSecretStoreError::Denied,
        _ => TzapSecretStoreError::Unavailable,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn store_scope_rejects_path_or_separator_injection() {
        assert!(NativeTzapSecretStore::new("default").is_ok());
        assert!(NativeTzapSecretStore::new("default:other").is_err());
        assert!(NativeTzapSecretStore::new("../other").is_err());
    }

    #[test]
    fn keyring_error_mapping_is_typed_without_echoing_secret_material() {
        let reference = TzapSecretRef::generate();
        let error = map_keyring_error(
            KeyringError::NoStorageAccess(Box::new(std::io::Error::other("locked"))),
            &reference,
        );
        assert_eq!(error, TzapSecretStoreError::Locked);
        assert!(!format!("{error}").contains(reference.as_str()));
    }
}
