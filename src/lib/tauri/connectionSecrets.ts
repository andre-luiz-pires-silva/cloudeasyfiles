import { invoke } from "@tauri-apps/api/core";

type AwsConnectionSecretsPayload = {
  connectionId: string;
  accessKeyId: string;
  secretAccessKey: string;
};

type AwsConnectionSecretsResponse = {
  accessKeyId: string;
  secretAccessKey: string;
};

type AzureConnectionSecretsPayload = {
  connectionId: string;
  accountKey: string;
};

type AzureConnectionSecretsResponse = {
  accountKey: string;
};

export async function saveAwsConnectionSecrets(payload: AwsConnectionSecretsPayload) {
  await invoke("save_aws_connection_secrets", payload);
}

export async function loadAwsConnectionSecrets(
  connectionId: string
): Promise<AwsConnectionSecretsResponse> {
  return invoke<AwsConnectionSecretsResponse>("load_aws_connection_secrets", { connectionId });
}

export async function deleteAwsConnectionSecrets(connectionId: string) {
  await invoke("delete_aws_connection_secrets", { connectionId });
}

export async function saveAzureConnectionSecrets(payload: AzureConnectionSecretsPayload) {
  await invoke("save_azure_connection_secrets", payload);
}

export async function loadAzureConnectionSecrets(
  connectionId: string
): Promise<AzureConnectionSecretsResponse> {
  return invoke<AzureConnectionSecretsResponse>("load_azure_connection_secrets", { connectionId });
}

export async function deleteAzureConnectionSecrets(connectionId: string) {
  await invoke("delete_azure_connection_secrets", { connectionId });
}
