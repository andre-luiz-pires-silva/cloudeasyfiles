import {
  deleteAwsConnectionSecrets,
  loadAwsConnectionSecrets,
  saveAwsConnectionSecrets
} from "../../../lib/tauri/connectionSecrets";

export class ConnectionSecretsVault {
  async saveAwsSecrets(
    connectionId: string,
    accessKeyId: string,
    secretAccessKey: string
  ): Promise<void> {
    await saveAwsConnectionSecrets({
      connectionId,
      accessKeyId,
      secretAccessKey
    });
  }

  async loadAwsSecrets(connectionId: string) {
    return loadAwsConnectionSecrets(connectionId);
  }

  async deleteAwsSecrets(connectionId: string): Promise<void> {
    await deleteAwsConnectionSecrets(connectionId);
  }
}
