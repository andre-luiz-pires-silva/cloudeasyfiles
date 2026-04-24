use crate::domain::connection_secrets::{AwsConnectionSecretsInput, AwsConnectionSecretsOutput};
use keyring::{Entry, Error as KeyringError};

const SERVICE_NAME: &str = "CloudEasyFiles.AwsConnection";
const ACCESS_KEY_ACCOUNT: &str = "access-key-id";
const SECRET_KEY_ACCOUNT: &str = "secret-access-key";

pub struct AwsConnectionSecretService;

trait AwsSecretStore {
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

struct KeyringAwsSecretStore;

impl AwsSecretStore for KeyringAwsSecretStore {
    fn set_password(
        &self,
        connection_id: &str,
        field_name: &str,
        operation: &str,
        password: &str,
    ) -> Result<(), KeyringError> {
        AwsConnectionSecretService::build_entry(connection_id, field_name, operation)?
            .set_password(password)
    }

    fn get_password(
        &self,
        connection_id: &str,
        field_name: &str,
        operation: &str,
    ) -> Result<String, KeyringError> {
        AwsConnectionSecretService::build_entry(connection_id, field_name, operation)?
            .get_password()
    }

    fn delete_credential(
        &self,
        connection_id: &str,
        field_name: &str,
        operation: &str,
    ) -> Result<(), KeyringError> {
        AwsConnectionSecretService::build_entry(connection_id, field_name, operation)?
            .delete_credential()
    }
}

impl AwsConnectionSecretService {
    pub fn save(input: AwsConnectionSecretsInput) -> Result<(), String> {
        Self::save_with_store(input, &KeyringAwsSecretStore)
    }

    fn save_with_store<Store: AwsSecretStore>(
        input: AwsConnectionSecretsInput,
        store: &Store,
    ) -> Result<(), String> {
        eprintln!(
            "[aws_connection_secret_service] saving AWS credentials for connection_id={}",
            input.connection_id
        );

        store
            .set_password(
                &input.connection_id,
                ACCESS_KEY_ACCOUNT,
                "save-access-key",
                &input.access_key_id,
            )
            .map_err(|error| Self::map_error("save-access-key", &input.connection_id, error))?;

        if let Err(error) = store.set_password(
            &input.connection_id,
            SECRET_KEY_ACCOUNT,
            "save-secret-key",
            &input.secret_access_key,
        ) {
            eprintln!(
                "[aws_connection_secret_service] rolling back access key after secret key failure for connection_id={}",
                input.connection_id
            );

            if let Err(rollback_error) =
                store.delete_credential(&input.connection_id, ACCESS_KEY_ACCOUNT, "rollback")
            {
                eprintln!(
                    "[aws_connection_secret_service] rollback failed for connection_id={} error={}",
                    input.connection_id, rollback_error
                );
            }

            return Err(Self::map_error(
                "save-secret-key",
                &input.connection_id,
                error,
            ));
        }

        eprintln!(
            "[aws_connection_secret_service] saved AWS credentials for connection_id={}",
            input.connection_id
        );

        Ok(())
    }

    pub fn load(connection_id: &str) -> Result<AwsConnectionSecretsOutput, String> {
        Self::load_with_store(connection_id, &KeyringAwsSecretStore)
    }

    fn load_with_store<Store: AwsSecretStore>(
        connection_id: &str,
        store: &Store,
    ) -> Result<AwsConnectionSecretsOutput, String> {
        eprintln!(
            "[aws_connection_secret_service] loading AWS credentials for connection_id={}",
            connection_id
        );

        let access_key_id = store
            .get_password(connection_id, ACCESS_KEY_ACCOUNT, "load-access-key")
            .map_err(|error| Self::map_error("load-access-key", connection_id, error))?;
        let secret_access_key = store
            .get_password(connection_id, SECRET_KEY_ACCOUNT, "load-secret-key")
            .map_err(|error| Self::map_error("load-secret-key", connection_id, error))?;

        eprintln!(
            "[aws_connection_secret_service] loaded AWS credentials for connection_id={}",
            connection_id
        );

        Ok(AwsConnectionSecretsOutput {
            access_key_id,
            secret_access_key,
        })
    }

    pub fn delete(connection_id: &str) -> Result<(), String> {
        Self::delete_with_store(connection_id, &KeyringAwsSecretStore)
    }

    fn delete_with_store<Store: AwsSecretStore>(
        connection_id: &str,
        store: &Store,
    ) -> Result<(), String> {
        eprintln!(
            "[aws_connection_secret_service] deleting AWS credentials for connection_id={}",
            connection_id
        );
        Self::delete_entry_with_store(connection_id, ACCESS_KEY_ACCOUNT, store)?;
        Self::delete_entry_with_store(connection_id, SECRET_KEY_ACCOUNT, store)?;
        eprintln!(
            "[aws_connection_secret_service] deleted AWS credentials for connection_id={}",
            connection_id
        );
        Ok(())
    }

    fn delete_entry_with_store<Store: AwsSecretStore>(
        connection_id: &str,
        field_name: &str,
        store: &Store,
    ) -> Result<(), String> {
        match store.delete_credential(connection_id, field_name, "delete-entry") {
            Ok(()) => Ok(()),
            Err(KeyringError::NoEntry) => {
                eprintln!(
                    "[aws_connection_secret_service] no credential entry found during delete for connection_id={} field={}",
                    connection_id, field_name
                );
                Ok(())
            }
            Err(error) => Err(Self::map_error("delete-entry", connection_id, error)),
        }
    }

    fn build_entry(
        connection_id: &str,
        field_name: &str,
        operation: &str,
    ) -> Result<Entry, KeyringError> {
        let account_name = Self::build_account_name(connection_id, field_name);

        eprintln!(
            "[aws_connection_secret_service] building keyring entry for operation={} connection_id={} account_name={}",
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
            "[aws_connection_secret_service] keyring error during operation={} connection_id={} error={}",
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
    struct FakeAwsSecretStore {
        entries: RefCell<BTreeMap<String, String>>,
        delete_attempts: RefCell<Vec<String>>,
        failure: RefCell<Option<(String, KeyringError)>>,
    }

    impl FakeAwsSecretStore {
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
                return self.failure.borrow_mut().take().map(|(_, error)| error);
            }

            None
        }

        fn account_name(connection_id: &str, field_name: &str) -> String {
            AwsConnectionSecretService::build_account_name(connection_id, field_name)
        }
    }

    impl AwsSecretStore for FakeAwsSecretStore {
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
    fn builds_stable_account_names_for_each_aws_secret_field() {
        assert_eq!(
            AwsConnectionSecretService::build_account_name("connection-1", ACCESS_KEY_ACCOUNT),
            "connection-1:access-key-id"
        );
        assert_eq!(
            AwsConnectionSecretService::build_account_name("connection-1", SECRET_KEY_ACCOUNT),
            "connection-1:secret-access-key"
        );
    }

    #[test]
    fn maps_keyring_errors_to_user_visible_messages() {
        let no_entry_message = AwsConnectionSecretService::map_error(
            "load-access-key",
            "connection-1",
            KeyringError::NoEntry,
        );
        let too_long_message = AwsConnectionSecretService::map_error(
            "build-entry",
            "connection-1",
            KeyringError::TooLong("account".to_string(), 128),
        );
        let invalid_message = AwsConnectionSecretService::map_error(
            "build-entry",
            "connection-1",
            KeyringError::Invalid("service".to_string(), "blank".to_string()),
        );

        assert_eq!(
            no_entry_message,
            "No matching entry found in secure storage"
        );
        assert_eq!(
            too_long_message,
            "Attribute 'account' is longer than platform limit of 128 chars"
        );
        assert_eq!(invalid_message, "Attribute service is invalid: blank");
    }

    #[test]
    fn saves_and_loads_aws_secrets_with_store_adapter() {
        let store = FakeAwsSecretStore::default();

        AwsConnectionSecretService::save_with_store(
            AwsConnectionSecretsInput {
                connection_id: "connection-1".to_string(),
                access_key_id: "access-key".to_string(),
                secret_access_key: "secret-key".to_string(),
            },
            &store,
        )
        .expect("save should succeed");

        let loaded = AwsConnectionSecretService::load_with_store("connection-1", &store)
            .expect("load should succeed");

        assert_eq!(loaded.access_key_id, "access-key");
        assert_eq!(loaded.secret_access_key, "secret-key");
    }

    #[test]
    fn rolls_back_access_key_when_secret_key_save_fails() {
        let store = FakeAwsSecretStore::default();
        store.fail_next(
            "save-secret-key",
            KeyringError::Invalid("secret-access-key".to_string(), "rejected".to_string()),
        );

        let error = AwsConnectionSecretService::save_with_store(
            AwsConnectionSecretsInput {
                connection_id: "connection-1".to_string(),
                access_key_id: "access-key".to_string(),
                secret_access_key: "secret-key".to_string(),
            },
            &store,
        )
        .expect_err("secret key failure should fail the save");

        assert_eq!(error, "Attribute secret-access-key is invalid: rejected");
        assert!(!store
            .entries
            .borrow()
            .contains_key(&FakeAwsSecretStore::account_name(
                "connection-1",
                ACCESS_KEY_ACCOUNT
            )));
        assert_eq!(
            store.delete_attempts.borrow().as_slice(),
            &[FakeAwsSecretStore::account_name(
                "connection-1",
                ACCESS_KEY_ACCOUNT
            )]
        );
    }

    #[test]
    fn deletes_aws_secrets_idempotently_when_entries_are_missing() {
        let store = FakeAwsSecretStore::default();

        AwsConnectionSecretService::delete_with_store("connection-1", &store)
            .expect("missing entries should still delete successfully");

        assert_eq!(
            store.delete_attempts.borrow().as_slice(),
            &[
                FakeAwsSecretStore::account_name("connection-1", ACCESS_KEY_ACCOUNT),
                FakeAwsSecretStore::account_name("connection-1", SECRET_KEY_ACCOUNT),
            ]
        );
    }

    #[test]
    fn surfaces_aws_secret_store_load_errors() {
        let store = FakeAwsSecretStore::default();
        store.fail_next(
            "load-access-key",
            KeyringError::TooLong("account".to_string(), 128),
        );

        let error = AwsConnectionSecretService::load_with_store("connection-1", &store)
            .expect_err("load failure should be surfaced");

        assert_eq!(
            error,
            "Attribute 'account' is longer than platform limit of 128 chars"
        );
    }

    struct RollbackFailingAwsSecretStore;

    impl AwsSecretStore for RollbackFailingAwsSecretStore {
        fn set_password(
            &self,
            _connection_id: &str,
            field_name: &str,
            operation: &str,
            _password: &str,
        ) -> Result<(), KeyringError> {
            if operation == "save-secret-key" {
                return Err(KeyringError::Invalid(
                    field_name.to_string(),
                    "rejected".to_string(),
                ));
            }

            Ok(())
        }

        fn get_password(
            &self,
            _connection_id: &str,
            _field_name: &str,
            _operation: &str,
        ) -> Result<String, KeyringError> {
            unreachable!("get_password should not be called in rollback failure test")
        }

        fn delete_credential(
            &self,
            _connection_id: &str,
            field_name: &str,
            operation: &str,
        ) -> Result<(), KeyringError> {
            assert_eq!(operation, "rollback");

            Err(KeyringError::Invalid(
                field_name.to_string(),
                "delete rejected".to_string(),
            ))
        }
    }

    #[test]
    fn preserves_secret_key_error_when_rollback_also_fails() {
        let error = AwsConnectionSecretService::save_with_store(
            AwsConnectionSecretsInput {
                connection_id: "connection-1".to_string(),
                access_key_id: "access-key".to_string(),
                secret_access_key: "secret-key".to_string(),
            },
            &RollbackFailingAwsSecretStore,
        )
        .expect_err("secret key save should still surface its original error");

        assert_eq!(error, "Attribute secret-access-key is invalid: rejected");
    }

    #[test]
    fn surfaces_secret_key_load_errors_after_access_key_succeeds() {
        let store = FakeAwsSecretStore::default();
        store.entries.borrow_mut().insert(
            FakeAwsSecretStore::account_name("connection-1", ACCESS_KEY_ACCOUNT),
            "access-key".to_string(),
        );
        store.fail_next(
            "load-secret-key",
            KeyringError::Invalid("secret-access-key".to_string(), "locked".to_string()),
        );

        let error = AwsConnectionSecretService::load_with_store("connection-1", &store)
            .expect_err("secret key load failure should be surfaced");

        assert_eq!(error, "Attribute secret-access-key is invalid: locked");
    }

    #[test]
    fn surfaces_delete_errors_for_existing_aws_entries() {
        let store = FakeAwsSecretStore::default();
        store.entries.borrow_mut().insert(
            FakeAwsSecretStore::account_name("connection-1", ACCESS_KEY_ACCOUNT),
            "access-key".to_string(),
        );
        store.fail_next(
            "delete-entry",
            KeyringError::Invalid("access-key-id".to_string(), "locked".to_string()),
        );

        let error = AwsConnectionSecretService::delete_with_store("connection-1", &store)
            .expect_err("delete failure should be surfaced");

        assert_eq!(error, "Attribute access-key-id is invalid: locked");
    }
}
