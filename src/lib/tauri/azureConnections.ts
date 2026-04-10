import { invoke } from "@tauri-apps/api/core";

export type AzureConnectionTestResult = {
  storageAccountName: string;
  accountUrl: string;
};

export type AzureContainerSummary = {
  name: string;
};

export type AzureVirtualDirectorySummary = {
  name: string;
  path: string;
};

export type AzureBlobSummary = {
  name: string;
  size: number;
  eTag?: string | null;
  lastModified?: string | null;
  storageClass?: string | null;
  restoreInProgress?: boolean | null;
  restoreExpiryDate?: string | null;
};

export type AzureContainerItemsResult = {
  directories: AzureVirtualDirectorySummary[];
  files: AzureBlobSummary[];
  continuationToken?: string | null;
  hasMore: boolean;
};

export type AzureDeleteResult = {
  deletedObjectCount: number;
  deletedDirectoryCount: number;
};

export type AzureUploadProgressEvent = {
  operationId: string;
  connectionId: string;
  bucketName: string;
  objectKey: string;
  localFilePath: string;
  bytesTransferred: number;
  totalBytes: number;
  progressPercent: number;
  state: "progress" | "completed" | "failed" | "cancelled";
  error?: string | null;
};

export type AzureDownloadProgressEvent = {
  operationId: string;
  transferKind: "cache" | "direct";
  connectionId: string;
  bucketName: string;
  objectKey: string;
  targetPath?: string | null;
  bytesReceived: number;
  totalBytes: number;
  progressPercent: number;
  state: "progress" | "completed" | "failed" | "cancelled";
  error?: string | null;
};

export async function testAzureConnection(
  storageAccountName: string,
  accountKey: string
): Promise<AzureConnectionTestResult> {
  return invoke<AzureConnectionTestResult>("test_azure_connection", {
    storageAccountName,
    accountKey
  });
}

export async function listAzureContainers(
  storageAccountName: string,
  accountKey: string
): Promise<AzureContainerSummary[]> {
  return invoke<AzureContainerSummary[]>("list_azure_containers", {
    storageAccountName,
    accountKey
  });
}

export async function listAzureContainerItems(
  storageAccountName: string,
  accountKey: string,
  containerName: string,
  prefix?: string,
  continuationToken?: string,
  pageSize?: number
): Promise<AzureContainerItemsResult> {
  return invoke<AzureContainerItemsResult>("list_azure_container_items", {
    storageAccountName,
    accountKey,
    containerName,
    prefix,
    continuationToken,
    pageSize
  });
}

export async function azureBlobExists(
  storageAccountName: string,
  accountKey: string,
  containerName: string,
  blobName: string
): Promise<boolean> {
  return invoke<boolean>("azure_blob_exists", {
    storageAccountName,
    accountKey,
    containerName,
    blobName
  });
}

export async function createAzureFolder(
  storageAccountName: string,
  accountKey: string,
  containerName: string,
  parentPath: string | null | undefined,
  folderName: string
): Promise<void> {
  await invoke("create_azure_folder", {
    storageAccountName,
    accountKey,
    containerName,
    parentPath,
    folderName
  });
}

export async function deleteAzureObjects(
  storageAccountName: string,
  accountKey: string,
  containerName: string,
  objectKeys: string[]
): Promise<AzureDeleteResult> {
  return invoke<AzureDeleteResult>("delete_azure_objects", {
    storageAccountName,
    accountKey,
    containerName,
    objectKeys
  });
}

export async function deleteAzurePrefix(
  storageAccountName: string,
  accountKey: string,
  containerName: string,
  prefix: string
): Promise<AzureDeleteResult> {
  return invoke<AzureDeleteResult>("delete_azure_prefix", {
    storageAccountName,
    accountKey,
    containerName,
    prefix
  });
}

export async function startAzureCacheDownload(
  operationId: string,
  storageAccountName: string,
  accountKey: string,
  connectionId: string,
  connectionName: string,
  containerName: string,
  blobName: string,
  globalLocalCacheDirectory: string
): Promise<string> {
  return invoke<string>("start_azure_cache_download", {
    operationId,
    storageAccountName,
    accountKey,
    connectionId,
    connectionName,
    containerName,
    blobName,
    globalLocalCacheDirectory
  });
}

export async function downloadAzureBlobToPath(
  operationId: string,
  storageAccountName: string,
  accountKey: string,
  connectionId: string,
  containerName: string,
  blobName: string,
  destinationPath: string
): Promise<string> {
  return invoke<string>("download_azure_blob_to_path", {
    operationId,
    storageAccountName,
    accountKey,
    connectionId,
    containerName,
    blobName,
    destinationPath
  });
}

export async function cancelAzureDownload(operationId: string): Promise<void> {
  await invoke("cancel_azure_download", {
    operationId
  });
}

export async function findAzureCachedObjects(
  connectionId: string,
  connectionName: string,
  containerName: string,
  globalLocalCacheDirectory: string,
  blobNames: string[]
): Promise<string[]> {
  return invoke<string[]>("find_azure_cached_objects", {
    connectionId,
    connectionName,
    containerName,
    globalLocalCacheDirectory,
    blobNames
  });
}

export async function openAzureCachedObjectParent(
  connectionId: string,
  connectionName: string,
  containerName: string,
  globalLocalCacheDirectory: string,
  blobName: string
): Promise<void> {
  await invoke("open_azure_cached_object_parent", {
    connectionId,
    connectionName,
    containerName,
    globalLocalCacheDirectory,
    blobName
  });
}

export async function openAzureCachedObject(
  connectionId: string,
  connectionName: string,
  containerName: string,
  globalLocalCacheDirectory: string,
  blobName: string
): Promise<void> {
  await invoke("open_azure_cached_object", {
    connectionId,
    connectionName,
    containerName,
    globalLocalCacheDirectory,
    blobName
  });
}

export async function startAzureUpload(
  operationId: string,
  storageAccountName: string,
  accountKey: string,
  connectionId: string,
  containerName: string,
  blobName: string,
  localFilePath: string,
  accessTier?: string
): Promise<string> {
  return invoke<string>("start_azure_upload", {
    operationId,
    storageAccountName,
    accountKey,
    connectionId,
    containerName,
    blobName,
    localFilePath,
    accessTier
  });
}

export async function startAzureUploadFromBytes(
  operationId: string,
  storageAccountName: string,
  accountKey: string,
  connectionId: string,
  containerName: string,
  blobName: string,
  fileName: string,
  fileBytes: Uint8Array,
  accessTier?: string
): Promise<string> {
  return invoke<string>("start_azure_upload_bytes", {
    operationId,
    storageAccountName,
    accountKey,
    connectionId,
    containerName,
    blobName,
    fileName,
    fileBytes: Array.from(fileBytes),
    accessTier
  });
}

export async function cancelAzureUpload(operationId: string): Promise<void> {
  await invoke("cancel_azure_upload", {
    operationId
  });
}
