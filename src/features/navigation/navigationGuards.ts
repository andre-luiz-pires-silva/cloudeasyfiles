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

export type ContentDeletePlan = {
  fileKeys: string[];
  directoryPrefixes: string[];
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
