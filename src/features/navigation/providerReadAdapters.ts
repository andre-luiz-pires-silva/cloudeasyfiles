import type { ConnectionProvider, SavedConnectionSummary } from "../connections/models";
import { connectionService } from "../connections/services/connectionService";
import {
  listAwsBucketItems,
  listAwsBuckets,
  previewAwsObject,
  testAwsConnection
} from "../../lib/tauri/awsConnections";
import {
  listAzureContainerItems,
  listAzureContainers,
  previewAzureBlob,
  testAzureConnection
} from "../../lib/tauri/azureConnections";
import {
  FILE_PREVIEW_MAX_BYTES,
  getFilePreviewSupport,
  type NavigationFilePreviewPayload
} from "./navigationFilePreview";
import type { NavigationContentExplorerItem } from "./navigationContent";

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

export type CloudObjectPreviewRequest = {
  connection: SavedConnectionSummary;
  containerName: string;
  item: NavigationContentExplorerItem;
  region?: string | null;
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

export async function previewObjectForSavedConnection({
  connection,
  containerName,
  item,
  region
}: CloudObjectPreviewRequest): Promise<NavigationFilePreviewPayload> {
  const support = getFilePreviewSupport(item);

  if (support.status !== "supported") {
    throw new Error("File is not supported for preview.");
  }

  if (connection.provider === "aws") {
    const draft = await connectionService.getAwsConnectionDraft(connection.id);
    const result = await previewAwsObject(
      draft.accessKeyId.trim(),
      draft.secretAccessKey.trim(),
      containerName,
      item.path,
      item.size ?? 0,
      FILE_PREVIEW_MAX_BYTES,
      region ?? undefined,
      draft.restrictedBucketName
    );

    if (support.kind === "text") {
      return {
        kind: "text",
        content: decodeBase64Utf8(result.base64),
        mimeType: support.mimeType
      };
    }

    return {
      kind: "image",
      base64: result.base64,
      mimeType: support.mimeType
    };
  }

  const draft = await connectionService.getAzureConnectionDraft(connection.id);
  const result = await previewAzureBlob(
    draft.storageAccountName,
    draft.accountKey.trim(),
    containerName,
    item.path,
    item.size ?? 0,
    FILE_PREVIEW_MAX_BYTES
  );

  if (support.kind === "text") {
    return {
      kind: "text",
      content: decodeBase64Utf8(result.base64),
      mimeType: support.mimeType
    };
  }

  return {
    kind: "image",
    base64: result.base64,
    mimeType: support.mimeType
  };
}

function decodeBase64Utf8(value: string): string {
  const binary = globalThis.atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
