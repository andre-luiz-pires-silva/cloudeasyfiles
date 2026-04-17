import { describe, expect, it } from "vitest";

import type { NavigationContentExplorerItem } from "./navigationContent";
import {
  buildDownloadCompletionToast,
  getTransferCancellationTarget,
  resolveTransferCancellationErrorMessage,
  buildTransferErrorToast,
  buildUploadCompletionToast,
  reconcileContentItemsFromDownloadEvent,
  reconcileDownloadedFilePathsFromDownloadEvent,
  shouldShowTransferError,
  updateTransfersFromDownloadEvent,
  updateTransfersFromUploadEvent
} from "./navigationTransfers";

describe("navigationTransfers", () => {
  const currentTransfers = {
    op1: {
      operationId: "op1",
      itemId: "file:docs/report.txt",
      fileIdentity: "conn-1:bucket-a:docs/report.txt",
      fileName: "report.txt",
      bucketName: "bucket-a",
      provider: "aws" as const,
      transferKind: "cache" as const,
      progressPercent: 0,
      bytesTransferred: 0,
      totalBytes: 10,
      state: "progress" as const
    }
  };

  it("updates transfer records from download events", () => {
    expect(
      updateTransfersFromDownloadEvent(currentTransfers, {
        operationId: "op1",
        connectionId: "conn-1",
        bucketName: "bucket-a",
        objectKey: "docs/report.txt",
        transferKind: "direct",
        progressPercent: 50,
        bytesReceived: 5,
        totalBytes: 10,
        state: "progress",
        targetPath: "/tmp/report.txt",
        error: null
      })
    ).toEqual({
      op1: {
        ...currentTransfers.op1,
        transferKind: "direct",
        progressPercent: 50,
        bytesTransferred: 5,
        totalBytes: 10,
        state: "progress",
        targetPath: "/tmp/report.txt",
        error: null
      }
    });
  });

  it("updates transfer records from upload events", () => {
    expect(
      updateTransfersFromUploadEvent(currentTransfers, {
        operationId: "op1",
        connectionId: "conn-1",
        bucketName: "bucket-a",
        objectKey: "docs/report.txt",
        progressPercent: 75,
        bytesTransferred: 15,
        totalBytes: 20,
        state: "progress",
        localFilePath: "/tmp/report.txt",
        error: null
      })
    ).toEqual({
      op1: {
        ...currentTransfers.op1,
        progressPercent: 75,
        bytesTransferred: 15,
        totalBytes: 20,
        state: "progress",
        objectKey: "docs/report.txt",
        localFilePath: "/tmp/report.txt",
        error: null
      }
    });
  });

  it("reconciles downloaded paths and content items from cache completions", () => {
    const items: NavigationContentExplorerItem[] = [
      {
        id: "file:docs/report.txt",
        kind: "file",
        name: "report.txt",
        path: "docs/report.txt",
        availabilityStatus: "available",
        downloadState: "not_downloaded"
      }
    ];

    expect(
      reconcileDownloadedFilePathsFromDownloadEvent([], {
        operationId: "op1",
        connectionId: "conn-1",
        bucketName: "bucket-a",
        objectKey: "docs/report.txt",
        transferKind: "cache",
        progressPercent: 100,
        bytesReceived: 10,
        totalBytes: 10,
        state: "completed",
        error: null
      })
    ).toEqual(["conn-1:bucket-a:docs/report.txt"]);

    expect(
      reconcileContentItemsFromDownloadEvent(items, {
        operationId: "op1",
        connectionId: "conn-1",
        bucketName: "bucket-a",
        objectKey: "docs/report.txt",
        transferKind: "cache",
        progressPercent: 100,
        bytesReceived: 10,
        totalBytes: 10,
        state: "completed",
        error: null
      })
    ).toEqual([
      {
        id: "file:docs/report.txt",
        kind: "file",
        name: "report.txt",
        path: "docs/report.txt",
        availabilityStatus: "available",
        downloadState: "downloaded"
      }
    ]);
  });

  it("builds completion and error toasts", () => {
    const t = (key: string) => key;

    expect(
      buildDownloadCompletionToast(
        {
          operationId: "op1",
          connectionId: "conn-1",
          bucketName: "bucket-a",
          objectKey: "docs/report.txt",
          transferKind: "direct",
          progressPercent: 100,
          bytesReceived: 10,
          totalBytes: 10,
          state: "completed",
          targetPath: "/tmp/report.txt",
          error: null
        },
        t
      )
    ).toEqual({
      id: "op1",
      title: "content.transfer.download_as_completed",
      description: "/tmp/report.txt",
      tone: "success"
    });

    expect(
      buildUploadCompletionToast(
        {
          operationId: "op2",
          connectionId: "conn-1",
          bucketName: "bucket-a",
          objectKey: "docs/report.txt",
          progressPercent: 100,
          bytesTransferred: 10,
          totalBytes: 10,
          state: "completed",
          localFilePath: "/tmp/report.txt",
          error: null
        },
        t
      )
    ).toEqual({
      id: "op2",
      title: "content.transfer.upload_completed",
      description: "docs/report.txt",
      tone: "success"
    });

    expect(shouldShowTransferError({ state: "failed", error: "boom" })).toBe(true);
    expect(shouldShowTransferError({ state: "completed", error: "boom" })).toBe(false);
    expect(buildTransferErrorToast("toast-1", "boom", t)).toEqual({
      id: "toast-1",
      title: "content.transfer.error_title",
      description: "boom",
      tone: "error"
    });
  });

  it("returns unchanged transfers when operation id is not found", () => {
    const noopPayload = {
      operationId: "unknown",
      connectionId: "conn-1",
      bucketName: "bucket-a",
      objectKey: "file.txt",
      transferKind: "cache" as const,
      progressPercent: 50,
      bytesReceived: 5,
      totalBytes: 10,
      state: "progress" as const,
      error: null
    };

    expect(updateTransfersFromDownloadEvent(currentTransfers, noopPayload)).toBe(currentTransfers);
    expect(
      updateTransfersFromUploadEvent(currentTransfers, {
        ...noopPayload,
        bytesTransferred: 5,
        localFilePath: "/tmp/file.txt"
      })
    ).toBe(currentTransfers);
  });

  it("returns unchanged paths/items for non-cache or non-completed download events", () => {
    const directCompleted = {
      operationId: "op1",
      connectionId: "conn-1",
      bucketName: "bucket-a",
      objectKey: "file.txt",
      transferKind: "direct" as const,
      progressPercent: 100,
      bytesReceived: 10,
      totalBytes: 10,
      state: "completed" as const,
      error: null
    };
    const cacheInProgress = { ...directCompleted, transferKind: "cache" as const, state: "progress" as const };
    const paths: string[] = [];
    const items: NavigationContentExplorerItem[] = [];

    expect(reconcileDownloadedFilePathsFromDownloadEvent(paths, directCompleted)).toBe(paths);
    expect(reconcileDownloadedFilePathsFromDownloadEvent(paths, cacheInProgress)).toBe(paths);
    expect(reconcileContentItemsFromDownloadEvent(items, directCompleted)).toBe(items);
    expect(reconcileContentItemsFromDownloadEvent(items, cacheInProgress)).toBe(items);
  });

  it("does not duplicate an already-tracked file identity in downloaded paths", () => {
    const existing = "conn-1:bucket-a:file.txt";
    const payload = {
      operationId: "op1",
      connectionId: "conn-1",
      bucketName: "bucket-a",
      objectKey: "file.txt",
      transferKind: "cache" as const,
      progressPercent: 100,
      bytesReceived: 10,
      totalBytes: 10,
      state: "completed" as const,
      error: null
    };

    const result = reconcileDownloadedFilePathsFromDownloadEvent([existing], payload);

    expect(result).toEqual([existing]);
    expect(result).toHaveLength(1);
  });

  it("returns null from toast builders for non-qualifying events", () => {
    const t = (key: string) => key;
    const cachePayload = {
      operationId: "op1",
      connectionId: "conn-1",
      bucketName: "bucket-a",
      objectKey: "file.txt",
      transferKind: "cache" as const,
      progressPercent: 100,
      bytesReceived: 10,
      totalBytes: 10,
      state: "completed" as const,
      error: null
    };
    const progressPayload = {
      ...cachePayload,
      transferKind: "direct" as const,
      state: "progress" as const
    };

    expect(buildDownloadCompletionToast(cachePayload, t)).toBeNull();
    expect(buildDownloadCompletionToast(progressPayload, t)).toBeNull();

    expect(
      buildUploadCompletionToast(
        {
          operationId: "op1",
          connectionId: "conn-1",
          bucketName: "bucket-a",
          objectKey: "file.txt",
          progressPercent: 50,
          bytesTransferred: 5,
          totalBytes: 10,
          state: "progress",
          localFilePath: "/tmp/file.txt",
          error: null
        },
        t
      )
    ).toBeNull();
  });

  it("uses fallback description when targetPath is null in download toast", () => {
    const t = (key: string) => key;

    const result = buildDownloadCompletionToast(
      {
        operationId: "op1",
        connectionId: "conn-1",
        bucketName: "bucket-a",
        objectKey: "file.txt",
        transferKind: "direct",
        progressPercent: 100,
        bytesReceived: 10,
        totalBytes: 10,
        state: "completed",
        targetPath: null,
        error: null
      },
      t
    );

    expect(result).not.toBeNull();
    expect(result!.description).toBe("content.transfer.download_as_completed_fallback");
  });

  it("returns false from shouldShowTransferError when error is absent", () => {
    expect(shouldShowTransferError({ state: "failed", error: null })).toBe(false);
    expect(shouldShowTransferError({ state: "failed", error: undefined })).toBe(false);
    expect(shouldShowTransferError({ state: "failed" })).toBe(false);
  });

  it("selects the right cancellation command for provider and transfer kind", () => {
    expect(
      getTransferCancellationTarget({ transferKind: "upload", provider: "azure" })
    ).toBe("cancelAzureUpload");
    expect(getTransferCancellationTarget({ transferKind: "upload", provider: "aws" })).toBe(
      "cancelAwsUpload"
    );
    expect(getTransferCancellationTarget({ transferKind: "direct", provider: "azure" })).toBe(
      "cancelAzureDownload"
    );
    expect(getTransferCancellationTarget({ transferKind: "cache", provider: undefined })).toBe(
      "cancelAwsDownload"
    );
  });

  it("uses fallback transfer cancellation message when extraction yields null", () => {
    expect(resolveTransferCancellationErrorMessage("boom", "fallback")).toBe("boom");
    expect(resolveTransferCancellationErrorMessage(null, "fallback")).toBe("fallback");
  });
});
