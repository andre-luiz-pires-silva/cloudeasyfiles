export type NavigationUploadSource =
  | {
      kind: "path";
      fileName: string;
      localFilePath: string;
    }
  | {
      kind: "bytes";
      fileName: string;
      fileBytes: Uint8Array;
    };

type AwsUploadDraft = {
  accessKeyId: string;
  secretAccessKey: string;
  defaultUploadStorageClass?: string;
  restrictedBucketName?: string;
};

type AzureUploadDraft = {
  storageAccountName: string;
  accountKey: string;
  defaultUploadTier?: string;
};

export async function resolveBrowserFileUploadSource(
  file: File & { path?: string; webkitRelativePath?: string }
): Promise<NavigationUploadSource> {
  const candidatePath = file.path?.trim() || file.webkitRelativePath?.trim();

  if (candidatePath) {
    return {
      kind: "path",
      fileName: file.name,
      localFilePath: candidatePath
    };
  }

  return {
    kind: "bytes",
    fileName: file.name,
    fileBytes: new Uint8Array(await file.arrayBuffer())
  };
}

export async function startSimpleUploadForProvider(params: {
  provider: "aws" | "azure";
  draft: AwsUploadDraft | AzureUploadDraft;
  connectionId: string;
  bucketName: string;
  objectKey: string;
  bucketRegion?: string | null;
  bucketRegionPlaceholder: string;
  source: NavigationUploadSource;
  operationId: string;
  startAwsUpload: (
    operationId: string,
    accessKeyId: string,
    secretAccessKey: string,
    connectionId: string,
    bucketName: string,
    objectKey: string,
    localFilePath: string,
    storageClass?: string,
    bucketRegion?: string,
    restrictedBucketName?: string
  ) => Promise<string>;
  startAzureUpload: (
    operationId: string,
    storageAccountName: string,
    accountKey: string,
    connectionId: string,
    containerName: string,
    blobName: string,
    localFilePath: string,
    accessTier?: string
  ) => Promise<string>;
  startAwsUploadFromBytes: (
    operationId: string,
    accessKeyId: string,
    secretAccessKey: string,
    connectionId: string,
    bucketName: string,
    objectKey: string,
    fileName: string,
    fileBytes: Uint8Array,
    storageClass?: string,
    bucketRegion?: string,
    restrictedBucketName?: string
  ) => Promise<string>;
  startAzureUploadFromBytes: (
    operationId: string,
    storageAccountName: string,
    accountKey: string,
    connectionId: string,
    containerName: string,
    blobName: string,
    fileName: string,
    fileBytes: Uint8Array,
    accessTier?: string
  ) => Promise<string>;
}): Promise<void> {
  const normalizedBucketRegion =
    params.bucketRegion && params.bucketRegion !== params.bucketRegionPlaceholder
      ? params.bucketRegion
      : undefined;

  if (params.provider === "aws" && "accessKeyId" in params.draft) {
    if (params.source.kind === "path") {
      await params.startAwsUpload(
        params.operationId,
        params.draft.accessKeyId.trim(),
        params.draft.secretAccessKey.trim(),
        params.connectionId,
        params.bucketName,
        params.objectKey,
        params.source.localFilePath,
        params.draft.defaultUploadStorageClass,
        normalizedBucketRegion,
        params.draft.restrictedBucketName
      );
      return;
    }

    await params.startAwsUploadFromBytes(
      params.operationId,
      params.draft.accessKeyId.trim(),
      params.draft.secretAccessKey.trim(),
      params.connectionId,
      params.bucketName,
      params.objectKey,
      params.source.fileName,
      params.source.fileBytes,
      params.draft.defaultUploadStorageClass,
      normalizedBucketRegion,
      params.draft.restrictedBucketName
    );
    return;
  }

  if ("storageAccountName" in params.draft) {
    if (params.source.kind === "path") {
      await params.startAzureUpload(
        params.operationId,
        params.draft.storageAccountName,
        params.draft.accountKey.trim(),
        params.connectionId,
        params.bucketName,
        params.objectKey,
        params.source.localFilePath,
        params.draft.defaultUploadTier
      );
      return;
    }

    await params.startAzureUploadFromBytes(
      params.operationId,
      params.draft.storageAccountName,
      params.draft.accountKey.trim(),
      params.connectionId,
      params.bucketName,
      params.objectKey,
      params.source.fileName,
      params.source.fileBytes,
      params.draft.defaultUploadTier
    );
  }
}
