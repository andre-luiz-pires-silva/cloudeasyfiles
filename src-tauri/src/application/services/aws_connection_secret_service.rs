use crate::domain::connection_secrets::{AwsConnectionSecretsInput, AwsConnectionSecretsOutput};
use keyring::{Entry, Error as KeyringError};

const SERVICE_NAME: &str = "CloudEasyFiles.AwsConnection";
const ACCESS_KEY_ACCOUNT: &str = "access-key-id";
const SECRET_KEY_ACCOUNT: &str = "secret-access-key";

pub struct AwsConnectionSecretService;

impl AwsConnectionSecretService {
    pub fn save(input: AwsConnectionSecretsInput) -> Result<(), String> {
        eprintln!(
            "[aws_connection_secret_service] saving AWS credentials for connection_id={}",
            input.connection_id
        );

        let access_key_entry =
            Self::build_entry(&input.connection_id, ACCESS_KEY_ACCOUNT, "save-access-key")?;
        access_key_entry
            .set_password(&input.access_key_id)
            .map_err(|error| Self::map_error("save-access-key", &input.connection_id, error))?;

        let secret_key_entry =
            Self::build_entry(&input.connection_id, SECRET_KEY_ACCOUNT, "save-secret-key")?;

        if let Err(error) = secret_key_entry.set_password(&input.secret_access_key) {
            eprintln!(
                "[aws_connection_secret_service] rolling back access key after secret key failure for connection_id={}",
                input.connection_id
            );

            if let Err(rollback_error) = access_key_entry.delete_credential() {
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
        eprintln!(
            "[aws_connection_secret_service] loading AWS credentials for connection_id={}",
            connection_id
        );

        let access_key_id =
            Self::build_entry(connection_id, ACCESS_KEY_ACCOUNT, "load-access-key")?
                .get_password()
                .map_err(|error| Self::map_error("load-access-key", connection_id, error))?;
        let secret_access_key =
            Self::build_entry(connection_id, SECRET_KEY_ACCOUNT, "load-secret-key")?
                .get_password()
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
        eprintln!(
            "[aws_connection_secret_service] deleting AWS credentials for connection_id={}",
            connection_id
        );
        Self::delete_entry(connection_id, ACCESS_KEY_ACCOUNT)?;
        Self::delete_entry(connection_id, SECRET_KEY_ACCOUNT)?;
        eprintln!(
            "[aws_connection_secret_service] deleted AWS credentials for connection_id={}",
            connection_id
        );
        Ok(())
    }

    fn delete_entry(connection_id: &str, field_name: &str) -> Result<(), String> {
        let entry = Self::build_entry(connection_id, field_name, "delete-entry")?;

        match entry.delete_credential() {
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
    ) -> Result<Entry, String> {
        let account_name = Self::build_account_name(connection_id, field_name);

        eprintln!(
            "[aws_connection_secret_service] building keyring entry for operation={} connection_id={} account_name={}",
            operation, connection_id, account_name
        );

        Entry::new(SERVICE_NAME, &account_name)
            .map_err(|error| Self::map_error("build-entry", connection_id, error))
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
        let no_entry_message =
            AwsConnectionSecretService::map_error("load-access-key", "connection-1", KeyringError::NoEntry);
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
        assert_eq!(
            invalid_message,
            "Attribute service is invalid: blank"
        );
    }
}
