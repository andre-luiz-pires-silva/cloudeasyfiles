import { describe, expect, it, vi } from "vitest";

import {
  buildUploadPreparationIssueMessages,
  buildUploadTransferEntry,
  hydratePreparedUploadBatchItems,
  normalizeUploadBatchPaths,
  prepareUploadBatchCandidates
} from "./navigationUploadPreparation";

describe("navigationUploadPreparation", () => {
  it("normalizes upload paths", () => {
    expect(normalizeUploadBatchPaths([" /tmp/a.txt ", "", "   ", "/tmp/b.txt"])).toEqual([
      "/tmp/a.txt",
      "/tmp/b.txt"
    ]);
  });

  it("prepares upload candidates and reports invalid or duplicate inputs", () => {
    const activeTransferIdentityMap = new Map([
      ["conn-1:bucket-a:docs/existing.txt", {} as never]
    ]);

    expect(
      prepareUploadBatchCandidates({
        inputs: [
          { fileName: " report.txt " },
          { fileName: "report.txt" },
          { fileName: "existing.txt" },
          { fileName: "   " }
        ],
        selectedBucketConnectionId: "conn-1",
        selectedBucketName: "bucket-a",
        selectedBucketPath: "docs",
        activeTransferIdentityMap
      })
    ).toEqual({
      preparedItems: [
        {
          fileName: "report.txt",
          objectKey: "docs/report.txt",
          fileIdentity: "conn-1:bucket-a:docs/report.txt"
        }
      ],
      issues: [
        { kind: "duplicate_batch", fileName: "report.txt" },
        { kind: "duplicate_active" },
        { kind: "invalid_path" }
      ]
    });
  });

  it("builds upload transfer entries", () => {
    expect(
      buildUploadTransferEntry({
        operationId: "op-1",
        input: {
          fileIdentity: "conn-1:bucket-a:docs/report.txt",
          fileName: "report.txt",
          objectKey: "docs/report.txt",
          localFilePath: "/tmp/report.txt"
        },
        selectedBucketName: "bucket-a",
        selectedBucketProvider: "aws"
      })
    ).toEqual({
      operationId: "op-1",
      itemId: "upload:docs/report.txt",
      fileIdentity: "conn-1:bucket-a:docs/report.txt",
      fileName: "report.txt",
      bucketName: "bucket-a",
      provider: "aws",
      transferKind: "upload",
      progressPercent: 0,
      bytesTransferred: 0,
      totalBytes: 0,
      state: "progress",
      objectKey: "docs/report.txt",
      localFilePath: "/tmp/report.txt"
    });
  });

  it("maps upload preparation issues to user-facing messages", () => {
    const t = (key: string) => key;

    expect(
      buildUploadPreparationIssueMessages(
        [
          { kind: "invalid_path" },
          { kind: "duplicate_batch", fileName: "report.txt" },
          { kind: "duplicate_active" }
        ],
        t
      )
    ).toEqual([
      "content.transfer.upload_invalid_path",
      "content.transfer.upload_duplicate_batch".replace("{name}", "report.txt"),
      "content.transfer.upload_duplicate_active"
    ]);
  });

  it("hydrates prepared upload items using provider-specific existence checks", async () => {
    const awsObjectExists = vi.fn().mockResolvedValueOnce(true);
    const azureBlobExists = vi.fn();

    await expect(
      hydratePreparedUploadBatchItems({
        provider: "aws",
        draft: {
          accessKeyId: " AKIA ",
          secretAccessKey: " SECRET ",
          restrictedBucketName: "bucket-a"
        },
        selectedBucketName: "bucket-a",
        selectedBucketRegion: "us-east-1",
        bucketRegionPlaceholder: "...",
        candidateItems: [
          {
            fileName: "report.txt",
            objectKey: "docs/report.txt",
            fileIdentity: "conn-1:bucket-a:docs/report.txt"
          }
        ],
        isUploadExistsPreflightPermissionError: () => false,
        awsObjectExists,
        azureBlobExists
      })
    ).resolves.toEqual([
      {
        fileName: "report.txt",
        objectKey: "docs/report.txt",
        fileIdentity: "conn-1:bucket-a:docs/report.txt",
        objectAlreadyExists: true
      }
    ]);

    expect(awsObjectExists).toHaveBeenCalledWith(
      "AKIA",
      "SECRET",
      "bucket-a",
      "docs/report.txt",
      "us-east-1",
      "bucket-a"
    );
    expect(azureBlobExists).not.toHaveBeenCalled();
  });

  it("swallows preflight permission errors and continues with objectAlreadyExists false", async () => {
    const permissionError = new Error("AccessDenied");
    const awsObjectExists = vi.fn().mockRejectedValue(permissionError);
    const azureBlobExists = vi.fn().mockResolvedValue(true);

    await expect(
      hydratePreparedUploadBatchItems({
        provider: "azure",
        draft: {
          storageAccountName: "storage-a",
          accountKey: " key "
        },
        selectedBucketName: "bucket-a",
        selectedBucketRegion: "...",
        bucketRegionPlaceholder: "...",
        candidateItems: [
          {
            fileName: "archive.zip",
            objectKey: "docs/archive.zip",
            fileIdentity: "conn-1:bucket-a:docs/archive.zip"
          }
        ],
        isUploadExistsPreflightPermissionError: (error) => error === permissionError,
        awsObjectExists,
        azureBlobExists
      })
    ).resolves.toEqual([
      {
        fileName: "archive.zip",
        objectKey: "docs/archive.zip",
        fileIdentity: "conn-1:bucket-a:docs/archive.zip",
        objectAlreadyExists: true
      }
    ]);

    await expect(
      hydratePreparedUploadBatchItems({
        provider: "aws",
        draft: {
          accessKeyId: "AKIA",
          secretAccessKey: "SECRET"
        },
        selectedBucketName: "bucket-a",
        selectedBucketRegion: "...",
        bucketRegionPlaceholder: "...",
        candidateItems: [
          {
            fileName: "report.txt",
            objectKey: "docs/report.txt",
            fileIdentity: "conn-1:bucket-a:docs/report.txt"
          }
        ],
        isUploadExistsPreflightPermissionError: (error) => error === permissionError,
        awsObjectExists,
        azureBlobExists: vi.fn()
      })
    ).resolves.toEqual([
      {
        fileName: "report.txt",
        objectKey: "docs/report.txt",
        fileIdentity: "conn-1:bucket-a:docs/report.txt",
        objectAlreadyExists: false
      }
    ]);
  });
});
