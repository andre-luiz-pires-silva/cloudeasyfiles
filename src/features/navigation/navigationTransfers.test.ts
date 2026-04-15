import { describe, expect, it } from "vitest";

import type { NavigationContentExplorerItem } from "./navigationContent";
import {
  buildDownloadCompletionToast,
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
});
