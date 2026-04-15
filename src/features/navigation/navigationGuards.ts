import type { ConnectionProvider, SavedConnectionSummary } from "../connections/models";

export type NavigationAvailabilityStatus = "available" | "archived" | "restoring";
export type NavigationDownloadState =
  | "not_downloaded"
  | "restoring"
  | "available_to_download"
  | "downloaded";
export type NavigationTransferKind = "cache" | "direct" | "upload";
export type NavigationRefreshPlan = "noop" | "reconnect-connection" | "reload-bucket";
export type NavigationFileActionId =
  | "download"
  | "downloadAs"
  | "openFile"
  | "openInExplorer"
  | "cancelDownload"
  | "restore"
  | "changeTier"
  | "delete";
export type NavigationFileActionKind =
  | "provider-read"
  | "provider-mutation"
  | "local-read"
  | "transfer-control";

export type NavigationContentItem = {
  id: string;
  kind: "directory" | "file";
  path: string;
  availabilityStatus?: NavigationAvailabilityStatus;
  downloadState?: NavigationDownloadState;
};

export type NavigationTransferSummary = {
  fileIdentity: string;
  transferKind: NavigationTransferKind;
};

export type NavigationActionContext = {
  provider: ConnectionProvider | null | undefined;
  connectionId: string | null;
  bucketName: string | null;
  hasValidLocalCacheDirectory: boolean;
  activeTransferIdentityMap: Map<string, NavigationTransferSummary>;
};

export type NavigationBatchSelectionActions<T extends NavigationContentItem = NavigationContentItem> = {
  downloadableItems: T[];
  restorableItems: T[];
  changeTierableItems: T[];
  deletableItems: T[];
  canBatchDownload: boolean;
  canBatchRestore: boolean;
  canBatchChangeTier: boolean;
  canBatchDelete: boolean;
};

export type ContentDeletePlan = {
  fileKeys: string[];
  directoryPrefixes: string[];
};

export type NavigationPendingDeleteState<T extends NavigationContentItem = NavigationContentItem> = {
  items: T[];
  fileCount: number;
  directoryCount: number;
  plan: ContentDeletePlan;
};

export function normalizeDirectoryPrefix(path: string): string {
  const normalizedPath = path.trim().replace(/^\/+|\/+$/g, "");
  return normalizedPath ? `${normalizedPath}/` : "";
}

export function dedupeDirectoryPrefixes(prefixes: string[]): string[] {
  const uniquePrefixes = [...new Set(prefixes.filter((prefix) => prefix.length > 0))].sort(
    (left, right) => left.length - right.length || left.localeCompare(right)
  );

  return uniquePrefixes.filter(
    (prefix, index) =>
      !uniquePrefixes.slice(0, index).some((candidatePrefix) => prefix.startsWith(candidatePrefix))
  );
}

export function getUploadParentPath(objectKey: string): string {
  const parentPath = objectKey.includes("/")
    ? objectKey.slice(0, objectKey.lastIndexOf("/"))
    : "";

  return normalizeDirectoryPrefix(parentPath);
}

export function buildContentDeletePlan(items: NavigationContentItem[]): ContentDeletePlan {
  const directoryPrefixes = dedupeDirectoryPrefixes(
    items
      .filter((item) => item.kind === "directory")
      .map((item) => normalizeDirectoryPrefix(item.path))
  );
  const fileKeys = [
    ...new Set(
      items
        .filter((item): item is NavigationContentItem & { kind: "file" } => item.kind === "file")
        .map((item) => item.path.trim())
        .filter(
          (objectKey) =>
            objectKey.length > 0 &&
            !directoryPrefixes.some((prefix) => objectKey.startsWith(prefix))
        )
    )
  ];

  return { fileKeys, directoryPrefixes };
}

export function toggleSelectedItemId(currentItemIds: string[], itemId: string): string[] {
  return currentItemIds.includes(itemId)
    ? currentItemIds.filter((currentItemId) => currentItemId !== itemId)
    : [...currentItemIds, itemId];
}

export function toggleVisibleSelection(
  currentItemIds: string[],
  visibleContentItemIds: string[]
): string[] {
  if (visibleContentItemIds.length === 0) {
    return currentItemIds;
  }

  if (visibleContentItemIds.every((itemId) => currentItemIds.includes(itemId))) {
    return currentItemIds.filter((itemId) => !visibleContentItemIds.includes(itemId));
  }

  return [...new Set([...currentItemIds, ...visibleContentItemIds])];
}

export function buildPendingDeleteState<T extends NavigationContentItem>(
  items: T[]
): NavigationPendingDeleteState<T> | null {
  if (items.length === 0) {
    return null;
  }

  return {
    items,
    fileCount: items.filter((item) => item.kind === "file").length,
    directoryCount: items.filter((item) => item.kind === "directory").length,
    plan: buildContentDeletePlan(items)
  };
}

export function buildUploadObjectKey(currentPath: string, fileName: string) {
  const normalizedPath = currentPath.trim().replace(/^\/+|\/+$/g, "");
  return normalizedPath ? `${normalizedPath}/${fileName}` : fileName;
}

export function validateNewFolderNameInput(
  folderName: string,
  t: (key: string) => string
): string | null {
  const normalizedFolderName = folderName.trim();

  if (!normalizedFolderName) {
    return t("content.folder.name_required");
  }

  if (normalizedFolderName.includes("/") || normalizedFolderName.includes("\\")) {
    return t("content.folder.name_invalid");
  }

  return null;
}

export function buildFileIdentity(connectionId: string, bucketName: string, objectKey: string): string {
  return `${connectionId}:${bucketName}:${objectKey}`;
}

export function hasActiveTransferForItem(
  item: NavigationContentItem,
  connectionId: string | null,
  bucketName: string | null,
  activeTransferIdentityMap: Map<string, NavigationTransferSummary>
): boolean {
  if (item.kind !== "file" || !connectionId || !bucketName) {
    return false;
  }

  return activeTransferIdentityMap.has(buildFileIdentity(connectionId, bucketName, item.path));
}

export function canRestoreItem(
  item: NavigationContentItem,
  provider: ConnectionProvider | null | undefined
): boolean {
  return item.kind === "file" && !!provider && item.availabilityStatus === "archived";
}

export function canChangeTierItem(
  item: NavigationContentItem,
  provider: ConnectionProvider | null | undefined
): boolean {
  return item.kind === "file" && !!provider && item.availabilityStatus === "available";
}

export function canDownloadItem(
  item: NavigationContentItem,
  context: NavigationActionContext
): boolean {
  return (
    item.kind === "file" &&
    !!context.provider &&
    context.hasValidLocalCacheDirectory &&
    item.availabilityStatus === "available" &&
    item.downloadState !== "downloaded" &&
    !hasActiveTransferForItem(
      item,
      context.connectionId,
      context.bucketName,
      context.activeTransferIdentityMap
    )
  );
}

export function canDownloadAsItem(
  item: NavigationContentItem,
  context: NavigationActionContext,
  activeDirectDownloadItemIds: string[]
): boolean {
  return (
    item.kind === "file" &&
    !!context.provider &&
    item.availabilityStatus === "available" &&
    !hasActiveTransferForItem(
      item,
      context.connectionId,
      context.bucketName,
      context.activeTransferIdentityMap
    ) &&
    !activeDirectDownloadItemIds.includes(item.id)
  );
}

export function isFileIdentityInContext(
  fileIdentity: string,
  connectionId: string,
  bucketName: string,
  items: NavigationContentItem[]
): boolean {
  return items.some(
    (item) =>
      item.kind === "file" &&
      buildFileIdentity(connectionId, bucketName, item.path) === fileIdentity
  );
}

export function getBatchSelectionActions<T extends NavigationContentItem>(
  items: T[],
  context: NavigationActionContext,
  provider: ConnectionProvider | null | undefined
): NavigationBatchSelectionActions<T> {
  const downloadableItems = items.filter((item) => canDownloadItem(item, context));
  const restorableItems = items.filter((item) => canRestoreItem(item, provider));
  const changeTierableItems = items.filter((item) => canChangeTierItem(item, provider));
  const deletableItems = provider ? items : [];

  return {
    downloadableItems,
    restorableItems,
    changeTierableItems,
    deletableItems,
    canBatchDownload: items.length > 0 && downloadableItems.length === items.length,
    canBatchRestore: items.length > 0 && restorableItems.length === items.length,
    canBatchChangeTier: items.length > 0 && changeTierableItems.length === items.length,
    canBatchDelete: items.length > 0 && deletableItems.length === items.length
  };
}

export function getStartupAutoConnectConnections(
  connections: SavedConnectionSummary[]
): SavedConnectionSummary[] {
  return connections.filter((connection) => connection.connectOnStartup === true);
}

export function shouldRefreshAfterUploadCompletion(params: {
  uploadConnectionId: string;
  uploadBucketName: string;
  uploadObjectKey: string;
  selectedBucketConnectionId: string | null;
  selectedBucketName: string | null;
  selectedBucketPath: string;
}): boolean {
  if (
    params.uploadConnectionId !== params.selectedBucketConnectionId ||
    params.uploadBucketName !== params.selectedBucketName
  ) {
    return false;
  }

  return getUploadParentPath(params.uploadObjectKey) === normalizeDirectoryPrefix(params.selectedBucketPath);
}

export function getRefreshPlan(params: {
  hasSelectedNode: boolean;
  selectedNodeKind?: "connection" | "bucket";
  connectionStatus?: "disconnected" | "connecting" | "connected" | "error";
  isLoadingContent: boolean;
  isLoadingMoreContent: boolean;
}): NavigationRefreshPlan {
  if (!params.hasSelectedNode) {
    return "noop";
  }

  if (params.selectedNodeKind === "connection") {
    return params.connectionStatus === "connected" ? "reconnect-connection" : "noop";
  }

  if (params.isLoadingContent || params.isLoadingMoreContent) {
    return "noop";
  }

  return "reload-bucket";
}

export function getFileActionKind(actionId: NavigationFileActionId): NavigationFileActionKind {
  switch (actionId) {
    case "restore":
    case "changeTier":
    case "delete":
      return "provider-mutation";
    case "download":
    case "downloadAs":
      return "provider-read";
    case "openFile":
    case "openInExplorer":
      return "local-read";
    case "cancelDownload":
      return "transfer-control";
  }
}
