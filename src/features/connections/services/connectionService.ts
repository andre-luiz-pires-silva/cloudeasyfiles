import type { AwsConnectionDraft, SavedConnectionSummary } from "../models";
import { ConnectionMetadataStore } from "../persistence/connectionMetadataStore";
import { ConnectionSecretsVault } from "../persistence/connectionSecretsVault";

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
      region: metadata.region,
      accessKeyId: secrets.accessKeyId,
      secretAccessKey: secrets.secretAccessKey,
      localCacheDirectory: metadata.localCacheDirectory ?? ""
    };
  }

  async saveAwsConnection(draft: AwsConnectionDraft): Promise<SavedConnectionSummary> {
    const previousConnections = this.metadataStore.load();
    const connectionId = draft.id ?? createConnectionId();
    const nextConnection: SavedConnectionSummary = {
      id: connectionId,
      name: draft.name.trim(),
      provider: "aws",
      region: draft.region.trim(),
      localCacheDirectory: draft.localCacheDirectory.trim() || undefined
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
