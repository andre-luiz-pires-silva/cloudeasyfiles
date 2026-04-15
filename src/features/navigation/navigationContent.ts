import type { CloudContainerItemsResult } from "./providerReadAdapters";

export type NavigationPreviewAvailabilityStatus = "available" | "archived" | "restoring";
export type NavigationPreviewDownloadState =
  | "not_downloaded"
  | "restoring"
  | "available_to_download"
  | "downloaded";

export type NavigationContentExplorerItem = {
  id: string;
  kind: "directory" | "file";
  name: string;
  path: string;
  size?: number;
  lastModified?: string | null;
  storageClass?: string | null;
  restoreExpiryDate?: string | null;
  availabilityStatus?: NavigationPreviewAvailabilityStatus;
  downloadState?: NavigationPreviewDownloadState;
};

function compareExplorerItems(
  left: Pick<NavigationContentExplorerItem, "kind" | "name">,
  right: Pick<NavigationContentExplorerItem, "kind" | "name">
) {
  if (left.kind !== right.kind) {
    return left.kind === "directory" ? -1 : 1;
  }

  return left.name.localeCompare(right.name, undefined, {
    sensitivity: "base",
    numeric: true
  });
}

export function isArchivedStorageClass(storageClass: string | null | undefined): boolean {
  const normalizedStorageClass = storageClass?.toLocaleLowerCase() ?? "";

  return normalizedStorageClass.includes("archive") || normalizedStorageClass.includes("glacier");
}

export function buildPreviewFileState(
  storageClass: string | null | undefined,
  restoreInProgress?: boolean | null,
  restoreExpiryDate?: string | null
): Pick<NavigationContentExplorerItem, "availabilityStatus" | "downloadState"> {
  const isArchivedTier = isArchivedStorageClass(storageClass);

  if (restoreInProgress) {
    return {
      availabilityStatus: "restoring",
      downloadState: "restoring"
    };
  }

  if (isArchivedTier && restoreExpiryDate) {
    return {
      availabilityStatus: "available",
      downloadState: "not_downloaded"
    };
  }

  if (isArchivedTier) {
    return {
      availabilityStatus: "archived",
      downloadState: "not_downloaded"
    };
  }

  return {
    availabilityStatus: "available",
    downloadState: "not_downloaded"
  };
}

export function buildContentItems(result: CloudContainerItemsResult): NavigationContentExplorerItem[] {
  const directories: NavigationContentExplorerItem[] = result.directories
    .map((directory) => ({
      id: `directory:${directory.path}`,
      kind: "directory" as const,
      name: directory.name,
      path: directory.path
    }))
    .sort(compareExplorerItems);

  const files: NavigationContentExplorerItem[] = result.files
    .map((file) => ({
      ...buildPreviewFileState(file.storageClass, file.restoreInProgress, file.restoreExpiryDate),
      id: `file:${file.path}`,
      kind: "file" as const,
      name: file.path.split("/").pop() || file.path,
      path: file.path,
      size: file.size,
      lastModified: file.lastModified,
      storageClass: file.storageClass,
      restoreExpiryDate: file.restoreExpiryDate
    }))
    .sort(compareExplorerItems);

  return [...directories, ...files];
}

export function mergeContentItems<T extends NavigationContentExplorerItem>(
  currentItems: T[],
  nextItems: T[]
): T[] {
  const mergedItems = new Map<string, T>();

  for (const item of currentItems) {
    mergedItems.set(item.id, item);
  }

  for (const item of nextItems) {
    mergedItems.set(item.id, item);
  }

  return [...mergedItems.values()].sort(compareExplorerItems);
}
