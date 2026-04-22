use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AwsConnectionSecretsInput {
    pub connection_id: String,
    pub access_key_id: String,
    pub secret_access_key: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AwsConnectionSecretsOutput {
    pub access_key_id: String,
    pub secret_access_key: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureConnectionSecretsInput {
    pub connection_id: String,
    pub account_key: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureConnectionSecretsOutput {
    pub account_key: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserializes_aws_secret_input_from_camel_case_payload() {
        let input: AwsConnectionSecretsInput = serde_json::from_str(
            r#"{
                "connectionId": "aws-1",
                "accessKeyId": "AKIA",
                "secretAccessKey": "secret"
            }"#,
        )
        .expect("valid AWS secrets input");

        assert_eq!(input.connection_id, "aws-1");
        assert_eq!(input.access_key_id, "AKIA");
        assert_eq!(input.secret_access_key, "secret");
    }

    #[test]
    fn serializes_aws_secret_output_to_camel_case_payload() {
        let output = AwsConnectionSecretsOutput {
            access_key_id: "AKIA".to_string(),
            secret_access_key: "secret".to_string(),
        };

        let value = serde_json::to_value(output).expect("serializable AWS secrets output");

        assert_eq!(value["accessKeyId"], "AKIA");
        assert_eq!(value["secretAccessKey"], "secret");
    }

    #[test]
    fn deserializes_azure_secret_input_from_camel_case_payload() {
        let input: AzureConnectionSecretsInput = serde_json::from_str(
            r#"{
                "connectionId": "azure-1",
                "accountKey": "account-key"
            }"#,
        )
        .expect("valid Azure secrets input");

        assert_eq!(input.connection_id, "azure-1");
        assert_eq!(input.account_key, "account-key");
    }

    #[test]
    fn serializes_azure_secret_output_to_camel_case_payload() {
        let output = AzureConnectionSecretsOutput {
            account_key: "account-key".to_string(),
        };

        let value = serde_json::to_value(output).expect("serializable Azure secrets output");

        assert_eq!(value["accountKey"], "account-key");
    }
}
