import { invoke } from "@tauri-apps/api/core";

type AwsConnectionTestResult = {
  accountId: string;
  arn: string;
  userId: string;
};

export type AwsBucketSummary = {
  name: string;
};

export type AwsVirtualDirectorySummary = {
  name: string;
  path: string;
};

export type AwsObjectSummary = {
  key: string;
  size: number;
  eTag?: string | null;
  lastModified?: string | null;
  storageClass?: string | null;
  restoreInProgress?: boolean | null;
  restoreExpiryDate?: string | null;
};

export type AwsBucketItemsResult = {
  bucketRegion: string;
  directories: AwsVirtualDirectorySummary[];
  files: AwsObjectSummary[];
  continuationToken?: string | null;
  hasMore: boolean;
};

export type AwsDownloadProgressEvent = {
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

export type AwsUploadProgressEvent = {
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

export type AwsRestoreTier = "expedited" | "standard" | "bulk";

export async function testAwsConnection(
  accessKeyId: string,
  secretAccessKey: string
): Promise<AwsConnectionTestResult> {
  return invoke<AwsConnectionTestResult>("test_aws_connection", {
    accessKeyId,
    secretAccessKey
  });
}

export async function listAwsBuckets(
  accessKeyId: string,
  secretAccessKey: string
): Promise<AwsBucketSummary[]> {
  return invoke<AwsBucketSummary[]>("list_aws_buckets", {
    accessKeyId,
    secretAccessKey
  });
}

export async function getAwsBucketRegion(
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string
): Promise<string> {
  return invoke<string>("get_aws_bucket_region", {
    accessKeyId,
    secretAccessKey,
    bucketName
  });
}

export async function listAwsBucketItems(
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  prefix?: string,
  bucketRegion?: string,
  continuationToken?: string
): Promise<AwsBucketItemsResult> {
  return invoke<AwsBucketItemsResult>("list_aws_bucket_items", {
    accessKeyId,
    secretAccessKey,
    bucketName,
    prefix,
    bucketRegion,
    continuationToken
  });
}

export async function requestAwsObjectRestore(
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  objectKey: string,
  storageClass: string | null | undefined,
  restoreTier: AwsRestoreTier,
  days: number,
  bucketRegion?: string
): Promise<void> {
  await invoke("request_aws_object_restore", {
    accessKeyId,
    secretAccessKey,
    bucketName,
    objectKey,
    storageClass,
    bucketRegion,
    restoreTier,
    days
  });
}

export async function createAwsFolder(
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  parentPath: string | null | undefined,
  folderName: string,
  bucketRegion?: string
): Promise<void> {
  await invoke("create_aws_folder", {
    accessKeyId,
    secretAccessKey,
    bucketName,
    parentPath,
    folderName,
    bucketRegion
  });
}

export async function openExternalUrl(url: string): Promise<void> {
  await invoke("open_external_url", { url });
}


export async function startAwsCacheDownload(
  operationId: string,
  accessKeyId: string,
  secretAccessKey: string,
  connectionId: string,
  connectionName: string,
  bucketName: string,
  objectKey: string,
  globalLocalCacheDirectory: string,
  bucketRegion?: string
): Promise<string> {
  return invoke<string>("start_aws_cache_download", {
    operationId,
    accessKeyId,
    secretAccessKey,
    connectionId,
    connectionName,
    bucketName,
    objectKey,
    globalLocalCacheDirectory,
    bucketRegion
  });
}

export async function downloadAwsObjectToPath(
  operationId: string,
  accessKeyId: string,
  secretAccessKey: string,
  connectionId: string,
  bucketName: string,
  objectKey: string,
  destinationPath: string,
  bucketRegion?: string
): Promise<string> {
  return invoke<string>("download_aws_object_to_path", {
    operationId,
    accessKeyId,
    secretAccessKey,
    connectionId,
    bucketName,
    objectKey,
    destinationPath,
    bucketRegion
  });
}

export async function cancelAwsDownload(operationId: string): Promise<void> {
  await invoke("cancel_aws_download", {
    operationId
  });
}

export async function awsObjectExists(
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  objectKey: string,
  bucketRegion?: string
): Promise<boolean> {
  return invoke<boolean>("aws_object_exists", {
    accessKeyId,
    secretAccessKey,
    bucketName,
    objectKey,
    bucketRegion
  });
}

export async function startAwsUpload(
  operationId: string,
  accessKeyId: string,
  secretAccessKey: string,
  connectionId: string,
  bucketName: string,
  objectKey: string,
  localFilePath: string,
  storageClass?: string,
  bucketRegion?: string
): Promise<string> {
  return invoke<string>("start_aws_upload", {
    operationId,
    accessKeyId,
    secretAccessKey,
    connectionId,
    bucketName,
    objectKey,
    localFilePath,
    storageClass,
    bucketRegion
  });
}

export async function startAwsUploadFromBytes(
  operationId: string,
  accessKeyId: string,
  secretAccessKey: string,
  connectionId: string,
  bucketName: string,
  objectKey: string,
  fileName: string,
  fileBytes: Uint8Array,
  storageClass?: string,
  bucketRegion?: string
): Promise<string> {
  return invoke<string>("start_aws_upload_bytes", {
    operationId,
    accessKeyId,
    secretAccessKey,
    connectionId,
    bucketName,
    objectKey,
    fileName,
    fileBytes: Array.from(fileBytes),
    storageClass,
    bucketRegion
  });
}

export async function cancelAwsUpload(operationId: string): Promise<void> {
  await invoke("cancel_aws_upload", {
    operationId
  });
}

export async function findAwsCachedObjects(
  connectionId: string,
  connectionName: string,
  bucketName: string,
  globalLocalCacheDirectory: string,
  objectKeys: string[]
): Promise<string[]> {
  return invoke<string[]>("find_aws_cached_objects", {
    connectionId,
    connectionName,
    bucketName,
    globalLocalCacheDirectory,
    objectKeys
  });
}

export async function openAwsCachedObjectParent(
  connectionId: string,
  connectionName: string,
  bucketName: string,
  globalLocalCacheDirectory: string,
  objectKey: string
): Promise<void> {
  await invoke("open_aws_cached_object_parent", {
    connectionId,
    connectionName,
    bucketName,
    globalLocalCacheDirectory,
    objectKey
  });
}

export async function openAwsCachedObject(
  connectionId: string,
  connectionName: string,
  bucketName: string,
  globalLocalCacheDirectory: string,
  objectKey: string
): Promise<void> {
  await invoke("open_aws_cached_object", {
    connectionId,
    connectionName,
    bucketName,
    globalLocalCacheDirectory,
    objectKey
  });
}
