import { buildFileIdentity, buildUploadObjectKey } from "./navigationGuards";
import type { NavigationActiveTransfer } from "./navigationTransfers";

export type NavigationSimpleUploadInput = {
  fileName: string;
  localFilePath?: string;
};

export type NavigationPreparedUploadCandidate<TInput extends NavigationSimpleUploadInput = NavigationSimpleUploadInput> =
  TInput & {
  fileName: string;
  objectKey: string;
  fileIdentity: string;
};

export type NavigationUploadPreparationIssue =
  | { kind: "invalid_path" }
  | { kind: "duplicate_batch"; fileName: string }
  | { kind: "duplicate_active" };

export type NavigationPreparedUploadBatchItem<
  TInput extends NavigationSimpleUploadInput = NavigationSimpleUploadInput
> = NavigationPreparedUploadCandidate<TInput> & {
  objectAlreadyExists: boolean;
};

export function normalizeUploadBatchPaths(localFilePaths: string[]): string[] {
  return localFilePaths
    .map((localFilePath) => localFilePath.trim())
    .filter((localFilePath) => localFilePath.length > 0);
}

export function prepareUploadBatchCandidates<TInput extends NavigationSimpleUploadInput>(params: {
  inputs: TInput[];
  selectedBucketConnectionId: string;
  selectedBucketName: string;
  selectedBucketPath: string;
  activeTransferIdentityMap: Map<string, NavigationActiveTransfer>;
}): {
  preparedItems: NavigationPreparedUploadCandidate<TInput>[];
  issues: NavigationUploadPreparationIssue[];
} {
  const preparedItems: NavigationPreparedUploadCandidate<TInput>[] = [];
  const issues: NavigationUploadPreparationIssue[] = [];
  const seenObjectKeys = new Set<string>();

  for (const input of params.inputs) {
    const fileName = input.fileName.trim();

    if (!fileName) {
      issues.push({ kind: "invalid_path" });
      continue;
    }

    const objectKey = buildUploadObjectKey(params.selectedBucketPath, fileName);

    if (seenObjectKeys.has(objectKey)) {
      issues.push({ kind: "duplicate_batch", fileName });
      continue;
    }

    seenObjectKeys.add(objectKey);

    const fileIdentity = buildFileIdentity(
      params.selectedBucketConnectionId,
      params.selectedBucketName,
      objectKey
    );

    if (params.activeTransferIdentityMap.has(fileIdentity)) {
      issues.push({ kind: "duplicate_active" });
      continue;
    }

    preparedItems.push({
      ...input,
      fileName,
      objectKey,
      fileIdentity
    });
  }

  return { preparedItems, issues };
}

export function buildUploadTransferEntry(params: {
  operationId: string;
  input: Pick<
    NavigationPreparedUploadCandidate,
    "fileIdentity" | "fileName" | "objectKey" | "localFilePath"
  >;
  selectedBucketName: string;
  selectedBucketProvider: "aws" | "azure";
}): NavigationActiveTransfer {
  return {
    operationId: params.operationId,
    itemId: `upload:${params.input.objectKey}`,
    fileIdentity: params.input.fileIdentity,
    fileName: params.input.fileName,
    bucketName: params.selectedBucketName,
    provider: params.selectedBucketProvider,
    transferKind: "upload",
    progressPercent: 0,
    bytesTransferred: 0,
    totalBytes: 0,
    state: "progress",
    objectKey: params.input.objectKey,
    localFilePath: params.input.localFilePath ?? params.input.fileName
  };
}

export function buildUploadPreparationIssueMessages(
  issues: NavigationUploadPreparationIssue[],
  t: (key: string) => string
): string[] {
  return issues.map((issue) => {
    if (issue.kind === "invalid_path") {
      return t("content.transfer.upload_invalid_path");
    }

    if (issue.kind === "duplicate_batch") {
      return t("content.transfer.upload_duplicate_batch").replace("{name}", issue.fileName);
    }

    return t("content.transfer.upload_duplicate_active");
  });
}

export async function hydratePreparedUploadBatchItems<
  TInput extends NavigationSimpleUploadInput
>(params: {
  provider: "aws" | "azure";
  draft:
    | {
        accessKeyId: string;
        secretAccessKey: string;
        restrictedBucketName?: string;
      }
    | {
        storageAccountName: string;
        accountKey: string;
      };
  selectedBucketName: string;
  selectedBucketRegion?: string | null;
  bucketRegionPlaceholder: string;
  candidateItems: NavigationPreparedUploadCandidate<TInput>[];
  isUploadExistsPreflightPermissionError: (error: unknown) => boolean;
  awsObjectExists: (
    accessKeyId: string,
    secretAccessKey: string,
    bucketName: string,
    objectKey: string,
    bucketRegion?: string,
    restrictedBucketName?: string
  ) => Promise<boolean>;
  azureBlobExists: (
    storageAccountName: string,
    accountKey: string,
    containerName: string,
    blobName: string
  ) => Promise<boolean>;
}): Promise<NavigationPreparedUploadBatchItem<TInput>[]> {
  const preparedItems: NavigationPreparedUploadBatchItem<TInput>[] = [];

  for (const item of params.candidateItems) {
    let objectAlreadyExists = false;

    try {
      if (params.provider === "aws" && "accessKeyId" in params.draft) {
        objectAlreadyExists = await params.awsObjectExists(
          params.draft.accessKeyId.trim(),
          params.draft.secretAccessKey.trim(),
          params.selectedBucketName,
          item.objectKey,
          params.selectedBucketRegion &&
            params.selectedBucketRegion !== params.bucketRegionPlaceholder
            ? params.selectedBucketRegion
            : undefined,
          params.draft.restrictedBucketName
        );
      } else if ("storageAccountName" in params.draft) {
        objectAlreadyExists = await params.azureBlobExists(
          params.draft.storageAccountName,
          params.draft.accountKey.trim(),
          params.selectedBucketName,
          item.objectKey
        );
      }
    } catch (error) {
      if (!params.isUploadExistsPreflightPermissionError(error)) {
        throw error;
      }
    }

    preparedItems.push({
      ...item,
      objectAlreadyExists
    });
  }

  return preparedItems;
}
