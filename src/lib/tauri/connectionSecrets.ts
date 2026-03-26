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
