import { describe, expect, it } from "vitest";

import {
  buildAwsEditModalState,
  buildAzureEditModalState,
  buildBaseEditModalState,
  buildCreateModalState,
  buildModalLoadErrorMessage,
  buildResetModalFormState
} from "./navigationModalState";

describe("navigationModalState", () => {
  it("builds reset and create modal states", () => {
    expect(buildResetModalFormState()).toEqual({
      modalMode: "create",
      editingConnectionId: null,
      connectionName: "",
      connectionProvider: "aws",
      accessKeyId: "",
      secretAccessKey: "",
      restrictedBucketName: "",
      storageAccountName: "",
      azureAuthenticationMethod: "shared_key",
      azureAccountKey: "",
      connectOnStartup: false,
      defaultAwsUploadStorageClass: "STANDARD",
      defaultAzureUploadTier: "Hot",
      formErrors: {},
      submitError: null,
      isModalOpen: false
    });
    expect(buildCreateModalState().isModalOpen).toBe(true);
  });

  it("builds base edit modal state from saved connections", () => {
    expect(
      buildBaseEditModalState(
        {
          id: "aws-1",
          name: "AWS Main",
          provider: "aws",
          restrictedBucketName: "reports",
          connectOnStartup: true
        },
        "aws-1"
      )
    ).toMatchObject({
      modalMode: "edit",
      editingConnectionId: "aws-1",
      connectionName: "AWS Main",
      connectionProvider: "aws",
      restrictedBucketName: "reports",
      connectOnStartup: true,
      defaultAwsUploadStorageClass: "STANDARD",
      defaultAzureUploadTier: "Hot",
      isModalOpen: true
    });

    expect(
      buildBaseEditModalState(
        {
          id: "az-1",
          name: "Azure Main",
          provider: "azure",
          storageAccountName: "storageaccount",
          authenticationMethod: "shared_key",
          defaultUploadTier: "Archive"
        },
        "az-1"
      )
    ).toMatchObject({
      connectionProvider: "azure",
      storageAccountName: "storageaccount",
      azureAuthenticationMethod: "shared_key",
      defaultAzureUploadTier: "Archive"
    });
  });

  it("applies provider-specific draft state on edit", () => {
    const awsBase = buildBaseEditModalState(
      {
        id: "aws-1",
        name: "AWS Main",
        provider: "aws"
      },
      "aws-1"
    );
    expect(
      buildAwsEditModalState(awsBase, {
        accessKeyId: "AKIA",
        secretAccessKey: "secret",
        restrictedBucketName: "reports",
        connectOnStartup: true,
        defaultUploadStorageClass: "DEEP_ARCHIVE"
      })
    ).toMatchObject({
      accessKeyId: "AKIA",
      secretAccessKey: "secret",
      restrictedBucketName: "reports",
      connectOnStartup: true,
      defaultAwsUploadStorageClass: "DEEP_ARCHIVE"
    });

    const azureBase = buildBaseEditModalState(
      {
        id: "az-1",
        name: "Azure Main",
        provider: "azure",
        storageAccountName: "storageaccount",
        authenticationMethod: "shared_key"
      },
      "az-1"
    );
    expect(
      buildAzureEditModalState(azureBase, {
        storageAccountName: "account2",
        authenticationMethod: "shared_key",
        accountKey: "secret",
        connectOnStartup: true,
        defaultUploadTier: "Cold"
      })
    ).toMatchObject({
      storageAccountName: "account2",
      azureAuthenticationMethod: "shared_key",
      azureAccountKey: "secret",
      connectOnStartup: true,
      defaultAzureUploadTier: "Cold"
    });
  });

  it("builds modal load error messages", () => {
    const t = (key: string) => key;
    expect(buildModalLoadErrorMessage(new Error("boom"), t)).toBe("boom");
    expect(buildModalLoadErrorMessage({}, t)).toBe(
      "navigation.modal.credentials_load_warning"
    );
  });
});
