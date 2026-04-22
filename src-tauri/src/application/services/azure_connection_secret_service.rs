use crate::domain::connection_secrets::{
    AzureConnectionSecretsInput, AzureConnectionSecretsOutput,
};
use keyring::{Entry, Error as KeyringError};

const SERVICE_NAME: &str = "CloudEasyFiles.AzureConnection";
const ACCOUNT_KEY_ACCOUNT: &str = "account-key";

pub struct AzureConnectionSecretService;

impl AzureConnectionSecretService {
    pub fn save(input: AzureConnectionSecretsInput) -> Result<(), String> {
        Self::build_entry(&input.connection_id, ACCOUNT_KEY_ACCOUNT)?
            .set_password(&input.account_key)
            .map_err(|error| Self::map_error("save-account-key", &input.connection_id, error))
    }

    pub fn load(connection_id: &str) -> Result<AzureConnectionSecretsOutput, String> {
        let account_key = Self::build_entry(connection_id, ACCOUNT_KEY_ACCOUNT)?
            .get_password()
            .map_err(|error| Self::map_error("load-account-key", connection_id, error))?;

        Ok(AzureConnectionSecretsOutput { account_key })
    }

    pub fn delete(connection_id: &str) -> Result<(), String> {
        match Self::build_entry(connection_id, ACCOUNT_KEY_ACCOUNT)?
            .delete_credential()
        {
            Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
            Err(error) => Err(Self::map_error("delete-account-key", connection_id, error)),
        }
    }

    fn build_entry(connection_id: &str, field_name: &str) -> Result<Entry, String> {
        Entry::new(SERVICE_NAME, &Self::build_account_name(connection_id, field_name))
            .map_err(|error| error.to_string())
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
}
