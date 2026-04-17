import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

import { invoke } from "@tauri-apps/api/core";
import * as azureConnections from "./azureConnections";

const invokeMock = vi.mocked(invoke);

describe("azureConnections", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("forwards Azure read operations to the expected Tauri commands", async () => {
    invokeMock
      .mockResolvedValueOnce({
        storageAccountName: "storage-a",
        accountUrl: "https://storage-a.blob.core.windows.net"
      })
      .mockResolvedValueOnce([{ name: "container-a" }])
      .mockResolvedValueOnce({
        directories: [{ name: "docs", path: "docs/" }],
        files: [{ name: "docs/file.txt", size: 12 }],
        continuationToken: "next-token",
        hasMore: true
      })
      .mockResolvedValueOnce(true);

    await expect(azureConnections.testAzureConnection("storage-a", "key")).resolves.toEqual({
      storageAccountName: "storage-a",
      accountUrl: "https://storage-a.blob.core.windows.net"
    });
    await expect(azureConnections.listAzureContainers("storage-a", "key")).resolves.toEqual([
      { name: "container-a" }
    ]);
    await expect(
      azureConnections.listAzureContainerItems(
        "storage-a",
        "key",
        "container-a",
        "docs/",
        "token-1",
        200
      )
    ).resolves.toEqual({
      directories: [{ name: "docs", path: "docs/" }],
      files: [{ name: "docs/file.txt", size: 12 }],
      continuationToken: "next-token",
      hasMore: true
    });
    await expect(
      azureConnections.azureBlobExists("storage-a", "key", "container-a", "docs/file.txt")
    ).resolves.toBe(true);

    expect(invokeMock).toHaveBeenNthCalledWith(1, "test_azure_connection", {
      storageAccountName: "storage-a",
      accountKey: "key"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "list_azure_containers", {
      storageAccountName: "storage-a",
      accountKey: "key"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "list_azure_container_items", {
      storageAccountName: "storage-a",
      accountKey: "key",
      containerName: "container-a",
      prefix: "docs/",
      continuationToken: "token-1",
      pageSize: 200
    });
    expect(invokeMock).toHaveBeenNthCalledWith(4, "azure_blob_exists", {
      storageAccountName: "storage-a",
      accountKey: "key",
      containerName: "container-a",
      blobName: "docs/file.txt"
    });
  });

  it("forwards Azure mutation operations to the expected Tauri commands", async () => {
    invokeMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ deletedObjectCount: 2, deletedDirectoryCount: 0 })
      .mockResolvedValueOnce({ deletedObjectCount: 4, deletedDirectoryCount: 1 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    await expect(
      azureConnections.createAzureFolder("storage-a", "key", "container-a", "docs/", "reports")
    ).resolves.toBeUndefined();
    await expect(
      azureConnections.deleteAzureObjects("storage-a", "key", "container-a", ["a.txt", "b.txt"])
    ).resolves.toEqual({ deletedObjectCount: 2, deletedDirectoryCount: 0 });
    await expect(
      azureConnections.deleteAzurePrefix("storage-a", "key", "container-a", "docs/")
    ).resolves.toEqual({ deletedObjectCount: 4, deletedDirectoryCount: 1 });
    await expect(
      azureConnections.changeAzureBlobAccessTier(
        "storage-a",
        "key",
        "container-a",
        "report.csv",
        "Cool"
      )
    ).resolves.toBeUndefined();
    await expect(
      azureConnections.rehydrateAzureBlob(
        "storage-a",
        "key",
        "container-a",
        "archive.zip",
        "Hot",
        "High"
      )
    ).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenNthCalledWith(1, "create_azure_folder", {
      storageAccountName: "storage-a",
      accountKey: "key",
      containerName: "container-a",
      parentPath: "docs/",
      folderName: "reports"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "delete_azure_objects", {
      storageAccountName: "storage-a",
      accountKey: "key",
      containerName: "container-a",
      objectKeys: ["a.txt", "b.txt"]
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "delete_azure_prefix", {
      storageAccountName: "storage-a",
      accountKey: "key",
      containerName: "container-a",
      prefix: "docs/"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(4, "change_azure_blob_access_tier", {
      storageAccountName: "storage-a",
      accountKey: "key",
      containerName: "container-a",
      blobName: "report.csv",
      targetTier: "Cool"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(5, "rehydrate_azure_blob", {
      storageAccountName: "storage-a",
      accountKey: "key",
      containerName: "container-a",
      blobName: "archive.zip",
      targetTier: "Hot",
      priority: "High"
    });
  });

  it("forwards Azure download, upload, cache, and open commands to the expected Tauri commands", async () => {
    invokeMock
      .mockResolvedValueOnce("/cache/docs/file.txt")
      .mockResolvedValueOnce("/downloads/file.txt")
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(["/cache/docs/file.txt"])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce("upload-1")
      .mockResolvedValueOnce("upload-2")
      .mockResolvedValueOnce(undefined);

    await expect(
      azureConnections.startAzureCacheDownload(
        "op-1",
        "storage-a",
        "key",
        "conn-1",
        "Primary",
        "container-a",
        "docs/file.txt",
        "/cache"
      )
    ).resolves.toBe("/cache/docs/file.txt");
    await expect(
      azureConnections.downloadAzureBlobToPath(
        "op-2",
        "storage-a",
        "key",
        "conn-1",
        "container-a",
        "docs/file.txt",
        "/downloads/file.txt"
      )
    ).resolves.toBe("/downloads/file.txt");
    await expect(azureConnections.cancelAzureDownload("op-2")).resolves.toBeUndefined();
    await expect(
      azureConnections.findAzureCachedObjects(
        "conn-1",
        "Primary",
        "container-a",
        "/cache",
        ["docs/file.txt"]
      )
    ).resolves.toEqual(["/cache/docs/file.txt"]);
    await expect(
      azureConnections.openAzureCachedObjectParent(
        "conn-1",
        "Primary",
        "container-a",
        "/cache",
        "docs/file.txt"
      )
    ).resolves.toBeUndefined();
    await expect(
      azureConnections.openAzureCachedObject(
        "conn-1",
        "Primary",
        "container-a",
        "/cache",
        "docs/file.txt"
      )
    ).resolves.toBeUndefined();
    await expect(
      azureConnections.startAzureUpload(
        "op-3",
        "storage-a",
        "key",
        "conn-1",
        "container-a",
        "docs/file.txt",
        "/tmp/file.txt",
        "Cool"
      )
    ).resolves.toBe("upload-1");
    await expect(
      azureConnections.startAzureUploadFromBytes(
        "op-4",
        "storage-a",
        "key",
        "conn-1",
        "container-a",
        "docs/raw.bin",
        "raw.bin",
        new Uint8Array([4, 5, 6]),
        "Hot"
      )
    ).resolves.toBe("upload-2");
    await expect(azureConnections.cancelAzureUpload("op-4")).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenNthCalledWith(1, "start_azure_cache_download", {
      operationId: "op-1",
      storageAccountName: "storage-a",
      accountKey: "key",
      connectionId: "conn-1",
      connectionName: "Primary",
      containerName: "container-a",
      blobName: "docs/file.txt",
      globalLocalCacheDirectory: "/cache"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "download_azure_blob_to_path", {
      operationId: "op-2",
      storageAccountName: "storage-a",
      accountKey: "key",
      connectionId: "conn-1",
      containerName: "container-a",
      blobName: "docs/file.txt",
      destinationPath: "/downloads/file.txt"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "cancel_azure_download", {
      operationId: "op-2"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(4, "find_azure_cached_objects", {
      connectionId: "conn-1",
      connectionName: "Primary",
      containerName: "container-a",
      globalLocalCacheDirectory: "/cache",
      blobNames: ["docs/file.txt"]
    });
    expect(invokeMock).toHaveBeenNthCalledWith(5, "open_azure_cached_object_parent", {
      connectionId: "conn-1",
      connectionName: "Primary",
      containerName: "container-a",
      globalLocalCacheDirectory: "/cache",
      blobName: "docs/file.txt"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(6, "open_azure_cached_object", {
      connectionId: "conn-1",
      connectionName: "Primary",
      containerName: "container-a",
      globalLocalCacheDirectory: "/cache",
      blobName: "docs/file.txt"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(7, "start_azure_upload", {
      operationId: "op-3",
      storageAccountName: "storage-a",
      accountKey: "key",
      connectionId: "conn-1",
      containerName: "container-a",
      blobName: "docs/file.txt",
      localFilePath: "/tmp/file.txt",
      accessTier: "Cool"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(8, "start_azure_upload_bytes", {
      operationId: "op-4",
      storageAccountName: "storage-a",
      accountKey: "key",
      connectionId: "conn-1",
      containerName: "container-a",
      blobName: "docs/raw.bin",
      fileName: "raw.bin",
      fileBytes: [4, 5, 6],
      accessTier: "Hot"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(9, "cancel_azure_upload", {
      operationId: "op-4"
    });
  });
});
