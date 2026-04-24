import { describe, expect, it, vi } from "vitest";

import {
  resolveBrowserFileUploadSource,
  startSimpleUploadForProvider
} from "./navigationUploadExecution";

describe("navigationUploadExecution", () => {
  it("prefers native file paths when available", async () => {
    const file = {
      name: "report.txt",
      path: " /tmp/report.txt ",
      arrayBuffer: vi.fn()
    } as unknown as File & { path?: string; webkitRelativePath?: string };

    await expect(resolveBrowserFileUploadSource(file)).resolves.toEqual({
      kind: "path",
      fileName: "report.txt",
      localFilePath: "/tmp/report.txt"
    });
    expect(file.arrayBuffer).not.toHaveBeenCalled();
  });

  it("falls back to bytes when no path-like metadata is available", async () => {
    const file = {
      name: "archive.zip",
      webkitRelativePath: "",
      arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer)
    } as unknown as File & { path?: string; webkitRelativePath?: string };

    const result = await resolveBrowserFileUploadSource(file);

    expect(result).toEqual({
      kind: "bytes",
      fileName: "archive.zip",
      fileBytes: new Uint8Array([1, 2, 3])
    });
  });

  it("starts AWS uploads using either file paths or byte payloads", async () => {
    const startAwsUpload = vi.fn().mockResolvedValue("op");
    const startAzureUpload = vi.fn();
    const startAwsUploadFromBytes = vi.fn().mockResolvedValue("op");
    const startAzureUploadFromBytes = vi.fn();

    await startSimpleUploadForProvider({
      provider: "aws",
      draft: {
        accessKeyId: " AKIA ",
        secretAccessKey: " SECRET ",
        defaultUploadStorageClass: "STANDARD",
        restrictedBucketName: "bucket-a"
      },
      connectionId: "conn-1",
      bucketName: "bucket-a",
      objectKey: "docs/report.txt",
      bucketRegion: "us-east-1",
      bucketRegionPlaceholder: "...",
      source: {
        kind: "path",
        fileName: "report.txt",
        localFilePath: "/tmp/report.txt"
      },
      operationId: "op-1",
      startAwsUpload,
      startAzureUpload,
      startAwsUploadFromBytes,
      startAzureUploadFromBytes
    });

    await startSimpleUploadForProvider({
      provider: "aws",
      draft: {
        accessKeyId: "AKIA",
        secretAccessKey: "SECRET"
      },
      connectionId: "conn-1",
      bucketName: "bucket-a",
      objectKey: "docs/archive.zip",
      bucketRegion: "...",
      bucketRegionPlaceholder: "...",
      source: {
        kind: "bytes",
        fileName: "archive.zip",
        fileBytes: new Uint8Array([4, 5])
      },
      operationId: "op-2",
      startAwsUpload,
      startAzureUpload,
      startAwsUploadFromBytes,
      startAzureUploadFromBytes
    });

    expect(startAwsUpload).toHaveBeenCalledWith(
      "op-1",
      "AKIA",
      "SECRET",
      "conn-1",
      "bucket-a",
      "docs/report.txt",
      "/tmp/report.txt",
      "STANDARD",
      "us-east-1",
      "bucket-a"
    );
    expect(startAwsUploadFromBytes).toHaveBeenCalledWith(
      "op-2",
      "AKIA",
      "SECRET",
      "conn-1",
      "bucket-a",
      "docs/archive.zip",
      "archive.zip",
      new Uint8Array([4, 5]),
      undefined,
      undefined,
      undefined
    );
    expect(startAzureUpload).not.toHaveBeenCalled();
    expect(startAzureUploadFromBytes).not.toHaveBeenCalled();
  });

  it("starts Azure uploads using either file paths or byte payloads", async () => {
    const startAwsUpload = vi.fn();
    const startAzureUpload = vi.fn().mockResolvedValue("op");
    const startAwsUploadFromBytes = vi.fn();
    const startAzureUploadFromBytes = vi.fn().mockResolvedValue("op");

    await startSimpleUploadForProvider({
      provider: "azure",
      draft: {
        storageAccountName: "storage-a",
        accountKey: " key ",
        defaultUploadTier: "Cool"
      },
      connectionId: "conn-1",
      bucketName: "bucket-a",
      objectKey: "docs/report.txt",
      bucketRegion: "ignored",
      bucketRegionPlaceholder: "...",
      source: {
        kind: "path",
        fileName: "report.txt",
        localFilePath: "/tmp/report.txt"
      },
      operationId: "op-1",
      startAwsUpload,
      startAzureUpload,
      startAwsUploadFromBytes,
      startAzureUploadFromBytes
    });

    await startSimpleUploadForProvider({
      provider: "azure",
      draft: {
        storageAccountName: "storage-a",
        accountKey: "key"
      },
      connectionId: "conn-1",
      bucketName: "bucket-a",
      objectKey: "docs/archive.zip",
      bucketRegion: null,
      bucketRegionPlaceholder: "...",
      source: {
        kind: "bytes",
        fileName: "archive.zip",
        fileBytes: new Uint8Array([7, 8])
      },
      operationId: "op-2",
      startAwsUpload,
      startAzureUpload,
      startAwsUploadFromBytes,
      startAzureUploadFromBytes
    });

    expect(startAzureUpload).toHaveBeenCalledWith(
      "op-1",
      "storage-a",
      "key",
      "conn-1",
      "bucket-a",
      "docs/report.txt",
      "/tmp/report.txt",
      "Cool"
    );
    expect(startAzureUploadFromBytes).toHaveBeenCalledWith(
      "op-2",
      "storage-a",
      "key",
      "conn-1",
      "bucket-a",
      "docs/archive.zip",
      "archive.zip",
      new Uint8Array([7, 8]),
      undefined
    );
    expect(startAwsUpload).not.toHaveBeenCalled();
    expect(startAwsUploadFromBytes).not.toHaveBeenCalled();
  });
});
