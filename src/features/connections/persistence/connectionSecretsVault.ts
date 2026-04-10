import {
  deleteAzureConnectionSecrets,
  deleteAwsConnectionSecrets,
  loadAzureConnectionSecrets,
  loadAwsConnectionSecrets,
  saveAzureConnectionSecrets,
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

  async saveAzureSecrets(connectionId: string, accountKey: string): Promise<void> {
    await saveAzureConnectionSecrets({
      connectionId,
      accountKey
    });
  }

  async loadAzureSecrets(connectionId: string) {
    return loadAzureConnectionSecrets(connectionId);
  }

  async deleteAzureSecrets(connectionId: string): Promise<void> {
    await deleteAzureConnectionSecrets(connectionId);
  }
}
