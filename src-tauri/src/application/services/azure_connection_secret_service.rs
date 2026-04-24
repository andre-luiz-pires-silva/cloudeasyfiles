use crate::domain::connection_secrets::{
    AzureConnectionSecretsInput, AzureConnectionSecretsOutput,
};
use keyring::{Entry, Error as KeyringError};

const SERVICE_NAME: &str = "CloudEasyFiles.AzureConnection";
const ACCOUNT_KEY_ACCOUNT: &str = "account-key";

pub struct AzureConnectionSecretService;

trait AzureSecretStore {
    fn set_password(
        &self,
        connection_id: &str,
        field_name: &str,
        operation: &str,
        password: &str,
    ) -> Result<(), KeyringError>;

    fn get_password(
        &self,
        connection_id: &str,
        field_name: &str,
        operation: &str,
    ) -> Result<String, KeyringError>;

    fn delete_credential(
        &self,
        connection_id: &str,
        field_name: &str,
        operation: &str,
    ) -> Result<(), KeyringError>;
}

struct KeyringAzureSecretStore;

impl AzureSecretStore for KeyringAzureSecretStore {
    fn set_password(
        &self,
        connection_id: &str,
        field_name: &str,
        operation: &str,
        password: &str,
    ) -> Result<(), KeyringError> {
        AzureConnectionSecretService::build_entry(connection_id, field_name, operation)?
            .set_password(password)
    }

    fn get_password(
        &self,
        connection_id: &str,
        field_name: &str,
        operation: &str,
    ) -> Result<String, KeyringError> {
        AzureConnectionSecretService::build_entry(connection_id, field_name, operation)?
            .get_password()
    }

    fn delete_credential(
        &self,
        connection_id: &str,
        field_name: &str,
        operation: &str,
    ) -> Result<(), KeyringError> {
        AzureConnectionSecretService::build_entry(connection_id, field_name, operation)?
            .delete_credential()
    }
}

impl AzureConnectionSecretService {
    pub fn save(input: AzureConnectionSecretsInput) -> Result<(), String> {
        Self::save_with_store(input, &KeyringAzureSecretStore)
    }

    fn save_with_store<Store: AzureSecretStore>(
        input: AzureConnectionSecretsInput,
        store: &Store,
    ) -> Result<(), String> {
        store
            .set_password(
                &input.connection_id,
                ACCOUNT_KEY_ACCOUNT,
                "save-account-key",
                &input.account_key,
            )
            .map_err(|error| Self::map_error("save-account-key", &input.connection_id, error))
    }

    pub fn load(connection_id: &str) -> Result<AzureConnectionSecretsOutput, String> {
        Self::load_with_store(connection_id, &KeyringAzureSecretStore)
    }

    fn load_with_store<Store: AzureSecretStore>(
        connection_id: &str,
        store: &Store,
    ) -> Result<AzureConnectionSecretsOutput, String> {
        let account_key = store
            .get_password(connection_id, ACCOUNT_KEY_ACCOUNT, "load-account-key")
            .map_err(|error| Self::map_error("load-account-key", connection_id, error))?;

        Ok(AzureConnectionSecretsOutput { account_key })
    }

    pub fn delete(connection_id: &str) -> Result<(), String> {
        Self::delete_with_store(connection_id, &KeyringAzureSecretStore)
    }

    fn delete_with_store<Store: AzureSecretStore>(
        connection_id: &str,
        store: &Store,
    ) -> Result<(), String> {
        match store.delete_credential(connection_id, ACCOUNT_KEY_ACCOUNT, "delete-account-key") {
            Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
            Err(error) => Err(Self::map_error("delete-account-key", connection_id, error)),
        }
    }

    fn build_entry(
        connection_id: &str,
        field_name: &str,
        operation: &str,
    ) -> Result<Entry, KeyringError> {
        let account_name = Self::build_account_name(connection_id, field_name);

        eprintln!(
            "[azure_connection_secret_service] building keyring entry for operation={} connection_id={} account_name={}",
            operation, connection_id, account_name
        );

        Entry::new(SERVICE_NAME, &account_name)
    }

    fn build_account_name(connection_id: &str, field_name: &str) -> String {
        format!("{connection_id}:{field_name}")
    }

    fn map_error(operation: &str, connection_id: &str, error: KeyringError) -> String {
        let message = error.to_string();

        eprintln!(
            "[azure_connection_secret_service] operation={} connection_id={} error={}",
            operation, connection_id, message
        );

        message
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{cell::RefCell, collections::BTreeMap};

    #[derive(Default)]
    struct FakeAzureSecretStore {
        entries: RefCell<BTreeMap<String, String>>,
        delete_attempts: RefCell<Vec<String>>,
        failure: RefCell<Option<(String, KeyringError)>>,
    }

    impl FakeAzureSecretStore {
        fn fail_next(&self, operation: &str, error: KeyringError) {
            *self.failure.borrow_mut() = Some((operation.to_string(), error));
        }

        fn take_failure_for_operation(&self, operation: &str) -> Option<KeyringError> {
            if self
                .failure
                .borrow()
                .as_ref()
                .is_some_and(|(failed_operation, _)| failed_operation == operation)
            {
                return self
                    .failure
                    .borrow_mut()
                    .take()
                    .map(|(_, error)| error);
            }

            None
        }

        fn account_name(connection_id: &str, field_name: &str) -> String {
            AzureConnectionSecretService::build_account_name(connection_id, field_name)
        }
    }

    impl AzureSecretStore for FakeAzureSecretStore {
        fn set_password(
            &self,
            connection_id: &str,
            field_name: &str,
            operation: &str,
            password: &str,
        ) -> Result<(), KeyringError> {
            if let Some(error) = self.take_failure_for_operation(operation) {
                return Err(error);
            }

            self.entries.borrow_mut().insert(
                Self::account_name(connection_id, field_name),
                password.to_string(),
            );

            Ok(())
        }

        fn get_password(
            &self,
            connection_id: &str,
            field_name: &str,
            operation: &str,
        ) -> Result<String, KeyringError> {
            if let Some(error) = self.take_failure_for_operation(operation) {
                return Err(error);
            }

            self.entries
                .borrow()
                .get(&Self::account_name(connection_id, field_name))
                .cloned()
                .ok_or(KeyringError::NoEntry)
        }

        fn delete_credential(
            &self,
            connection_id: &str,
            field_name: &str,
            operation: &str,
        ) -> Result<(), KeyringError> {
            if let Some(error) = self.take_failure_for_operation(operation) {
                return Err(error);
            }

            let account_name = Self::account_name(connection_id, field_name);
            self.delete_attempts.borrow_mut().push(account_name.clone());

            self.entries
                .borrow_mut()
                .remove(&account_name)
                .map(|_| ())
                .ok_or(KeyringError::NoEntry)
        }
    }

    #[test]
    fn builds_stable_account_name_for_account_key() {
        assert_eq!(
            AzureConnectionSecretService::build_account_name("azure-1", ACCOUNT_KEY_ACCOUNT),
            "azure-1:account-key"
        );
    }

    #[test]
    fn maps_keyring_errors_to_user_visible_messages() {
        let no_entry_message = AzureConnectionSecretService::map_error(
            "load-account-key",
            "azure-1",
            KeyringError::NoEntry,
        );
        let too_long_message = AzureConnectionSecretService::map_error(
            "build-entry",
            "azure-1",
            KeyringError::TooLong("account".to_string(), 64),
        );

        assert_eq!(
            no_entry_message,
            "No matching entry found in secure storage"
        );
        assert_eq!(
            too_long_message,
            "Attribute 'account' is longer than platform limit of 64 chars"
        );
    }

    #[test]
    fn saves_and_loads_azure_secret_with_store_adapter() {
        let store = FakeAzureSecretStore::default();

        AzureConnectionSecretService::save_with_store(
            AzureConnectionSecretsInput {
                connection_id: "azure-1".to_string(),
                account_key: "account-key".to_string(),
            },
            &store,
        )
        .expect("save should succeed");

        let loaded = AzureConnectionSecretService::load_with_store("azure-1", &store)
            .expect("load should succeed");

        assert_eq!(loaded.account_key, "account-key");
    }

    #[test]
    fn deletes_azure_secret_idempotently_when_entry_is_missing() {
        let store = FakeAzureSecretStore::default();

        AzureConnectionSecretService::delete_with_store("azure-1", &store)
            .expect("missing entry should still delete successfully");

        assert_eq!(
            store.delete_attempts.borrow().as_slice(),
            &[FakeAzureSecretStore::account_name(
                "azure-1",
                ACCOUNT_KEY_ACCOUNT
            )]
        );
    }

    #[test]
    fn surfaces_azure_secret_store_errors() {
        let store = FakeAzureSecretStore::default();
        store.fail_next(
            "save-account-key",
            KeyringError::Invalid("account-key".to_string(), "rejected".to_string()),
        );

        let save_error = AzureConnectionSecretService::save_with_store(
            AzureConnectionSecretsInput {
                connection_id: "azure-1".to_string(),
                account_key: "account-key".to_string(),
            },
            &store,
        )
        .expect_err("save failure should be surfaced");
        assert_eq!(save_error, "Attribute account-key is invalid: rejected");

        store.fail_next(
            "load-account-key",
            KeyringError::TooLong("account".to_string(), 64),
        );

        let load_error = AzureConnectionSecretService::load_with_store("azure-1", &store)
            .expect_err("load failure should be surfaced");
        assert_eq!(
            load_error,
            "Attribute 'account' is longer than platform limit of 64 chars"
        );
    }

    #[test]
    fn deletes_saved_azure_secret_from_store() {
        let store = FakeAzureSecretStore::default();
        store.entries.borrow_mut().insert(
            FakeAzureSecretStore::account_name("azure-1", ACCOUNT_KEY_ACCOUNT),
            "account-key".to_string(),
        );

        AzureConnectionSecretService::delete_with_store("azure-1", &store)
            .expect("delete should succeed for stored entry");

        assert!(!store
            .entries
            .borrow()
            .contains_key(&FakeAzureSecretStore::account_name(
                "azure-1",
                ACCOUNT_KEY_ACCOUNT
            )));
        assert_eq!(
            store.delete_attempts.borrow().as_slice(),
            &[FakeAzureSecretStore::account_name(
                "azure-1",
                ACCOUNT_KEY_ACCOUNT
            )]
        );
    }

    #[test]
    fn surfaces_delete_errors_for_azure_entries() {
        let store = FakeAzureSecretStore::default();
        store.entries.borrow_mut().insert(
            FakeAzureSecretStore::account_name("azure-1", ACCOUNT_KEY_ACCOUNT),
            "account-key".to_string(),
        );
        store.fail_next(
            "delete-account-key",
            KeyringError::Invalid("account-key".to_string(), "locked".to_string()),
        );

        let error = AzureConnectionSecretService::delete_with_store("azure-1", &store)
            .expect_err("delete failure should be surfaced");

        assert_eq!(error, "Attribute account-key is invalid: locked");
    }
}
