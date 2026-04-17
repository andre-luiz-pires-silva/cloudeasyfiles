import { buildFileIdentity } from "./navigationGuards";
import type { NavigationContentExplorerItem } from "./navigationContent";

export type NavigationActiveTransfer = {
  operationId: string;
  itemId: string;
  fileIdentity: string;
  fileName: string;
  bucketName: string;
  provider: "aws" | "azure";
  transferKind: "cache" | "direct" | "upload";
  progressPercent: number;
  bytesTransferred: number;
  totalBytes: number;
  state: "progress" | "completed" | "failed" | "cancelled";
  objectKey?: string;
  localFilePath?: string;
  targetPath?: string | null;
  error?: string | null;
};

export type NavigationCompletionToast = {
  id: string;
  title: string;
  description: string;
  tone?: "success" | "error";
};

export type NavigationTransferProvider = "aws" | "azure";
export type NavigationTransferKind = "cache" | "direct" | "upload";

export type NavigationTransferCancellationTarget =
  | "cancelAwsDownload"
  | "cancelAzureDownload"
  | "cancelAwsUpload"
  | "cancelAzureUpload";

type NavigationDownloadEventPayload = {
  operationId: string;
  connectionId: string;
  bucketName: string;
  objectKey: string;
  transferKind: "cache" | "direct";
  progressPercent: number;
  bytesReceived: number;
  totalBytes: number;
  state: "progress" | "completed" | "failed" | "cancelled";
  targetPath?: string | null;
  error?: string | null;
};

type NavigationUploadEventPayload = {
  operationId: string;
  connectionId: string;
  bucketName: string;
  objectKey: string;
  progressPercent: number;
  bytesTransferred: number;
  totalBytes: number;
  state: "progress" | "completed" | "failed" | "cancelled";
  localFilePath: string;
  error?: string | null;
};

export function updateTransfersFromDownloadEvent(
  currentTransfers: Record<string, NavigationActiveTransfer>,
  payload: NavigationDownloadEventPayload
): Record<string, NavigationActiveTransfer> {
  const existingTransfer = currentTransfers[payload.operationId];

  if (!existingTransfer) {
    return currentTransfers;
  }

  return {
    ...currentTransfers,
    [payload.operationId]: {
      ...existingTransfer,
      progressPercent: payload.progressPercent,
      bytesTransferred: payload.bytesReceived,
      totalBytes: payload.totalBytes,
      state: payload.state,
      transferKind: payload.transferKind,
      targetPath: payload.targetPath,
      error: payload.error
    }
  };
}

export function updateTransfersFromUploadEvent(
  currentTransfers: Record<string, NavigationActiveTransfer>,
  payload: NavigationUploadEventPayload
): Record<string, NavigationActiveTransfer> {
  const existingTransfer = currentTransfers[payload.operationId];

  if (!existingTransfer) {
    return currentTransfers;
  }

  return {
    ...currentTransfers,
    [payload.operationId]: {
      ...existingTransfer,
      progressPercent: payload.progressPercent,
      bytesTransferred: payload.bytesTransferred,
      totalBytes: payload.totalBytes,
      state: payload.state,
      error: payload.error,
      objectKey: payload.objectKey,
      localFilePath: payload.localFilePath
    }
  };
}

export function reconcileDownloadedFilePathsFromDownloadEvent(
  currentPaths: string[],
  payload: NavigationDownloadEventPayload
): string[] {
  if (payload.state !== "completed" || payload.transferKind !== "cache") {
    return currentPaths;
  }

  const fileIdentity = buildFileIdentity(
    payload.connectionId,
    payload.bucketName,
    payload.objectKey
  );

  return currentPaths.includes(fileIdentity) ? currentPaths : [...currentPaths, fileIdentity];
}

export function reconcileContentItemsFromDownloadEvent(
  currentItems: NavigationContentExplorerItem[],
  payload: NavigationDownloadEventPayload
): NavigationContentExplorerItem[] {
  if (payload.state !== "completed" || payload.transferKind !== "cache") {
    return currentItems;
  }

  return currentItems.map((currentItem) =>
    currentItem.kind === "file" && currentItem.path === payload.objectKey
      ? { ...currentItem, downloadState: "downloaded" }
      : currentItem
  );
}

export function buildDownloadCompletionToast(
  payload: NavigationDownloadEventPayload,
  t: (key: string) => string
): NavigationCompletionToast | null {
  if (payload.state !== "completed" || payload.transferKind !== "direct") {
    return null;
  }

  return {
    id: payload.operationId,
    title: t("content.transfer.download_as_completed"),
    description: payload.targetPath ?? t("content.transfer.download_as_completed_fallback"),
    tone: "success"
  };
}

export function buildUploadCompletionToast(
  payload: NavigationUploadEventPayload,
  t: (key: string) => string
): NavigationCompletionToast | null {
  if (payload.state !== "completed") {
    return null;
  }

  return {
    id: payload.operationId,
    title: t("content.transfer.upload_completed"),
    description: payload.objectKey,
    tone: "success"
  };
}

export function shouldShowTransferError(payload: { state: string; error?: string | null }): boolean {
  return payload.state === "failed" && !!payload.error;
}

export function buildTransferErrorToast(
  id: string,
  description: string,
  t: (key: string) => string
): NavigationCompletionToast {
  return {
    id,
    title: t("content.transfer.error_title"),
    description,
    tone: "error"
  };
}

export function getTransferCancellationTarget(params: {
  transferKind: NavigationTransferKind;
  provider: NavigationTransferProvider | null | undefined;
}): NavigationTransferCancellationTarget {
  if (params.transferKind === "upload") {
    return params.provider === "azure" ? "cancelAzureUpload" : "cancelAwsUpload";
  }

  return params.provider === "azure" ? "cancelAzureDownload" : "cancelAwsDownload";
}

export function resolveTransferCancellationErrorMessage(
  errorMessage: string | null,
  fallbackMessage: string
): string {
  return errorMessage ?? fallbackMessage;
}
