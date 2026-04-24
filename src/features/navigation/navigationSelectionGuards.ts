import type { ConnectionProvider } from "../connections/models";
import type {
  NavigationBatchSelectionActions,
  NavigationActionContext,
  NavigationContentItem,
  NavigationPendingDeleteState
} from "./navigationTypes";
import { buildContentDeletePlan } from "./navigationOperationBuilders";
import { canChangeTierItem, canDownloadItem, canRestoreItem } from "./navigationItemGuards";

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
