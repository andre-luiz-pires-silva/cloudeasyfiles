import type { AwsConnectionDraft, SavedConnectionSummary } from "../models";
import { normalizeAwsUploadStorageClass } from "../awsUploadStorageClasses";
import type { ConnectionMetadataStore } from "../persistence/connectionMetadataStore";
import type { ConnectionSecretsVault } from "../persistence/connectionSecretsVault";
import {
  createConnectionId,
  normalizeConnectionName,
  normalizeConnectionNameForComparison,
  normalizeRestrictedBucketName,
  sortConnections
} from "./connectionNormalization";
import {
  isConnectionNameFormatValid,
  isRestrictedBucketNameFormatValid,
  MAX_CONNECTION_NAME_LENGTH
} from "./connectionValidation";

export class AwsConnectionService {
  constructor(
    private readonly metadataStore: ConnectionMetadataStore,
    private readonly secretsVault: ConnectionSecretsVault
  ) {}

  async getConnectionDraft(connectionId: string): Promise<AwsConnectionDraft> {
    const metadata = this.metadataStore.load().find((connection) => connection.id === connectionId);

    if (!metadata || metadata.provider !== "aws") {
      throw new Error("AWS connection not found");
    }

    const secrets = await this.secretsVault.loadAwsSecrets(connectionId);

    return {
      id: metadata.id,
      name: metadata.name,
      provider: "aws",
      accessKeyId: secrets.accessKeyId,
      secretAccessKey: secrets.secretAccessKey,
      restrictedBucketName: normalizeRestrictedBucketName(metadata.restrictedBucketName),
      connectOnStartup: metadata.connectOnStartup === true,
      defaultUploadStorageClass: normalizeAwsUploadStorageClass(
        metadata.defaultUploadStorageClass
      )
    };
  }

  async saveConnection(draft: AwsConnectionDraft): Promise<SavedConnectionSummary> {
    const previousConnections = this.metadataStore.load();
    const connectionId = draft.id ?? createConnectionId();
    const normalizedName = normalizeConnectionName(draft.name);
    const normalizedRestrictedBucketName = normalizeRestrictedBucketName(draft.restrictedBucketName);
    const existingConnection = previousConnections.find((connection) => connection.id === connectionId);

    if (existingConnection && existingConnection.provider !== "aws") {
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

    if (
      normalizedRestrictedBucketName &&
      !isRestrictedBucketNameFormatValid(normalizedRestrictedBucketName)
    ) {
      throw new Error("The restricted AWS bucket name is invalid.");
    }

    const nextConnection: SavedConnectionSummary = {
      id: connectionId,
      name: normalizedName,
      provider: "aws",
      restrictedBucketName: normalizedRestrictedBucketName,
      connectOnStartup: draft.connectOnStartup === true,
      defaultUploadStorageClass: normalizeAwsUploadStorageClass(draft.defaultUploadStorageClass)
    };

    const nextConnections = sortConnections(
      previousConnections
        .filter((connection) => connection.id !== connectionId)
        .concat(nextConnection)
    );

    this.metadataStore.save(nextConnections);

    try {
      await this.secretsVault.saveAwsSecrets(
        connectionId,
        draft.accessKeyId.trim(),
        draft.secretAccessKey
      );
    } catch (error) {
      this.metadataStore.save(previousConnections);
      throw error;
    }

    return nextConnection;
  }

  async updateUploadStorageClass(
    connectionId: string,
    storageClass: AwsConnectionDraft["defaultUploadStorageClass"]
  ): Promise<SavedConnectionSummary> {
    const previousConnections = this.metadataStore.load();
    const existingConnection = previousConnections.find((connection) => connection.id === connectionId);

    if (!existingConnection || existingConnection.provider !== "aws") {
      throw new Error("AWS connection not found");
    }

    const nextConnection: SavedConnectionSummary = {
      ...existingConnection,
      defaultUploadStorageClass: normalizeAwsUploadStorageClass(storageClass)
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
