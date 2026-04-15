import { describe, expect, it } from "vitest";

import {
  buildUploadTransferEntry,
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
});
