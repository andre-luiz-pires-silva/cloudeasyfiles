import type { AzureConnectionDraft, SavedConnectionSummary } from "../models";
import { normalizeAzureUploadTier, type AzureUploadTier } from "../azureUploadTiers";
import type { ConnectionMetadataStore } from "../persistence/connectionMetadataStore";
import type { ConnectionSecretsVault } from "../persistence/connectionSecretsVault";
import {
  createConnectionId,
  normalizeAzureAuthenticationMethod,
  normalizeConnectionName,
  normalizeConnectionNameForComparison,
  normalizeStorageAccountName,
  sortConnections
} from "./connectionNormalization";
import {
  isConnectionNameFormatValid,
  isStorageAccountNameFormatValid,
  MAX_CONNECTION_NAME_LENGTH
} from "./connectionValidation";

export class AzureConnectionService {
  constructor(
    private readonly metadataStore: ConnectionMetadataStore,
    private readonly secretsVault: ConnectionSecretsVault
  ) {}

  async getConnectionDraft(connectionId: string): Promise<AzureConnectionDraft> {
    const metadata = this.metadataStore.load().find((connection) => connection.id === connectionId);

    if (!metadata || metadata.provider !== "azure") {
      throw new Error("Azure connection not found");
    }

    const secrets = await this.secretsVault.loadAzureSecrets(connectionId);

    return {
      id: metadata.id,
      name: metadata.name,
      provider: "azure",
      storageAccountName: normalizeStorageAccountName(metadata.storageAccountName),
      authenticationMethod: normalizeAzureAuthenticationMethod(metadata.authenticationMethod),
      accountKey: secrets.accountKey,
      connectOnStartup: metadata.connectOnStartup === true,
      defaultUploadTier: normalizeAzureUploadTier(metadata.defaultUploadTier)
    };
  }

  async saveConnection(draft: AzureConnectionDraft): Promise<SavedConnectionSummary> {
    const previousConnections = this.metadataStore.load();
    const connectionId = draft.id ?? createConnectionId();
    const normalizedName = normalizeConnectionName(draft.name);
    const normalizedStorageAccountName = normalizeStorageAccountName(draft.storageAccountName);
    const normalizedAuthenticationMethod = normalizeAzureAuthenticationMethod(
      draft.authenticationMethod
    );
    const existingConnection = previousConnections.find((connection) => connection.id === connectionId);

    if (existingConnection && existingConnection.provider !== "azure") {
      throw new Error("Changing the provider of an existing connection is not supported.");
    }

    if (!isConnectionNameFormatValid(normalizedName)) {
      throw new Error(
        `Connection names must be 1 to ${MAX_CONNECTION_NAME_LENGTH} characters and use only letters, numbers, spaces, hyphens, or underscores.`
      );
    }

    const normalizedComparisonName = normalizeConnectionNameForComparison(normalizedName);
    const hasDuplicateName = previousConnections.some(
      (connection) =>
        connection.id !== connectionId &&
        normalizeConnectionNameForComparison(connection.name) === normalizedComparisonName
    );

    if (hasDuplicateName) {
      throw new Error("A connection with this name already exists.");
    }

    if (!isStorageAccountNameFormatValid(normalizedStorageAccountName)) {
      throw new Error("The Azure storage account name is invalid.");
    }

    if (normalizedAuthenticationMethod !== "shared_key") {
      throw new Error("Azure Microsoft Entra ID is not available yet.");
    }

    const nextConnection: SavedConnectionSummary = {
      id: connectionId,
      name: normalizedName,
      provider: "azure",
      storageAccountName: normalizedStorageAccountName,
      authenticationMethod: normalizedAuthenticationMethod,
      connectOnStartup: draft.connectOnStartup === true,
      defaultUploadTier: normalizeAzureUploadTier(draft.defaultUploadTier)
    };

    const nextConnections = sortConnections(
      previousConnections
        .filter((connection) => connection.id !== connectionId)
        .concat(nextConnection)
    );

    this.metadataStore.save(nextConnections);

    try {
      await this.secretsVault.saveAzureSecrets(connectionId, draft.accountKey);
    } catch (error) {
      this.metadataStore.save(previousConnections);
      throw error;
    }

    return nextConnection;
  }

  async updateUploadTier(
    connectionId: string,
    uploadTier: AzureUploadTier | undefined
  ): Promise<SavedConnectionSummary> {
    const previousConnections = this.metadataStore.load();
    const existingConnection = previousConnections.find((connection) => connection.id === connectionId);

    if (!existingConnection || existingConnection.provider !== "azure") {
      throw new Error("Azure connection not found");
    }

    const nextConnection: SavedConnectionSummary = {
      ...existingConnection,
      defaultUploadTier: normalizeAzureUploadTier(uploadTier)
    };

    const nextConnections = sortConnections(
      previousConnections
        .filter((connection) => connection.id !== connectionId)
        .concat(nextConnection)
    );

    this.metadataStore.save(nextConnections);

    return nextConnection;
  }
}
