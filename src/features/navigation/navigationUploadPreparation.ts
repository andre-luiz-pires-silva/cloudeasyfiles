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
