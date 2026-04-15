import type { NavigationContentExplorerItem } from "./navigationContent";
import type { CloudContainerItemsResult } from "./providerReadAdapters";

export type NavigationContentLoadingState<T extends NavigationContentExplorerItem> = {
  contentItems: T[];
  continuationToken: string | null;
  hasMore: boolean;
  isLoadingContent: boolean;
  isLoadingMoreContent: boolean;
  contentError: string | null;
  contentActionError?: string | null;
  loadMoreContentError: string | null;
};

export function buildContentResetState<T extends NavigationContentExplorerItem>(): NavigationContentLoadingState<T> {
  return {
    contentItems: [],
    continuationToken: null,
    hasMore: false,
    isLoadingContent: false,
    isLoadingMoreContent: false,
    contentError: null,
    contentActionError: null,
    loadMoreContentError: null
  };
}

export function buildInitialContentLoadingState<T extends NavigationContentExplorerItem>(): NavigationContentLoadingState<T> {
  return {
    contentItems: [],
    continuationToken: null,
    hasMore: false,
    isLoadingContent: true,
    isLoadingMoreContent: false,
    contentError: null,
    contentActionError: null,
    loadMoreContentError: null
  };
}

export function buildInitialContentSuccessState<T extends NavigationContentExplorerItem>(
  contentItems: T[],
  result: Pick<CloudContainerItemsResult, "continuationToken" | "hasMore">
): NavigationContentLoadingState<T> {
  return {
    contentItems,
    continuationToken: result.continuationToken ?? null,
    hasMore: result.hasMore,
    isLoadingContent: false,
    isLoadingMoreContent: false,
    contentError: null,
    contentActionError: null,
    loadMoreContentError: null
  };
}

export function buildInitialContentFailureState<T extends NavigationContentExplorerItem>(
  message: string
): NavigationContentLoadingState<T> {
  return {
    contentItems: [],
    continuationToken: null,
    hasMore: false,
    isLoadingContent: false,
    isLoadingMoreContent: false,
    contentError: message,
    contentActionError: null,
    loadMoreContentError: null
  };
}

export function buildLoadMoreStartState<T extends NavigationContentExplorerItem>(
  currentItems: T[],
  continuationToken: string | null,
  hasMore: boolean
): NavigationContentLoadingState<T> {
  return {
    contentItems: currentItems,
    continuationToken,
    hasMore,
    isLoadingContent: false,
    isLoadingMoreContent: true,
    contentError: null,
    loadMoreContentError: null
  };
}

export function buildLoadMoreSuccessState<T extends NavigationContentExplorerItem>(
  contentItems: T[],
  result: Pick<CloudContainerItemsResult, "continuationToken" | "hasMore">
): NavigationContentLoadingState<T> {
  return {
    contentItems,
    continuationToken: result.continuationToken ?? null,
    hasMore: result.hasMore,
    isLoadingContent: false,
    isLoadingMoreContent: false,
    contentError: null,
    loadMoreContentError: null
  };
}

export function buildLoadMoreFailureState<T extends NavigationContentExplorerItem>(
  currentItems: T[],
  continuationToken: string | null,
  hasMore: boolean,
  message: string
): NavigationContentLoadingState<T> {
  return {
    contentItems: currentItems,
    continuationToken,
    hasMore,
    isLoadingContent: false,
    isLoadingMoreContent: false,
    contentError: null,
    loadMoreContentError: message
  };
}

export function getRegionUpdate(
  resultRegion: string | null | undefined,
  selectedBucketRegion: string | null,
  selectedBucketId: string | null
): string | null {
  if (!resultRegion || resultRegion === selectedBucketRegion || !selectedBucketId) {
    return null;
  }

  return resultRegion;
}
