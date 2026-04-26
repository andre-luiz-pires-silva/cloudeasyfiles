import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ALL_CONTENT_STATUS_FILTERS,
  useContentListingState,
  type ContentStatusFilter
} from "./useContentListingState";
import type { NavigationContentExplorerItem } from "../navigationContent";

const fileItem: NavigationContentExplorerItem = {
  id: "file:reports/a.txt",
  kind: "file",
  name: "a.txt",
  path: "reports/a.txt",
  size: 42,
  availabilityStatus: "available",
  downloadState: "not_downloaded"
};

const directoryItem: NavigationContentExplorerItem = {
  id: "directory:reports",
  kind: "directory",
  name: "reports",
  path: "reports/"
};

describe("useContentListingState", () => {
  it("returns initial content listing values", () => {
    const { result } = renderHook(() => useContentListingState());

    expect(result.current.contentItems).toEqual([]);
    expect(result.current.contentContinuationToken).toBeNull();
    expect(result.current.contentHasMore).toBe(false);
    expect(result.current.isLoadingContent).toBe(false);
    expect(result.current.isLoadingMoreContent).toBe(false);
    expect(result.current.contentError).toBeNull();
    expect(result.current.loadMoreContentError).toBeNull();
    expect(result.current.contentActionError).toBeNull();
    expect(result.current.sidebarFilterText).toBe("");
    expect(result.current.contentFilterText).toBe("");
    expect(result.current.contentStatusFilters).toEqual([]);
    expect(result.current.selectedContentItemIds).toEqual([]);
    expect(result.current.openContentMenuItemId).toBeNull();
    expect(result.current.contentMenuAnchor).toBeNull();
    expect(result.current.contentAreaMenuAnchor).toBeNull();
    expect(result.current.contentRefreshNonce).toBe(0);
    expect(result.current.filePreviewState).toEqual({
      isEnabled: false,
      selectedItemId: null,
      requestId: 0,
      isLoading: false,
      payload: null,
      error: null
    });
  });

  it("updates listed content and pagination state", () => {
    const { result } = renderHook(() => useContentListingState());

    act(() => {
      result.current.setContentItems([directoryItem, fileItem]);
      result.current.setContentContinuationToken("next-page");
      result.current.setContentHasMore(true);
    });

    expect(result.current.contentItems).toEqual([directoryItem, fileItem]);
    expect(result.current.contentContinuationToken).toBe("next-page");
    expect(result.current.contentHasMore).toBe(true);
  });

  it("updates loading and error states independently", () => {
    const { result } = renderHook(() => useContentListingState());

    act(() => {
      result.current.setIsLoadingContent(true);
      result.current.setIsLoadingMoreContent(true);
      result.current.setContentError("failed to load");
      result.current.setLoadMoreContentError("failed to load more");
      result.current.setContentActionError("action failed");
    });

    expect(result.current.isLoadingContent).toBe(true);
    expect(result.current.isLoadingMoreContent).toBe(true);
    expect(result.current.contentError).toBe("failed to load");
    expect(result.current.loadMoreContentError).toBe("failed to load more");
    expect(result.current.contentActionError).toBe("action failed");
  });

  it("updates text and status filters", () => {
    const { result } = renderHook(() => useContentListingState());
    const filters: ContentStatusFilter[] = ["available", "downloaded"];

    act(() => {
      result.current.setSidebarFilterText("prod");
      result.current.setContentFilterText("invoice");
      result.current.setContentStatusFilters(filters);
    });

    expect(result.current.sidebarFilterText).toBe("prod");
    expect(result.current.contentFilterText).toBe("invoice");
    expect(result.current.contentStatusFilters).toEqual(filters);
    expect(ALL_CONTENT_STATUS_FILTERS).toEqual([
      "directory",
      "downloaded",
      "available",
      "restoring",
      "archived"
    ]);
  });

  it("updates selected content item ids with direct and functional setters", () => {
    const { result } = renderHook(() => useContentListingState());

    act(() => {
      result.current.setSelectedContentItemIds(["file:reports/a.txt"]);
    });
    expect(result.current.selectedContentItemIds).toEqual(["file:reports/a.txt"]);

    act(() => {
      result.current.setSelectedContentItemIds((current) => [...current, "directory:reports"]);
    });
    expect(result.current.selectedContentItemIds).toEqual([
      "file:reports/a.txt",
      "directory:reports"
    ]);
  });

  it("updates content context menu anchors", () => {
    const { result } = renderHook(() => useContentListingState());

    act(() => {
      result.current.setOpenContentMenuItemId(fileItem.id);
      result.current.setContentMenuAnchor({ itemId: fileItem.id, x: 12, y: 34 });
      result.current.setContentAreaMenuAnchor({ x: 56, y: 78 });
    });

    expect(result.current.openContentMenuItemId).toBe(fileItem.id);
    expect(result.current.contentMenuAnchor).toEqual({ itemId: fileItem.id, x: 12, y: 34 });
    expect(result.current.contentAreaMenuAnchor).toEqual({ x: 56, y: 78 });
  });

  it("increments content refresh nonce with functional setter", () => {
    const { result } = renderHook(() => useContentListingState());

    act(() => {
      result.current.setContentRefreshNonce((current) => current + 1);
      result.current.setContentRefreshNonce((current) => current + 1);
    });

    expect(result.current.contentRefreshNonce).toBe(2);
  });

  it("updates file preview state", () => {
    const { result } = renderHook(() => useContentListingState());

    act(() => {
      result.current.setFilePreviewState((currentState) => ({
        ...currentState,
        isEnabled: true,
        selectedItemId: fileItem.id
      }));
    });

    expect(result.current.filePreviewState.isEnabled).toBe(true);
    expect(result.current.filePreviewState.selectedItemId).toBe(fileItem.id);
  });
});
