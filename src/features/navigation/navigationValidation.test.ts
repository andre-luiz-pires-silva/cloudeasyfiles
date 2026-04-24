import { describe, expect, it } from "vitest";

import type {
  SavedAwsConnectionSummary,
  SavedConnectionSummary,
  SavedAzureConnectionSummary
} from "../connections/models";
import {
  validateConnectionForm,
  validateConnectionTestFields
} from "./navigationValidation";

const t = (key: string) => key;

function buildAwsConnection(
  overrides: Partial<SavedAwsConnectionSummary> = {}
): SavedAwsConnectionSummary {
  return {
    id: "connection-1",
    name: "Primary",
    provider: "aws",
    connectOnStartup: false,
    ...overrides
  };
}

function buildAzureConnection(
  overrides: Partial<SavedAzureConnectionSummary> = {}
): SavedAzureConnectionSummary {
  return {
    id: "connection-azure-1",
    name: "Azure Primary",
    provider: "azure",
    storageAccountName: "storageaccount",
    authenticationMethod: "shared_key",
    connectOnStartup: false,
    ...overrides
  };
}

describe("navigationValidation", () => {
  it("validates AWS connection test fields", () => {
    expect(
      validateConnectionTestFields({
        provider: "aws",
        accessKeyId: " ",
        secretAccessKey: "",
        restrictedBucketName: "Invalid Bucket",
        storageAccountName: "",
        azureAuthenticationMethod: "shared_key",
        azureAccountKey: "",
        t
      })
    ).toEqual({
      accessKeyId: "navigation.modal.validation.access_key_required",
      secretAccessKey: "navigation.modal.validation.secret_key_required",
      restrictedBucketName: "navigation.modal.validation.restricted_bucket_invalid"
    });
  });

  it("validates Azure connection test fields", () => {
    expect(
      validateConnectionTestFields({
        provider: "azure",
        accessKeyId: "",
        secretAccessKey: "",
        restrictedBucketName: "",
        storageAccountName: "INVALID_NAME",
        azureAuthenticationMethod: "entra_id",
        azureAccountKey: " ",
        t
      })
    ).toEqual({
      storageAccountName: "navigation.modal.validation.storage_account_name_invalid",
      authenticationMethod: "navigation.modal.validation.azure_authentication_method_invalid",
      accountKey: "navigation.modal.validation.account_key_required"
    });
  });

  it("validates required connection name and duplicate names", () => {
    const connections = [
      buildAwsConnection({ id: "connection-1", name: "Primary" }),
      buildAzureConnection({ id: "connection-2", name: "Archive" })
    ];

    expect(
      validateConnectionForm({
        provider: "aws",
        connectionName: " ",
        connections,
        modalMode: "create",
        editingConnectionId: null,
        accessKeyId: "ak",
        secretAccessKey: "secret",
        restrictedBucketName: "",
        storageAccountName: "",
        azureAuthenticationMethod: "shared_key",
        azureAccountKey: "",
        t
      }).connectionName
    ).toBe("navigation.modal.validation.connection_name_required");

    expect(
      validateConnectionForm({
        provider: "aws",
        connectionName: " primary ",
        connections,
        modalMode: "create",
        editingConnectionId: null,
        accessKeyId: "ak",
        secretAccessKey: "secret",
        restrictedBucketName: "",
        storageAccountName: "",
        azureAuthenticationMethod: "shared_key",
        azureAccountKey: "",
        t
      }).connectionName
    ).toBe("navigation.modal.validation.connection_name_duplicate");
  });

  it("allows the edited connection to keep its own name", () => {
    const connections = [buildAwsConnection({ id: "connection-1", name: "Primary" })];

    expect(
      validateConnectionForm({
        provider: "aws",
        connectionName: "primary",
        connections,
        modalMode: "edit",
        editingConnectionId: "connection-1",
        accessKeyId: "ak",
        secretAccessKey: "secret",
        restrictedBucketName: "",
        storageAccountName: "",
        azureAuthenticationMethod: "shared_key",
        azureAccountKey: "",
        t
      })
    ).toEqual({});
  });

  it("validates connection name length and Azure fields together", () => {
    const errors = validateConnectionForm({
      provider: "azure",
      connectionName: "x".repeat(129),
      connections: [],
      modalMode: "create",
      editingConnectionId: null,
      accessKeyId: "",
      secretAccessKey: "",
      restrictedBucketName: "",
      storageAccountName: "",
      azureAuthenticationMethod: "entra_id",
      azureAccountKey: "",
      t
    });

    expect(errors.connectionName).toContain("navigation.modal.validation.connection_name_invalid");
    expect(errors.storageAccountName).toBe(
      "navigation.modal.validation.storage_account_name_required"
    );
    expect(errors.authenticationMethod).toBe(
      "navigation.modal.validation.azure_authentication_method_invalid"
    );
    expect(errors.accountKey).toBe("navigation.modal.validation.account_key_required");
  });
});
