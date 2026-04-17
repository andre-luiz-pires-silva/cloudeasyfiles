import type { NavigationContentExplorerItem } from "./navigationContent";
import {
  getSummaryContentStatuses,
  matchesFilter,
  type NavigationContentStatusFilter
} from "./navigationPresentation";

type NavigationBucketNode = {
  name: string;
  region?: string;
  bucketName?: string;
};

type ContentSummaryItem = {
  key: NavigationContentStatusFilter;
  label: string;
  count: number;
};

export function isContentStatusFilterInactive(params: {
  contentStatusFilters: NavigationContentStatusFilter[];
  allContentStatusFilters: NavigationContentStatusFilter[];
}): boolean {
  return (
    params.contentStatusFilters.length === 0 ||
    params.contentStatusFilters.length === params.allContentStatusFilters.length
  );
}

export function isContentFilterActive(params: {
  normalizedContentFilter: string;
  isStatusFilterInactive: boolean;
}): boolean {
  return params.normalizedContentFilter.length > 0 || !params.isStatusFilterInactive;
}

export function buildContentCounts(params: {
  selectedNodeKind: "connection" | "bucket" | null | undefined;
  connectionBucketCount: number;
  contentItemCount: number;
  filteredConnectionBucketCount: number;
  filteredContentItemCount: number;
}) {
  return {
    loadedContentCount:
      params.selectedNodeKind === "connection"
        ? params.connectionBucketCount
        : params.selectedNodeKind === "bucket"
        ? params.contentItemCount
        : 0,
    displayedContentCount:
      params.selectedNodeKind === "connection"
        ? params.filteredConnectionBucketCount
        : params.selectedNodeKind === "bucket"
        ? params.filteredContentItemCount
        : 0
  };
}

export function filterConnectionBuckets<T extends NavigationBucketNode>(
  bucketNodes: T[],
  normalizedFilter: string
): T[] {
  if (!normalizedFilter) {
    return bucketNodes;
  }

  return bucketNodes.filter((bucketNode) =>
    matchesFilter([bucketNode.name, bucketNode.region, bucketNode.bucketName], normalizedFilter)
  );
}

export function filterContentItems(params: {
  items: NavigationContentExplorerItem[];
  normalizedFilter: string;
  contentStatusFilters: NavigationContentStatusFilter[];
  allContentStatusFilters: NavigationContentStatusFilter[];
}): NavigationContentExplorerItem[] {
  const isStatusFilterInactive =
    params.contentStatusFilters.length === 0 ||
    params.contentStatusFilters.length === params.allContentStatusFilters.length;

  return params.items.filter((item) => {
    const matchesTextFilter = matchesFilter(
      [item.name, item.path, item.storageClass, item.kind],
      params.normalizedFilter
    );

    if (!matchesTextFilter) {
      return false;
    }

    if (isStatusFilterInactive) {
      return true;
    }

    const itemStatuses = getSummaryContentStatuses(item);
    return itemStatuses.some((status) => params.contentStatusFilters.includes(status));
  });
}

export function countLoadedItemsByStatus(
  items: NavigationContentExplorerItem[],
  status: Exclude<NavigationContentStatusFilter, "directory">
): number {
  return items.filter((item) => getSummaryContentStatuses(item).includes(status)).length;
}

export function buildContentStatusSummaryItems(params: {
  isBucketSelected: boolean;
  loadedDirectoryCount: number;
  loadedDownloadedCount: number;
  loadedAvailableCount: number;
  loadedRestoringCount: number;
  loadedArchivedCount: number;
  t: (key: string) => string;
}): ContentSummaryItem[] {
  if (!params.isBucketSelected) {
    return [];
  }

  return [
    {
      key: "directory",
      label: params.t("content.filter.status.directory"),
      count: params.loadedDirectoryCount
    },
    {
      key: "downloaded",
      label: params.t("content.download_state.downloaded"),
      count: params.loadedDownloadedCount
    },
    {
      key: "available",
      label: params.t("content.availability.available"),
      count: params.loadedAvailableCount
    },
    {
      key: "restoring",
      label: params.t("content.availability.restoring"),
      count: params.loadedRestoringCount
    },
    {
      key: "archived",
      label: params.t("content.availability.archived"),
      count: params.loadedArchivedCount
    }
  ];
}
