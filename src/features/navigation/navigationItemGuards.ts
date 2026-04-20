import type { ConnectionProvider } from "../connections/models";
import type { NavigationActionContext, NavigationContentItem } from "./navigationTypes";
import { buildFileIdentity } from "./navigationOperationBuilders";

export function hasActiveTransferForItem(
  item: NavigationContentItem,
  connectionId: string | null,
  bucketName: string | null,
  activeTransferIdentityMap: Map<string, import("./navigationTypes").NavigationTransferSummary>
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
