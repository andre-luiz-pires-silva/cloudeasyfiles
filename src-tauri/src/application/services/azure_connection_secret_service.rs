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
        Entry::new(SERVICE_NAME, &format!("{connection_id}:{field_name}"))
            .map_err(|error| error.to_string())
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
