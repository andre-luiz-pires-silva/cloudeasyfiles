import { describe, expect, it } from "vitest";

import {
  buildContentResetState,
  buildInitialContentFailureState,
  buildInitialContentLoadingState,
  buildInitialContentSuccessState,
  buildLoadMoreFailureState,
  buildLoadMoreStartState,
  buildLoadMoreSuccessState,
  getRegionUpdate
} from "./navigationLoading";
import type { NavigationContentExplorerItem } from "./navigationContent";

describe("navigationLoading", () => {
  const items: NavigationContentExplorerItem[] = [
    { id: "directory:docs/", kind: "directory", name: "docs", path: "docs/" },
    {
      id: "file:docs/report.txt",
      kind: "file",
      name: "report.txt",
      path: "docs/report.txt",
      availabilityStatus: "available",
      downloadState: "not_downloaded"
    }
  ];

  it("builds reset and initial loading states", () => {
    expect(buildContentResetState()).toEqual({
      contentItems: [],
      continuationToken: null,
      hasMore: false,
      isLoadingContent: false,
      isLoadingMoreContent: false,
      contentError: null,
      contentActionError: null,
      loadMoreContentError: null
    });

    expect(buildInitialContentLoadingState()).toEqual({
      contentItems: [],
      continuationToken: null,
      hasMore: false,
      isLoadingContent: true,
      isLoadingMoreContent: false,
      contentError: null,
      contentActionError: null,
      loadMoreContentError: null
    });
  });

  it("builds initial success and failure states", () => {
    expect(
      buildInitialContentSuccessState(items, {
        continuationToken: "next",
        hasMore: true
      })
    ).toEqual({
      contentItems: items,
      continuationToken: "next",
      hasMore: true,
      isLoadingContent: false,
      isLoadingMoreContent: false,
      contentError: null,
      contentActionError: null,
      loadMoreContentError: null
    });

    expect(buildInitialContentFailureState("load failed")).toEqual({
      contentItems: [],
      continuationToken: null,
      hasMore: false,
      isLoadingContent: false,
      isLoadingMoreContent: false,
      contentError: "load failed",
      contentActionError: null,
      loadMoreContentError: null
    });
  });

  it("builds load-more start, success and failure states", () => {
    expect(buildLoadMoreStartState(items, "next", true)).toEqual({
      contentItems: items,
      continuationToken: "next",
      hasMore: true,
      isLoadingContent: false,
      isLoadingMoreContent: true,
      contentError: null,
      loadMoreContentError: null
    });

    expect(
      buildLoadMoreSuccessState(items, {
        continuationToken: null,
        hasMore: false
      })
    ).toEqual({
      contentItems: items,
      continuationToken: null,
      hasMore: false,
      isLoadingContent: false,
      isLoadingMoreContent: false,
      contentError: null,
      loadMoreContentError: null
    });

    expect(buildLoadMoreFailureState(items, "next", true, "load more failed")).toEqual({
      contentItems: items,
      continuationToken: "next",
      hasMore: true,
      isLoadingContent: false,
      isLoadingMoreContent: false,
      contentError: null,
      loadMoreContentError: "load more failed"
    });
  });

  it("proposes region updates only when there is a real change on a selected bucket", () => {
    expect(getRegionUpdate("sa-east-1", "us-east-1", "bucket-1")).toBe("sa-east-1");
    expect(getRegionUpdate("us-east-1", "us-east-1", "bucket-1")).toBeNull();
    expect(getRegionUpdate(null, "us-east-1", "bucket-1")).toBeNull();
    expect(getRegionUpdate("sa-east-1", "us-east-1", null)).toBeNull();
  });
});
