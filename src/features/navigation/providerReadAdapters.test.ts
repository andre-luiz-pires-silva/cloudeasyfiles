import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SavedConnectionSummary } from "../connections/models";
import {
  listContainerItemsForSavedConnection,
  listContainersForSavedConnection,
  testConnectionForSavedConnection
} from "./providerReadAdapters";

const {
  mockGetAwsConnectionDraft,
  mockGetAzureConnectionDraft,
  mockListAwsBuckets,
  mockListAzureContainers,
  mockListAwsBucketItems,
  mockListAzureContainerItems,
  mockTestAwsConnection,
  mockTestAzureConnection
} = vi.hoisted(() => ({
  mockGetAwsConnectionDraft: vi.fn(),
  mockGetAzureConnectionDraft: vi.fn(),
  mockListAwsBuckets: vi.fn(),
  mockListAzureContainers: vi.fn(),
  mockListAwsBucketItems: vi.fn(),
  mockListAzureContainerItems: vi.fn(),
  mockTestAwsConnection: vi.fn(),
  mockTestAzureConnection: vi.fn()
}));

vi.mock("../connections/services/connectionService", () => ({
  connectionService: {
    getAwsConnectionDraft: mockGetAwsConnectionDraft,
    getAzureConnectionDraft: mockGetAzureConnectionDraft
  }
}));

vi.mock("../../lib/tauri/awsConnections", () => ({
  listAwsBucketItems: mockListAwsBucketItems,
  listAwsBuckets: mockListAwsBuckets,
  testAwsConnection: mockTestAwsConnection
}));

vi.mock("../../lib/tauri/azureConnections", () => ({
  listAzureContainerItems: mockListAzureContainerItems,
  listAzureContainers: mockListAzureContainers,
  testAzureConnection: mockTestAzureConnection
}));

describe("providerReadAdapters", () => {
  const awsConnection: SavedConnectionSummary = {
    id: "aws-1",
    name: "AWS Main",
    provider: "aws",
    restrictedBucketName: "bucket-a"
  };

  const azureConnection: SavedConnectionSummary = {
    id: "azure-1",
    name: "Azure Main",
    provider: "azure",
    storageAccountName: "mystorage",
    authenticationMethod: "shared_key"
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAwsConnectionDraft.mockResolvedValue({
      id: "aws-1",
      name: "AWS Main",
      provider: "aws",
      accessKeyId: "access",
      secretAccessKey: "secret",
      restrictedBucketName: "bucket-a"
    });

    mockGetAzureConnectionDraft.mockResolvedValue({
      id: "azure-1",
      name: "Azure Main",
      provider: "azure",
      storageAccountName: "mystorage",
      authenticationMethod: "shared_key",
      accountKey: "account-key"
    });
  });

  it("maps aws connection tests and listings to the shared contract", async () => {
    mockTestAwsConnection.mockResolvedValue({ accountId: "123456789012" });
    mockListAwsBuckets.mockResolvedValue([{ name: "bucket-a" }]);
    mockListAwsBucketItems.mockResolvedValue({
      bucketRegion: "us-east-1",
      directories: [{ name: "docs", path: "docs/" }],
      files: [
        {
          key: "docs/report.txt",
          size: 42,
          lastModified: "2026-04-14T00:00:00Z",
          storageClass: "GLACIER",
          restoreInProgress: true,
          restoreExpiryDate: "2026-04-20T00:00:00Z"
        }
      ],
      continuationToken: "cursor-1",
      hasMore: true
    });

    await expect(testConnectionForSavedConnection(awsConnection)).resolves.toEqual({
      provider: "aws",
      accountLabel: "123456789012"
    });

    await expect(listContainersForSavedConnection(awsConnection)).resolves.toEqual([
      { name: "bucket-a", region: null }
    ]);

    await expect(
      listContainerItemsForSavedConnection(awsConnection, "bucket-a", {
        path: "docs",
        region: "us-east-1",
        continuationToken: "cursor-0",
        pageSize: 25
      })
    ).resolves.toEqual({
      provider: "aws",
      region: "us-east-1",
      directories: [{ name: "docs", path: "docs/" }],
      files: [
        {
          path: "docs/report.txt",
          size: 42,
          lastModified: "2026-04-14T00:00:00Z",
          storageClass: "GLACIER",
          restoreInProgress: true,
          restoreExpiryDate: "2026-04-20T00:00:00Z"
        }
      ],
      continuationToken: "cursor-1",
      hasMore: true
    });

    expect(mockListAwsBucketItems).toHaveBeenCalledWith(
      "access",
      "secret",
      "bucket-a",
      "docs",
      "us-east-1",
      "cursor-0",
      "bucket-a",
      25
    );
  });

  it("maps azure connection tests and listings to the shared contract", async () => {
    mockTestAzureConnection.mockResolvedValue({ storageAccountName: "mystorage" });
    mockListAzureContainers.mockResolvedValue([{ name: "container-a" }]);
    mockListAzureContainerItems.mockResolvedValue({
      directories: [{ name: "docs", path: "docs/" }],
      files: [
        {
          name: "docs/report.txt",
          size: 84,
          lastModified: "2026-04-14T00:00:00Z",
          storageClass: "Cool",
          restoreInProgress: false,
          restoreExpiryDate: null
        }
      ],
      continuationToken: null,
      hasMore: false
    });

    await expect(testConnectionForSavedConnection(azureConnection)).resolves.toEqual({
      provider: "azure",
      accountLabel: "mystorage"
    });

    await expect(listContainersForSavedConnection(azureConnection)).resolves.toEqual([
      { name: "container-a", region: null }
    ]);

    await expect(
      listContainerItemsForSavedConnection(azureConnection, "container-a", {
        path: "docs",
        continuationToken: "cursor-0",
        pageSize: 10
      })
    ).resolves.toEqual({
      provider: "azure",
      region: null,
      directories: [{ name: "docs", path: "docs/" }],
      files: [
        {
          path: "docs/report.txt",
          size: 84,
          lastModified: "2026-04-14T00:00:00Z",
          storageClass: "Cool",
          restoreInProgress: false,
          restoreExpiryDate: null
        }
      ],
      continuationToken: null,
      hasMore: false
    });

    expect(mockListAzureContainerItems).toHaveBeenCalledWith(
      "mystorage",
      "account-key",
      "container-a",
      "docs",
      "cursor-0",
      10
    );
  });
});
