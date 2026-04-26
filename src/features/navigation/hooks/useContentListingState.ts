import { type Dispatch, type SetStateAction, useState } from "react";
import type { NavigationContentExplorerItem } from "../navigationContent";
import {
  buildInitialFilePreviewState,
  type NavigationFilePreviewState
} from "../navigationFilePreview";

export type ContentMenuAnchor = {
  itemId: string;
  x: number;
  y: number;
};

export type ContentAreaMenuAnchor = {
  x: number;
  y: number;
};

export const ALL_CONTENT_STATUS_FILTERS: Array<
  "directory" | "downloaded" | "available" | "restoring" | "archived"
> = ["directory", "downloaded", "available", "restoring", "archived"];

export type ContentStatusFilter = (typeof ALL_CONTENT_STATUS_FILTERS)[number];

export type ContentListingState = {
  contentItems: NavigationContentExplorerItem[];
  contentContinuationToken: string | null;
  contentHasMore: boolean;
  isLoadingContent: boolean;
  isLoadingMoreContent: boolean;
  contentError: string | null;
  loadMoreContentError: string | null;
  contentActionError: string | null;
  sidebarFilterText: string;
  contentFilterText: string;
  contentStatusFilters: ContentStatusFilter[];
  selectedContentItemIds: string[];
  openContentMenuItemId: string | null;
  contentMenuAnchor: ContentMenuAnchor | null;
  contentAreaMenuAnchor: ContentAreaMenuAnchor | null;
  contentRefreshNonce: number;
  filePreviewState: NavigationFilePreviewState;
  setContentItems: Dispatch<SetStateAction<NavigationContentExplorerItem[]>>;
  setContentContinuationToken: Dispatch<SetStateAction<string | null>>;
  setContentHasMore: Dispatch<SetStateAction<boolean>>;
  setIsLoadingContent: Dispatch<SetStateAction<boolean>>;
  setIsLoadingMoreContent: Dispatch<SetStateAction<boolean>>;
  setContentError: Dispatch<SetStateAction<string | null>>;
  setLoadMoreContentError: Dispatch<SetStateAction<string | null>>;
  setContentActionError: Dispatch<SetStateAction<string | null>>;
  setSidebarFilterText: Dispatch<SetStateAction<string>>;
  setContentFilterText: Dispatch<SetStateAction<string>>;
  setContentStatusFilters: Dispatch<SetStateAction<ContentStatusFilter[]>>;
  setSelectedContentItemIds: Dispatch<SetStateAction<string[]>>;
  setOpenContentMenuItemId: Dispatch<SetStateAction<string | null>>;
  setContentMenuAnchor: Dispatch<SetStateAction<ContentMenuAnchor | null>>;
  setContentAreaMenuAnchor: Dispatch<SetStateAction<ContentAreaMenuAnchor | null>>;
  setContentRefreshNonce: Dispatch<SetStateAction<number>>;
  setFilePreviewState: Dispatch<SetStateAction<NavigationFilePreviewState>>;
};

export function useContentListingState(): ContentListingState {
  const [contentItems, setContentItems] = useState<NavigationContentExplorerItem[]>([]);
  const [contentContinuationToken, setContentContinuationToken] = useState<string | null>(null);
  const [contentHasMore, setContentHasMore] = useState(false);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isLoadingMoreContent, setIsLoadingMoreContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [loadMoreContentError, setLoadMoreContentError] = useState<string | null>(null);
  const [contentActionError, setContentActionError] = useState<string | null>(null);
  const [sidebarFilterText, setSidebarFilterText] = useState("");
  const [contentFilterText, setContentFilterText] = useState("");
  const [contentStatusFilters, setContentStatusFilters] = useState<ContentStatusFilter[]>([]);
  const [selectedContentItemIds, setSelectedContentItemIds] = useState<string[]>([]);
  const [openContentMenuItemId, setOpenContentMenuItemId] = useState<string | null>(null);
  const [contentMenuAnchor, setContentMenuAnchor] = useState<ContentMenuAnchor | null>(null);
  const [contentAreaMenuAnchor, setContentAreaMenuAnchor] = useState<ContentAreaMenuAnchor | null>(
    null
  );
  const [contentRefreshNonce, setContentRefreshNonce] = useState(0);
  const [filePreviewState, setFilePreviewState] = useState<NavigationFilePreviewState>(
    buildInitialFilePreviewState
  );

  return {
    contentItems,
    contentContinuationToken,
    contentHasMore,
    isLoadingContent,
    isLoadingMoreContent,
    contentError,
    loadMoreContentError,
    contentActionError,
    sidebarFilterText,
    contentFilterText,
    contentStatusFilters,
    selectedContentItemIds,
    openContentMenuItemId,
    contentMenuAnchor,
    contentAreaMenuAnchor,
    contentRefreshNonce,
    filePreviewState,
    setContentItems,
    setContentContinuationToken,
    setContentHasMore,
    setIsLoadingContent,
    setIsLoadingMoreContent,
    setContentError,
    setLoadMoreContentError,
    setContentActionError,
    setSidebarFilterText,
    setContentFilterText,
    setContentStatusFilters,
    setSelectedContentItemIds,
    setOpenContentMenuItemId,
    setContentMenuAnchor,
    setContentAreaMenuAnchor,
    setContentRefreshNonce,
    setFilePreviewState
  };
}
