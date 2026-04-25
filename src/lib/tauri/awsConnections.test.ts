import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

import { invoke } from "@tauri-apps/api/core";
import * as awsConnections from "./awsConnections";

const invokeMock = vi.mocked(invoke);

describe("awsConnections", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("forwards AWS read operations to the expected Tauri commands", async () => {
    invokeMock
      .mockResolvedValueOnce({ accountId: "123", arn: "arn:aws:iam::123:user/test", userId: "u1" })
      .mockResolvedValueOnce([{ name: "bucket-a" }])
      .mockResolvedValueOnce("us-east-1")
      .mockResolvedValueOnce({
        bucketRegion: "us-east-1",
        directories: [{ name: "docs", path: "docs/" }],
        files: [{ key: "docs/file.txt", size: 12 }],
        continuationToken: "next-token",
        hasMore: true
      })
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce({ base64: "abc", contentLength: 3 });

    await expect(
      awsConnections.testAwsConnection("AKIA", "SECRET", "bucket-a")
    ).resolves.toEqual({
      accountId: "123",
      arn: "arn:aws:iam::123:user/test",
      userId: "u1"
    });
    await expect(awsConnections.listAwsBuckets("AKIA", "SECRET", "bucket-a")).resolves.toEqual([
      { name: "bucket-a" }
    ]);
    await expect(
      awsConnections.getAwsBucketRegion("AKIA", "SECRET", "bucket-a", "bucket-a")
    ).resolves.toBe("us-east-1");
    await expect(
      awsConnections.listAwsBucketItems(
        "AKIA",
        "SECRET",
        "bucket-a",
        "docs/",
        "us-east-1",
        "token-1",
        "bucket-a",
        200
      )
    ).resolves.toEqual({
      bucketRegion: "us-east-1",
      directories: [{ name: "docs", path: "docs/" }],
      files: [{ key: "docs/file.txt", size: 12 }],
      continuationToken: "next-token",
      hasMore: true
    });
    await expect(
      awsConnections.awsObjectExists(
        "AKIA",
        "SECRET",
        "bucket-a",
        "docs/file.txt",
        "us-east-1",
        "bucket-a"
      )
    ).resolves.toBe(true);
    await expect(
      awsConnections.previewAwsObject(
        "AKIA",
        "SECRET",
        "bucket-a",
        "docs/file.txt",
        3,
        1048576,
        "us-east-1",
        "bucket-a"
      )
    ).resolves.toEqual({ base64: "abc", contentLength: 3 });

    expect(invokeMock).toHaveBeenNthCalledWith(1, "test_aws_connection", {
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET",
      restrictedBucketName: "bucket-a"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "list_aws_buckets", {
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET",
      restrictedBucketName: "bucket-a"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "get_aws_bucket_region", {
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET",
      bucketName: "bucket-a",
      restrictedBucketName: "bucket-a"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(4, "list_aws_bucket_items", {
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET",
      bucketName: "bucket-a",
      prefix: "docs/",
      bucketRegion: "us-east-1",
      continuationToken: "token-1",
      restrictedBucketName: "bucket-a",
      pageSize: 200
    });
    expect(invokeMock).toHaveBeenNthCalledWith(5, "aws_object_exists", {
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET",
      bucketName: "bucket-a",
      objectKey: "docs/file.txt",
      bucketRegion: "us-east-1",
      restrictedBucketName: "bucket-a"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(6, "preview_aws_object", {
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET",
      bucketName: "bucket-a",
      objectKey: "docs/file.txt",
      objectSize: 3,
      maxBytes: 1048576,
      bucketRegion: "us-east-1",
      restrictedBucketName: "bucket-a"
    });
  });

  it("forwards AWS mutation operations to the expected Tauri commands", async () => {
    invokeMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ deletedObjectCount: 2, deletedDirectoryCount: 0 })
      .mockResolvedValueOnce({ deletedObjectCount: 4, deletedDirectoryCount: 1 })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    await expect(
      awsConnections.requestAwsObjectRestore(
        "AKIA",
        "SECRET",
        "bucket-a",
        "archive.zip",
        "GLACIER",
        "bulk",
        7,
        "us-east-1",
        "bucket-a"
      )
    ).resolves.toBeUndefined();
    await expect(
      awsConnections.createAwsFolder(
        "AKIA",
        "SECRET",
        "bucket-a",
        "docs/",
        "reports",
        "us-east-1",
        "bucket-a"
      )
    ).resolves.toBeUndefined();
    await expect(
      awsConnections.deleteAwsObjects(
        "AKIA",
        "SECRET",
        "bucket-a",
        ["a.txt", "b.txt"],
        "us-east-1",
        "bucket-a"
      )
    ).resolves.toEqual({ deletedObjectCount: 2, deletedDirectoryCount: 0 });
    await expect(
      awsConnections.deleteAwsPrefix(
        "AKIA",
        "SECRET",
        "bucket-a",
        "docs/",
        "us-east-1",
        "bucket-a"
      )
    ).resolves.toEqual({ deletedObjectCount: 4, deletedDirectoryCount: 1 });
    await expect(
      awsConnections.changeAwsObjectStorageClass(
        "AKIA",
        "SECRET",
        "bucket-a",
        "report.csv",
        "STANDARD_IA",
        "us-east-1",
        "bucket-a"
      )
    ).resolves.toBeUndefined();
    await expect(awsConnections.openExternalUrl("https://example.com")).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenNthCalledWith(1, "request_aws_object_restore", {
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET",
      bucketName: "bucket-a",
      objectKey: "archive.zip",
      storageClass: "GLACIER",
      bucketRegion: "us-east-1",
      restoreTier: "bulk",
      days: 7,
      restrictedBucketName: "bucket-a"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "create_aws_folder", {
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET",
      bucketName: "bucket-a",
      parentPath: "docs/",
      folderName: "reports",
      bucketRegion: "us-east-1",
      restrictedBucketName: "bucket-a"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "delete_aws_objects", {
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET",
      bucketName: "bucket-a",
      objectKeys: ["a.txt", "b.txt"],
      bucketRegion: "us-east-1",
      restrictedBucketName: "bucket-a"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(4, "delete_aws_prefix", {
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET",
      bucketName: "bucket-a",
      prefix: "docs/",
      bucketRegion: "us-east-1",
      restrictedBucketName: "bucket-a"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(5, "change_aws_object_storage_class", {
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET",
      bucketName: "bucket-a",
      objectKey: "report.csv",
      targetStorageClass: "STANDARD_IA",
      bucketRegion: "us-east-1",
      restrictedBucketName: "bucket-a"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(6, "open_external_url", {
      url: "https://example.com"
    });
  });

  it("forwards AWS download, upload, cache, and open commands to the expected Tauri commands", async () => {
    invokeMock
      .mockResolvedValueOnce("/cache/docs/file.txt")
      .mockResolvedValueOnce("/downloads/file.txt")
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce("upload-1")
      .mockResolvedValueOnce("upload-2")
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(["/cache/docs/file.txt"])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    await expect(
      awsConnections.startAwsCacheDownload(
        "op-1",
        "AKIA",
        "SECRET",
        "conn-1",
        "Primary",
        "bucket-a",
        "docs/file.txt",
        "/cache",
        "us-east-1",
        "bucket-a"
      )
    ).resolves.toBe("/cache/docs/file.txt");
    await expect(
      awsConnections.downloadAwsObjectToPath(
        "op-2",
        "AKIA",
        "SECRET",
        "conn-1",
        "bucket-a",
        "docs/file.txt",
        "/downloads/file.txt",
        "us-east-1",
        "bucket-a"
      )
    ).resolves.toBe("/downloads/file.txt");
    await expect(awsConnections.cancelAwsDownload("op-2")).resolves.toBeUndefined();
    await expect(
      awsConnections.startAwsUpload(
        "op-3",
        "AKIA",
        "SECRET",
        "conn-1",
        "bucket-a",
        "docs/file.txt",
        "/tmp/file.txt",
        "STANDARD",
        "us-east-1",
        "bucket-a"
      )
    ).resolves.toBe("upload-1");
    await expect(
      awsConnections.startAwsUploadFromBytes(
        "op-4",
        "AKIA",
        "SECRET",
        "conn-1",
        "bucket-a",
        "docs/raw.bin",
        "raw.bin",
        new Uint8Array([1, 2, 3]),
        "GLACIER",
        "us-east-1",
        "bucket-a"
      )
    ).resolves.toBe("upload-2");
    await expect(awsConnections.cancelAwsUpload("op-4")).resolves.toBeUndefined();
    await expect(
      awsConnections.findAwsCachedObjects(
        "conn-1",
        "Primary",
        "bucket-a",
        "/cache",
        ["docs/file.txt"]
      )
    ).resolves.toEqual(["/cache/docs/file.txt"]);
    await expect(
      awsConnections.openAwsCachedObjectParent(
        "conn-1",
        "Primary",
        "bucket-a",
        "/cache",
        "docs/file.txt"
      )
    ).resolves.toBeUndefined();
    await expect(
      awsConnections.openAwsCachedObject(
        "conn-1",
        "Primary",
        "bucket-a",
        "/cache",
        "docs/file.txt"
      )
    ).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenNthCalledWith(1, "start_aws_cache_download", {
      operationId: "op-1",
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET",
      connectionId: "conn-1",
      connectionName: "Primary",
      bucketName: "bucket-a",
      objectKey: "docs/file.txt",
      globalLocalCacheDirectory: "/cache",
      bucketRegion: "us-east-1",
      restrictedBucketName: "bucket-a"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "download_aws_object_to_path", {
      operationId: "op-2",
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET",
      connectionId: "conn-1",
      bucketName: "bucket-a",
      objectKey: "docs/file.txt",
      destinationPath: "/downloads/file.txt",
      bucketRegion: "us-east-1",
      restrictedBucketName: "bucket-a"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "cancel_aws_download", {
      operationId: "op-2"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(4, "start_aws_upload", {
      operationId: "op-3",
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET",
      connectionId: "conn-1",
      bucketName: "bucket-a",
      objectKey: "docs/file.txt",
      localFilePath: "/tmp/file.txt",
      storageClass: "STANDARD",
      bucketRegion: "us-east-1",
      restrictedBucketName: "bucket-a"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(5, "start_aws_upload_bytes", {
      operationId: "op-4",
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET",
      connectionId: "conn-1",
      bucketName: "bucket-a",
      objectKey: "docs/raw.bin",
      fileName: "raw.bin",
      fileBytes: [1, 2, 3],
      storageClass: "GLACIER",
      bucketRegion: "us-east-1",
      restrictedBucketName: "bucket-a"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(6, "cancel_aws_upload", {
      operationId: "op-4"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(7, "find_aws_cached_objects", {
      connectionId: "conn-1",
      connectionName: "Primary",
      bucketName: "bucket-a",
      globalLocalCacheDirectory: "/cache",
      objectKeys: ["docs/file.txt"]
    });
    expect(invokeMock).toHaveBeenNthCalledWith(8, "open_aws_cached_object_parent", {
      connectionId: "conn-1",
      connectionName: "Primary",
      bucketName: "bucket-a",
      globalLocalCacheDirectory: "/cache",
      objectKey: "docs/file.txt"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(9, "open_aws_cached_object", {
      connectionId: "conn-1",
      connectionName: "Primary",
      bucketName: "bucket-a",
      globalLocalCacheDirectory: "/cache",
      objectKey: "docs/file.txt"
    });
  });
});
