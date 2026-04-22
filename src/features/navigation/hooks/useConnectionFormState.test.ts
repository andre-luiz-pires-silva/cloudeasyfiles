import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useConnectionFormState } from "./useConnectionFormState";
import { DEFAULT_AWS_UPLOAD_STORAGE_CLASS } from "../../connections/awsUploadStorageClasses";
import { DEFAULT_AZURE_UPLOAD_TIER } from "../../connections/azureUploadTiers";

describe("useConnectionFormState", () => {
  it("returns create-mode defaults", () => {
    const { result } = renderHook(() => useConnectionFormState());

    expect(result.current.isModalOpen).toBe(false);
    expect(result.current.modalMode).toBe("create");
    expect(result.current.editingConnectionId).toBeNull();
    expect(result.current.connectionName).toBe("");
    expect(result.current.connectionProvider).toBe("aws");
    expect(result.current.accessKeyId).toBe("");
    expect(result.current.secretAccessKey).toBe("");
    expect(result.current.restrictedBucketName).toBe("");
    expect(result.current.storageAccountName).toBe("");
    expect(result.current.azureAuthenticationMethod).toBe("shared_key");
    expect(result.current.azureAccountKey).toBe("");
    expect(result.current.connectOnStartup).toBe(false);
    expect(result.current.defaultAwsUploadStorageClass).toBe(DEFAULT_AWS_UPLOAD_STORAGE_CLASS);
    expect(result.current.defaultAzureUploadTier).toBe(DEFAULT_AZURE_UPLOAD_TIER);
    expect(result.current.connectionTestStatus).toBe("idle");
    expect(result.current.connectionTestMessage).toBeNull();
    expect(result.current.formErrors).toEqual({});
    expect(result.current.submitError).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
  });

  it("updates modal mode and editing target", () => {
    const { result } = renderHook(() => useConnectionFormState());

    act(() => {
      result.current.setIsModalOpen(true);
      result.current.setModalMode("edit");
      result.current.setEditingConnectionId("connection-1");
    });

    expect(result.current.isModalOpen).toBe(true);
    expect(result.current.modalMode).toBe("edit");
    expect(result.current.editingConnectionId).toBe("connection-1");
  });

  it("updates shared connection fields", () => {
    const { result } = renderHook(() => useConnectionFormState());

    act(() => {
      result.current.setConnectionName("Production");
      result.current.setConnectionProvider("azure");
      result.current.setConnectOnStartup(true);
    });

    expect(result.current.connectionName).toBe("Production");
    expect(result.current.connectionProvider).toBe("azure");
    expect(result.current.connectOnStartup).toBe(true);
  });

  it("updates AWS credential fields and default upload class", () => {
    const { result } = renderHook(() => useConnectionFormState());

    act(() => {
      result.current.setAccessKeyId("AKIA123");
      result.current.setSecretAccessKey("secret");
      result.current.setRestrictedBucketName("reports");
      result.current.setDefaultAwsUploadStorageClass("STANDARD_IA");
    });

    expect(result.current.accessKeyId).toBe("AKIA123");
    expect(result.current.secretAccessKey).toBe("secret");
    expect(result.current.restrictedBucketName).toBe("reports");
    expect(result.current.defaultAwsUploadStorageClass).toBe("STANDARD_IA");
  });

  it("updates Azure credential fields and default upload tier", () => {
    const { result } = renderHook(() => useConnectionFormState());

    act(() => {
      result.current.setStorageAccountName("storageacct");
      result.current.setAzureAuthenticationMethod("shared_key");
      result.current.setAzureAccountKey("account-key");
      result.current.setDefaultAzureUploadTier("Cool");
    });

    expect(result.current.storageAccountName).toBe("storageacct");
    expect(result.current.azureAuthenticationMethod).toBe("shared_key");
    expect(result.current.azureAccountKey).toBe("account-key");
    expect(result.current.defaultAzureUploadTier).toBe("Cool");
  });

  it("updates connection test status and message", () => {
    const { result } = renderHook(() => useConnectionFormState());

    act(() => {
      result.current.setConnectionTestStatus("testing");
      result.current.setConnectionTestMessage("Testing connection...");
    });

    expect(result.current.connectionTestStatus).toBe("testing");
    expect(result.current.connectionTestMessage).toBe("Testing connection...");
  });

  it("updates validation, submit error, and submitting state", () => {
    const { result } = renderHook(() => useConnectionFormState());

    act(() => {
      result.current.setFormErrors({ connectionName: "Required" });
      result.current.setSubmitError("Save failed");
      result.current.setIsSubmitting(true);
    });

    expect(result.current.formErrors).toEqual({ connectionName: "Required" });
    expect(result.current.submitError).toBe("Save failed");
    expect(result.current.isSubmitting).toBe(true);
  });
});
