import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ConnectionService,
  isConnectionNameFormatValid,
  isRestrictedBucketNameFormatValid,
  isStorageAccountNameFormatValid,
  normalizeAzureAuthenticationMethod,
  normalizeConnectionName,
  normalizeRestrictedBucketName,
  normalizeStorageAccountName
} from "./connectionService";
import type {
  AwsConnectionDraft,
  AzureConnectionDraft,
  SavedConnectionSummary
} from "../models";

class FakeMetadataStore {
  private connections: SavedConnectionSummary[] = [];

  load() {
    return this.connections;
  }

  save(connections: SavedConnectionSummary[]) {
    this.connections = connections;
  }
}

class FakeSecretsVault {
  saveAwsSecrets = vi.fn(async () => {});
  loadAwsSecrets = vi.fn();
  deleteAwsSecrets = vi.fn(async () => {});
  saveAzureSecrets = vi.fn(async () => {});
  loadAzureSecrets = vi.fn();
  deleteAzureSecrets = vi.fn(async () => {});
}

describe("connectionService helpers", () => {
  it("normalizes and validates names", () => {
    expect(normalizeConnectionName("  Minha conexao  ")).toBe("Minha conexao");
    expect(isConnectionNameFormatValid("Backup 01")).toBe(true);
    expect(isConnectionNameFormatValid("")).toBe(false);
    expect(isConnectionNameFormatValid("nome@invalido")).toBe(false);
  });

  it("normalizes and validates restricted bucket names", () => {
    expect(normalizeRestrictedBucketName("  bucket-a  ")).toBe("bucket-a");
    expect(normalizeRestrictedBucketName("   ")).toBeUndefined();
    expect(isRestrictedBucketNameFormatValid("bucket-name")).toBe(true);
    expect(isRestrictedBucketNameFormatValid("bucket..name")).toBe(false);
  });

  it("normalizes and validates azure storage account names", () => {
    expect(normalizeStorageAccountName("  MyStorage  ")).toBe("mystorage");
    expect(isStorageAccountNameFormatValid("storage123")).toBe(true);
    expect(isStorageAccountNameFormatValid("storage-name")).toBe(false);
    expect(normalizeAzureAuthenticationMethod("entra_id")).toBe("entra_id");
    expect(normalizeAzureAuthenticationMethod("other")).toBe("shared_key");
  });
});

describe("ConnectionService", () => {
  let metadataStore: FakeMetadataStore;
  let secretsVault: FakeSecretsVault;
  let service: ConnectionService;

  beforeEach(() => {
    metadataStore = new FakeMetadataStore();
    secretsVault = new FakeSecretsVault();
    service = new ConnectionService(metadataStore as never, secretsVault as never);
  });

  it("rejects duplicate connection names case-insensitively", async () => {
    metadataStore.save([
      {
        id: "aws-1",
        name: "Backup Casa",
        provider: "aws"
      }
    ]);

    const draft: AwsConnectionDraft = {
      name: "backup casa",
      provider: "aws",
      accessKeyId: "access",
      secretAccessKey: "secret"
    };

    await expect(service.saveAwsConnection(draft)).rejects.toThrow(
      "A connection with this name already exists."
    );
    expect(secretsVault.saveAwsSecrets).not.toHaveBeenCalled();
  });

  it("rolls back metadata when saving aws secrets fails", async () => {
    secretsVault.saveAwsSecrets.mockRejectedValueOnce(new Error("vault failure"));

    const draft: AwsConnectionDraft = {
      name: "Backup Casa",
      provider: "aws",
      accessKeyId: "access",
      secretAccessKey: "secret",
      restrictedBucketName: "bucket-a"
    };

    await expect(service.saveAwsConnection(draft)).rejects.toThrow("vault failure");
    expect(metadataStore.load()).toEqual([]);
  });

  it("saves an azure connection with normalized values", async () => {
    const draft: AzureConnectionDraft = {
      name: " Azure Main ",
      provider: "azure",
      storageAccountName: " MyStorage ",
      authenticationMethod: "shared_key",
      accountKey: "key",
      connectOnStartup: true,
      defaultUploadTier: "Cool"
    };

    const result = await service.saveAzureConnection(draft);

    if (result.provider !== "azure") {
      throw new Error("Expected an Azure connection result");
    }

    expect(result.name).toBe("Azure Main");
    expect(result.storageAccountName).toBe("mystorage");
    expect(result.connectOnStartup).toBe(true);
    expect(result.defaultUploadTier).toBe("Cool");
    expect(secretsVault.saveAzureSecrets).toHaveBeenCalledTimes(1);
  });
});
