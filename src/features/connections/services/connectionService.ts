import type { AwsConnectionDraft, AzureConnectionDraft, SavedConnectionSummary } from "../models";
import { ConnectionMetadataStore } from "../persistence/connectionMetadataStore";
import { ConnectionSecretsVault } from "../persistence/connectionSecretsVault";
import type { AzureUploadTier } from "../azureUploadTiers";
import { AwsConnectionService } from "./awsConnectionService";
import { AzureConnectionService } from "./azureConnectionService";
import { sortConnections } from "./connectionNormalization";

export {
  normalizeAzureAuthenticationMethod,
  normalizeConnectionName,
  normalizeRestrictedBucketName,
  normalizeStorageAccountName
} from "./connectionNormalization";
export {
  isConnectionNameFormatValid,
  isRestrictedBucketNameFormatValid,
  isStorageAccountNameFormatValid,
  MAX_CONNECTION_NAME_LENGTH
} from "./connectionValidation";

export class ConnectionService {
  private readonly awsConnectionService: AwsConnectionService;
  private readonly azureConnectionService: AzureConnectionService;

  constructor(
    private readonly metadataStore = new ConnectionMetadataStore(),
    private readonly secretsVault = new ConnectionSecretsVault()
  ) {
    this.awsConnectionService = new AwsConnectionService(metadataStore, secretsVault);
    this.azureConnectionService = new AzureConnectionService(metadataStore, secretsVault);
  }

  async listConnections(): Promise<SavedConnectionSummary[]> {
    return sortConnections(this.metadataStore.load());
  }

  async getAwsConnectionDraft(connectionId: string): Promise<AwsConnectionDraft> {
    return this.awsConnectionService.getConnectionDraft(connectionId);
  }

  async getAzureConnectionDraft(connectionId: string): Promise<AzureConnectionDraft> {
    return this.azureConnectionService.getConnectionDraft(connectionId);
  }

  async saveAwsConnection(draft: AwsConnectionDraft): Promise<SavedConnectionSummary> {
    return this.awsConnectionService.saveConnection(draft);
  }

  async updateAwsUploadStorageClass(
    connectionId: string,
    storageClass: AwsConnectionDraft["defaultUploadStorageClass"]
  ): Promise<SavedConnectionSummary> {
    return this.awsConnectionService.updateUploadStorageClass(connectionId, storageClass);
  }

  async saveAzureConnection(draft: AzureConnectionDraft): Promise<SavedConnectionSummary> {
    return this.azureConnectionService.saveConnection(draft);
  }

  async updateAzureUploadTier(
    connectionId: string,
    uploadTier: AzureUploadTier | undefined
  ): Promise<SavedConnectionSummary> {
    return this.azureConnectionService.updateUploadTier(connectionId, uploadTier);
  }

  async deleteConnection(connectionId: string): Promise<void> {
    const previousConnections = this.metadataStore.load();
    const connectionToDelete = previousConnections.find((connection) => connection.id === connectionId);

    if (!connectionToDelete) {
      return;
    }

    if (connectionToDelete.provider === "aws") {
      await this.secretsVault.deleteAwsSecrets(connectionId);
    } else if (connectionToDelete.provider === "azure") {
      await this.secretsVault.deleteAzureSecrets(connectionId);
    }

    const nextConnections = previousConnections.filter((connection) => connection.id !== connectionId);
    this.metadataStore.save(nextConnections);
  }
}

export const connectionService = new ConnectionService();
