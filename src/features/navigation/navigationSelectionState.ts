import { toggleSelectedItemId, toggleVisibleSelection } from "./navigationGuards";
import type { NavigationContentExplorerItem } from "./navigationContent";

export type NavigationSelectionState<TItem extends { id: string }> = {
  selectedItemIdSet: Set<string>;
  selectedItems: TItem[];
  selectedCount: number;
  isSelectionActive: boolean;
  visibleItemIds: string[];
  allVisibleItemsSelected: boolean;
};

export function buildContentSelectionState<TItem extends { id: string }>(params: {
  items: TItem[];
  filteredItems: TItem[];
  selectedItemIds: string[];
}): NavigationSelectionState<TItem> {
  const selectedItemIdSet = new Set(params.selectedItemIds);
  const selectedItems = params.items.filter((item) => selectedItemIdSet.has(item.id));
  const visibleItemIds = params.filteredItems.map((item) => item.id);

  return {
    selectedItemIdSet,
    selectedItems,
    selectedCount: selectedItems.length,
    isSelectionActive: selectedItems.length > 0,
    visibleItemIds,
    allVisibleItemsSelected:
      visibleItemIds.length > 0 && visibleItemIds.every((itemId) => selectedItemIdSet.has(itemId))
  };
}

export function toggleContentSelectionItem(currentItemIds: string[], itemId: string): string[] {
  return toggleSelectedItemId(currentItemIds, itemId);
}

export function toggleAllVisibleContentSelection(
  currentItemIds: string[],
  visibleItemIds: string[]
): string[] {
  if (visibleItemIds.length === 0) {
    return currentItemIds;
  }

  return toggleVisibleSelection(currentItemIds, visibleItemIds);
}

export function clearContentSelectionState(): string[] {
  return [];
}

export function buildSelectableContentItems(
  items: NavigationContentExplorerItem[],
  selectedItemIdSet: Set<string>
): NavigationContentExplorerItem[] {
  return items.filter((item) => selectedItemIdSet.has(item.id));
}
