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

  it("listConnections returns connections sorted alphabetically", async () => {
    metadataStore.save([
      { id: "b", name: "Zeta", provider: "aws" },
      { id: "a", name: "Alpha", provider: "aws" }
    ]);

    const result = await service.listConnections();

    expect(result[0].name).toBe("Alpha");
    expect(result[1].name).toBe("Zeta");
  });

  it("listConnections returns empty array when no connections exist", async () => {
    const result = await service.listConnections();
    expect(result).toEqual([]);
  });

  it("getAwsConnectionDraft returns full draft for an existing AWS connection", async () => {
    metadataStore.save([
      {
        id: "aws-1",
        name: "My AWS",
        provider: "aws",
        restrictedBucketName: "bucket-a",
        connectOnStartup: true
      }
    ]);
    secretsVault.loadAwsSecrets.mockResolvedValueOnce({
      accessKeyId: "AKID",
      secretAccessKey: "secret"
    });

    const draft = await service.getAwsConnectionDraft("aws-1");

    expect(draft.name).toBe("My AWS");
    expect(draft.accessKeyId).toBe("AKID");
    expect(draft.secretAccessKey).toBe("secret");
    expect(draft.restrictedBucketName).toBe("bucket-a");
    expect(draft.connectOnStartup).toBe(true);
  });

  it("getAwsConnectionDraft throws when connection does not exist", async () => {
    await expect(service.getAwsConnectionDraft("missing")).rejects.toThrow(
      "AWS connection not found"
    );
  });

  it("getAwsConnectionDraft throws when connection is not AWS provider", async () => {
    metadataStore.save([
      {
        id: "az-1",
        name: "My Azure",
        provider: "azure",
        storageAccountName: "myaccount",
        authenticationMethod: "shared_key"
      }
    ]);

    await expect(service.getAwsConnectionDraft("az-1")).rejects.toThrow("AWS connection not found");
  });

  it("getAzureConnectionDraft returns full draft for an existing Azure connection", async () => {
    metadataStore.save([
      {
        id: "az-1",
        name: "My Azure",
        provider: "azure",
        storageAccountName: "myaccount",
        authenticationMethod: "shared_key",
        connectOnStartup: false,
        defaultUploadTier: "Hot"
      }
    ]);
    secretsVault.loadAzureSecrets.mockResolvedValueOnce({ accountKey: "my-key" });

    const draft = await service.getAzureConnectionDraft("az-1");

    expect(draft.name).toBe("My Azure");
    expect(draft.storageAccountName).toBe("myaccount");
    expect(draft.accountKey).toBe("my-key");
    expect(draft.connectOnStartup).toBe(false);
    expect(draft.defaultUploadTier).toBe("Hot");
  });

  it("getAzureConnectionDraft throws when connection does not exist", async () => {
    await expect(service.getAzureConnectionDraft("missing")).rejects.toThrow(
      "Azure connection not found"
    );
  });

  it("getAzureConnectionDraft throws when connection is not Azure provider", async () => {
    metadataStore.save([{ id: "aws-1", name: "AWS", provider: "aws" }]);

    await expect(service.getAzureConnectionDraft("aws-1")).rejects.toThrow(
      "Azure connection not found"
    );
  });

  it("saves a new AWS connection successfully and trims the access key", async () => {
    const draft: AwsConnectionDraft = {
      name: "Backup Prod",
      provider: "aws",
      accessKeyId: " AK123 ",
      secretAccessKey: "secret",
      connectOnStartup: false
    };

    const result = await service.saveAwsConnection(draft);

    expect(result.provider).toBe("aws");
    expect(result.name).toBe("Backup Prod");
    expect(metadataStore.load()).toHaveLength(1);
    expect(secretsVault.saveAwsSecrets).toHaveBeenCalledWith(
      expect.any(String),
      "AK123",
      "secret"
    );
  });

  it("rejects provider mismatch when saving an AWS connection over an existing Azure id", async () => {
    metadataStore.save([
      {
        id: "conn-1",
        name: "Old Name",
        provider: "azure",
        storageAccountName: "acc",
        authenticationMethod: "shared_key"
      }
    ]);

    const draft: AwsConnectionDraft = {
      id: "conn-1",
      name: "Old Name",
      provider: "aws",
      accessKeyId: "AK",
      secretAccessKey: "secret"
    };

    await expect(service.saveAwsConnection(draft)).rejects.toThrow(
      "Changing the provider of an existing connection is not supported."
    );
  });

  it("rejects an invalid restricted bucket name on saveAwsConnection", async () => {
    const draft: AwsConnectionDraft = {
      name: "Bad Bucket",
      provider: "aws",
      accessKeyId: "AK",
      secretAccessKey: "secret",
      restrictedBucketName: "INVALID..bucket"
    };

    await expect(service.saveAwsConnection(draft)).rejects.toThrow(
      "The restricted AWS bucket name is invalid."
    );
    expect(secretsVault.saveAwsSecrets).not.toHaveBeenCalled();
  });

  it("rejects provider mismatch when saving an Azure connection over an existing AWS id", async () => {
    metadataStore.save([{ id: "conn-1", name: "Existing AWS", provider: "aws" }]);

    const draft: AzureConnectionDraft = {
      id: "conn-1",
      name: "Existing AWS",
      provider: "azure",
      storageAccountName: "account123",
      authenticationMethod: "shared_key",
      accountKey: "key"
    };

    await expect(service.saveAzureConnection(draft)).rejects.toThrow(
      "Changing the provider of an existing connection is not supported."
    );
  });

  it("rejects duplicate names case-insensitively on saveAzureConnection", async () => {
    metadataStore.save([
      {
        id: "az-1",
        name: "Prod Azure",
        provider: "azure",
        storageAccountName: "acc",
        authenticationMethod: "shared_key"
      }
    ]);

    const draft: AzureConnectionDraft = {
      name: "prod azure",
      provider: "azure",
      storageAccountName: "newaccount",
      authenticationMethod: "shared_key",
      accountKey: "key"
    };

    await expect(service.saveAzureConnection(draft)).rejects.toThrow(
      "A connection with this name already exists."
    );
  });

  it("rejects invalid storage account name on saveAzureConnection", async () => {
    const draft: AzureConnectionDraft = {
      name: "Azure Bad",
      provider: "azure",
      storageAccountName: "invalid-account-name",
      authenticationMethod: "shared_key",
      accountKey: "key"
    };

    await expect(service.saveAzureConnection(draft)).rejects.toThrow(
      "The Azure storage account name is invalid."
    );
  });

  it("rejects entra_id authentication on saveAzureConnection", async () => {
    const draft: AzureConnectionDraft = {
      name: "Azure Entra",
      provider: "azure",
      storageAccountName: "account123",
      authenticationMethod: "entra_id",
      accountKey: ""
    };

    await expect(service.saveAzureConnection(draft)).rejects.toThrow(
      "Azure Microsoft Entra ID is not available yet."
    );
  });

  it("rolls back metadata when saving azure secrets fails", async () => {
    secretsVault.saveAzureSecrets.mockRejectedValueOnce(new Error("vault fail"));

    const draft: AzureConnectionDraft = {
      name: "Azure Rollback",
      provider: "azure",
      storageAccountName: "account123",
      authenticationMethod: "shared_key",
      accountKey: "key"
    };

    await expect(service.saveAzureConnection(draft)).rejects.toThrow("vault fail");
    expect(metadataStore.load()).toEqual([]);
  });

  it("updates the upload storage class for an existing AWS connection", async () => {
    metadataStore.save([{ id: "aws-1", name: "AWS", provider: "aws" }]);

    const result = await service.updateAwsUploadStorageClass("aws-1", "STANDARD_IA");

    if (result.provider !== "aws") throw new Error("Expected AWS connection");
    expect(result.defaultUploadStorageClass).toBe("STANDARD_IA");

    const stored = metadataStore.load()[0];
    if (stored.provider !== "aws") throw new Error("Expected AWS");
    expect(stored.defaultUploadStorageClass).toBe("STANDARD_IA");
  });

  it("throws when AWS connection is not found on updateAwsUploadStorageClass", async () => {
    await expect(service.updateAwsUploadStorageClass("missing", "STANDARD_IA")).rejects.toThrow(
      "AWS connection not found"
    );
  });

  it("throws when connection is not AWS on updateAwsUploadStorageClass", async () => {
    metadataStore.save([
      {
        id: "az-1",
        name: "Azure",
        provider: "azure",
        storageAccountName: "acc",
        authenticationMethod: "shared_key"
      }
    ]);

    await expect(service.updateAwsUploadStorageClass("az-1", "STANDARD_IA")).rejects.toThrow(
      "AWS connection not found"
    );
  });

  it("updates the upload tier for an existing Azure connection", async () => {
    metadataStore.save([
      {
        id: "az-1",
        name: "Azure",
        provider: "azure",
        storageAccountName: "acc",
        authenticationMethod: "shared_key"
      }
    ]);

    const result = await service.updateAzureUploadTier("az-1", "Cool");

    if (result.provider !== "azure") throw new Error("Expected Azure connection");
    expect(result.defaultUploadTier).toBe("Cool");
  });

  it("throws when Azure connection is not found on updateAzureUploadTier", async () => {
    await expect(service.updateAzureUploadTier("missing", "Cool")).rejects.toThrow(
      "Azure connection not found"
    );
  });

  it("throws when connection is not Azure on updateAzureUploadTier", async () => {
    metadataStore.save([{ id: "aws-1", name: "AWS", provider: "aws" }]);

    await expect(service.updateAzureUploadTier("aws-1", "Cool")).rejects.toThrow(
      "Azure connection not found"
    );
  });

  it("deletes an AWS connection and its secrets", async () => {
    metadataStore.save([{ id: "aws-1", name: "AWS", provider: "aws" }]);

    await service.deleteConnection("aws-1");

    expect(secretsVault.deleteAwsSecrets).toHaveBeenCalledWith("aws-1");
    expect(metadataStore.load()).toEqual([]);
  });

  it("deletes an Azure connection and its secrets", async () => {
    metadataStore.save([
      {
        id: "az-1",
        name: "Azure",
        provider: "azure",
        storageAccountName: "acc",
        authenticationMethod: "shared_key"
      }
    ]);

    await service.deleteConnection("az-1");

    expect(secretsVault.deleteAzureSecrets).toHaveBeenCalledWith("az-1");
    expect(metadataStore.load()).toEqual([]);
  });

  it("does nothing when deleting a non-existent connection", async () => {
    await service.deleteConnection("missing");

    expect(secretsVault.deleteAwsSecrets).not.toHaveBeenCalled();
    expect(secretsVault.deleteAzureSecrets).not.toHaveBeenCalled();
  });
});
