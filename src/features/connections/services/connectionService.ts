import type { AwsConnectionDraft, SavedConnectionSummary } from "../models";
import { ConnectionMetadataStore } from "../persistence/connectionMetadataStore";
import { ConnectionSecretsVault } from "../persistence/connectionSecretsVault";
import { normalizeAwsUploadStorageClass } from "../awsUploadStorageClasses";

export const MAX_CONNECTION_NAME_LENGTH = 48;
const SIMPLE_CONNECTION_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u;
const SIMPLE_BUCKET_NAME_PATTERN = /^(?=.{3,63}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

function createConnectionId(): string {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `connection-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sortConnections(connections: SavedConnectionSummary[]) {
  return [...connections].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
      numeric: true
    })
  );
}

export function normalizeConnectionName(value: string): string {
  return value.trim();
}

export function isConnectionNameFormatValid(value: string): boolean {
  const normalizedValue = normalizeConnectionName(value);

  return (
    normalizedValue.length > 0 &&
    normalizedValue.length <= MAX_CONNECTION_NAME_LENGTH &&
    SIMPLE_CONNECTION_NAME_PATTERN.test(normalizedValue)
  );
}

export function normalizeRestrictedBucketName(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : undefined;
}

export function isRestrictedBucketNameFormatValid(value: string): boolean {
  const normalizedValue = value.trim();

  return SIMPLE_BUCKET_NAME_PATTERN.test(normalizedValue) && !normalizedValue.includes("..");
}

function normalizeConnectionNameForComparison(value: string): string {
  return normalizeConnectionName(value).toLocaleLowerCase();
}

export class ConnectionService {
  constructor(
    private readonly metadataStore = new ConnectionMetadataStore(),
    private readonly secretsVault = new ConnectionSecretsVault()
  ) {}

  async listConnections(): Promise<SavedConnectionSummary[]> {
    return sortConnections(this.metadataStore.load());
  }

  async getAwsConnectionDraft(connectionId: string): Promise<AwsConnectionDraft> {
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

  async saveAwsConnection(draft: AwsConnectionDraft): Promise<SavedConnectionSummary> {
    const previousConnections = this.metadataStore.load();
    const connectionId = draft.id ?? createConnectionId();
    const normalizedName = normalizeConnectionName(draft.name);
    const normalizedRestrictedBucketName = normalizeRestrictedBucketName(draft.restrictedBucketName);

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

  async updateAwsUploadStorageClass(
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

  async deleteConnection(connectionId: string): Promise<void> {
    const previousConnections = this.metadataStore.load();
    const connectionToDelete = previousConnections.find((connection) => connection.id === connectionId);

    if (!connectionToDelete) {
      return;
    }

    if (connectionToDelete.provider === "aws") {
      await this.secretsVault.deleteAwsSecrets(connectionId);
    }

    const nextConnections = previousConnections.filter((connection) => connection.id !== connectionId);
    this.metadataStore.save(nextConnections);
  }
}

export const connectionService = new ConnectionService();
