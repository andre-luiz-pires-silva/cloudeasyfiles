import type { ConnectionProvider, SavedConnectionSummary } from "../connections/models";
import { connectionService } from "../connections/services/connectionService";
import {
  listAwsBucketItems,
  listAwsBuckets,
  testAwsConnection
} from "../../lib/tauri/awsConnections";
import {
  listAzureContainerItems,
  listAzureContainers,
  testAzureConnection
} from "../../lib/tauri/azureConnections";

export type CloudContainerSummary = {
  name: string;
  region?: string | null;
};

export type CloudDirectorySummary = {
  name: string;
  path: string;
};

export type CloudFileSummary = {
  path: string;
  size: number;
  lastModified?: string | null;
  storageClass?: string | null;
  restoreInProgress?: boolean | null;
  restoreExpiryDate?: string | null;
};

export type CloudContainerItemsResult = {
  provider: ConnectionProvider;
  region?: string | null;
  directories: CloudDirectorySummary[];
  files: CloudFileSummary[];
  continuationToken?: string | null;
  hasMore: boolean;
};

export type ProviderConnectionTestSummary = {
  provider: ConnectionProvider;
  accountLabel: string;
};

export async function testConnectionForSavedConnection(
  connection: SavedConnectionSummary
): Promise<ProviderConnectionTestSummary> {
  if (connection.provider === "aws") {
    const draft = await connectionService.getAwsConnectionDraft(connection.id);
    const result = await testAwsConnection(
      draft.accessKeyId.trim(),
      draft.secretAccessKey.trim(),
      draft.restrictedBucketName
    );

    return {
      provider: "aws",
      accountLabel: result.accountId
    };
  }

  const draft = await connectionService.getAzureConnectionDraft(connection.id);
  const result = await testAzureConnection(
    draft.storageAccountName,
    draft.accountKey.trim()
  );

  return {
    provider: "azure",
    accountLabel: result.storageAccountName
  };
}

export async function listContainersForSavedConnection(
  connection: SavedConnectionSummary
): Promise<CloudContainerSummary[]> {
  if (connection.provider === "aws") {
    const draft = await connectionService.getAwsConnectionDraft(connection.id);
    const result = await listAwsBuckets(
      draft.accessKeyId.trim(),
      draft.secretAccessKey.trim(),
      draft.restrictedBucketName
    );

    return result.map((bucket) => ({
      name: bucket.name,
      region: null
    }));
  }

  const draft = await connectionService.getAzureConnectionDraft(connection.id);
  const result = await listAzureContainers(draft.storageAccountName, draft.accountKey.trim());

  return result.map((container) => ({
    name: container.name,
    region: null
  }));
}

export async function listContainerItemsForSavedConnection(
  connection: SavedConnectionSummary,
  containerName: string,
  options: {
    path?: string;
    region?: string | null;
    continuationToken?: string | null;
    pageSize?: number;
  } = {}
): Promise<CloudContainerItemsResult> {
  if (connection.provider === "aws") {
    const draft = await connectionService.getAwsConnectionDraft(connection.id);
    const result = await listAwsBucketItems(
      draft.accessKeyId.trim(),
      draft.secretAccessKey.trim(),
      containerName,
      options.path || undefined,
      options.region ?? undefined,
      options.continuationToken ?? undefined,
      draft.restrictedBucketName,
      options.pageSize
    );

    return {
      provider: "aws",
      region: result.bucketRegion,
      directories: result.directories.map((directory) => ({
        name: directory.name,
        path: directory.path
      })),
      files: result.files.map((file) => ({
        path: file.key,
        size: file.size,
        lastModified: file.lastModified,
        storageClass: file.storageClass,
        restoreInProgress: file.restoreInProgress,
        restoreExpiryDate: file.restoreExpiryDate
      })),
      continuationToken: result.continuationToken,
      hasMore: result.hasMore
    };
  }

  const draft = await connectionService.getAzureConnectionDraft(connection.id);
  const result = await listAzureContainerItems(
    draft.storageAccountName,
    draft.accountKey.trim(),
    containerName,
    options.path || undefined,
    options.continuationToken ?? undefined,
    options.pageSize
  );

  return {
    provider: "azure",
    region: null,
    directories: result.directories.map((directory) => ({
      name: directory.name,
      path: directory.path
    })),
    files: result.files.map((file) => ({
      path: file.name,
      size: file.size,
      lastModified: file.lastModified,
      storageClass: file.storageClass,
      restoreInProgress: file.restoreInProgress,
      restoreExpiryDate: file.restoreExpiryDate
    })),
    continuationToken: result.continuationToken,
    hasMore: result.hasMore
  };
}
