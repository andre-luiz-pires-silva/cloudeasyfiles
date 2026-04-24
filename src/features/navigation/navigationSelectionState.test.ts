import { describe, expect, it } from "vitest";

import type { NavigationContentExplorerItem } from "./navigationContent";
import {
  buildContentSelectionState,
  buildSelectableContentItems,
  clearContentSelectionState,
  toggleAllVisibleContentSelection,
  toggleContentSelectionItem
} from "./navigationSelectionState";

describe("navigationSelectionState", () => {
  const items: NavigationContentExplorerItem[] = [
    { id: "d1", kind: "directory", name: "docs", path: "docs/" },
    { id: "f1", kind: "file", name: "a.txt", path: "docs/a.txt" },
    { id: "f2", kind: "file", name: "b.txt", path: "docs/b.txt" }
  ];

  it("builds derived selection state from all items, filtered items, and selected ids", () => {
    expect(
      buildContentSelectionState({
        items,
        filteredItems: [items[1]!, items[2]!],
        selectedItemIds: ["f1", "f2"]
      })
    ).toMatchObject({
      selectedItems: [items[1], items[2]],
      selectedCount: 2,
      isSelectionActive: true,
      visibleItemIds: ["f1", "f2"],
      allVisibleItemsSelected: true
    });
  });

  it("toggles individual and visible content selection", () => {
    expect(toggleContentSelectionItem(["f1"], "f2")).toEqual(["f1", "f2"]);
    expect(toggleContentSelectionItem(["f1"], "f1")).toEqual([]);
    expect(toggleAllVisibleContentSelection(["f1"], ["f1", "f2"])).toEqual(["f1", "f2"]);
    expect(toggleAllVisibleContentSelection(["f1", "f2"], ["f1", "f2"])).toEqual([]);
    expect(toggleAllVisibleContentSelection(["f1"], [])).toEqual(["f1"]);
  });

  it("clears selection state and resolves selectable items from a set", () => {
    expect(clearContentSelectionState()).toEqual([]);
    expect(buildSelectableContentItems(items, new Set(["d1", "f2"]))).toEqual([
      items[0],
      items[2]
    ]);
  });
});
