import { buildFileIdentity, isFileIdentityInContext, type NavigationContentItem } from "./navigationGuards";

export type NavigationDownloadState =
  | "not_downloaded"
  | "restoring"
  | "available_to_download"
  | "downloaded";

export type NavigationDownloadableItem = NavigationContentItem & {
  downloadState?: NavigationDownloadState;
};

export function resolveDownloadState<T extends NavigationDownloadableItem>(
  item: T,
  downloadedPaths: Set<string>,
  connectionId: string | null,
  bucketName: string | null,
  hasLocalCacheDirectory: boolean
): NavigationDownloadState | undefined {
  if (item.kind !== "file") {
    return item.downloadState;
  }

  if (item.availabilityStatus === "restoring") {
    return "restoring";
  }

  if (
    connectionId &&
    bucketName &&
    downloadedPaths.has(buildFileIdentity(connectionId, bucketName, item.path))
  ) {
    return "downloaded";
  }

  if (item.availabilityStatus === "available") {
    return hasLocalCacheDirectory ? "available_to_download" : "not_downloaded";
  }

  if (item.availabilityStatus === "archived") {
    return "not_downloaded";
  }

  return item.downloadState;
}

export function applyDownloadedFileState<T extends NavigationDownloadableItem>(
  items: T[],
  downloadedPaths: Set<string>,
  connectionId: string | null,
  bucketName: string | null,
  hasLocalCacheDirectory: boolean
): T[] {
  let hasChanges = false;
  const nextItems = items.map((item) => {
    const nextDownloadState = resolveDownloadState(
      item,
      downloadedPaths,
      connectionId,
      bucketName,
      hasLocalCacheDirectory
    );

    if (item.downloadState === nextDownloadState) {
      return item;
    }

    hasChanges = true;

    return {
      ...item,
      downloadState: nextDownloadState
    };
  });

  return hasChanges ? nextItems : items;
}

export function reconcileDownloadedFilePathsForContext<T extends NavigationContentItem>(
  currentPaths: string[],
  cachedPaths: Set<string>,
  connectionId: string,
  bucketName: string,
  items: T[]
): string[] {
  const nextPaths = currentPaths.filter(
    (path) => !isFileIdentityInContext(path, connectionId, bucketName, items)
  );

  for (const path of cachedPaths) {
    nextPaths.push(path);
  }

  const uniqueNextPaths = [...new Set(nextPaths)];

  if (
    uniqueNextPaths.length === currentPaths.length &&
    uniqueNextPaths.every((path, index) => path === currentPaths[index])
  ) {
    return currentPaths;
  }

  return uniqueNextPaths;
}
