import { isTauri } from "@tauri-apps/api/core";
import { type Dispatch, type MutableRefObject, type SetStateAction, useEffect, useRef, useState } from "react";
import { validateLocalMappingDirectory } from "../../../lib/tauri/commands";
import {
  DEFAULT_CONTENT_LISTING_PAGE_SIZE,
  appSettingsStore
} from "../../settings/persistence/appSettingsStore";
import { loadLegacyGlobalCacheDirectoryCandidateFromStorage } from "../navigationCacheState";
import {
  resolveInitialContentListingPageSize,
  resolveInitialContentViewMode,
  resolveInitialPreviewPanelWidth,
  resolveInitialGlobalCacheDirectory,
  resolveInitialSidebarWidth
} from "../navigationPreferences";

export type ContentViewMode = "list" | "compact";
export type LocalMappingDirectoryStatus = "checking" | "valid" | "invalid" | "missing";

export type NavigationPreferencesState = {
  globalLocalCacheDirectory: string;
  contentListingPageSize: number;
  contentViewMode: ContentViewMode;
  sidebarWidth: number;
  previewPanelWidth: number;
  localMappingDirectoryStatus: LocalMappingDirectoryStatus;
  isResizingSidebar: boolean;
  isResizingPreviewPanel: boolean;
  workspaceRef: MutableRefObject<HTMLDivElement | null>;
  previewResizeContainerRef: MutableRefObject<HTMLDivElement | null>;
  setGlobalLocalCacheDirectory: Dispatch<SetStateAction<string>>;
  setContentListingPageSize: Dispatch<SetStateAction<number>>;
  setContentViewMode: Dispatch<SetStateAction<ContentViewMode>>;
  startResizing: () => void;
  startResizingPreviewPanel: () => void;
};

const DEFAULT_SIDEBAR_WIDTH = 360;
const MIN_SIDEBAR_WIDTH = 300;
const MAX_SIDEBAR_WIDTH = 520;
const MIN_CONTENT_WIDTH = 420;
const DEFAULT_PREVIEW_PANEL_WIDTH = 380;
const MIN_PREVIEW_PANEL_WIDTH = 280;
const MAX_PREVIEW_PANEL_WIDTH = 760;
const MIN_PREVIEW_LIST_WIDTH = 420;

const SIDEBAR_WIDTH_STORAGE_KEY = "cloudeasyfiles.sidebar-width";
const PREVIEW_PANEL_WIDTH_STORAGE_KEY = "cloudeasyfiles.preview-panel-width";
const CONTENT_VIEW_MODE_STORAGE_KEY = "cloudeasyfiles.content-view-mode";
const CONNECTION_METADATA_STORAGE_KEY = "cloudeasyfiles.connection-metadata";

function loadLegacyCacheDirectoryCandidate(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return loadLegacyGlobalCacheDirectoryCandidateFromStorage(
    window.localStorage.getItem(CONNECTION_METADATA_STORAGE_KEY)
  );
}

function loadInitialGlobalCacheDirectory(): string {
  const appSettings = appSettingsStore.load();
  return resolveInitialGlobalCacheDirectory({
    settingsDirectory: appSettings.globalLocalCacheDirectory,
    legacyDirectoryCandidate: loadLegacyCacheDirectoryCandidate()
  });
}

function loadInitialContentListingPageSize(): number {
  return resolveInitialContentListingPageSize(appSettingsStore.load().contentListingPageSize);
}

export function useNavigationPreferencesState(): NavigationPreferencesState {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const previewResizeContainerRef = useRef<HTMLDivElement | null>(null);

  const [globalLocalCacheDirectory, setGlobalLocalCacheDirectory] = useState(
    loadInitialGlobalCacheDirectory
  );
  const [contentListingPageSize, setContentListingPageSize] = useState(
    loadInitialContentListingPageSize
  );
  const [localMappingDirectoryStatus, setLocalMappingDirectoryStatus] =
    useState<LocalMappingDirectoryStatus>(() =>
      loadInitialGlobalCacheDirectory().trim() ? "checking" : "missing"
    );
  const [contentViewMode, setContentViewMode] = useState<ContentViewMode>(() => {
    if (typeof window === "undefined") {
      return "list";
    }
    return resolveInitialContentViewMode(window.localStorage.getItem(CONTENT_VIEW_MODE_STORAGE_KEY));
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_SIDEBAR_WIDTH;
    }
    return resolveInitialSidebarWidth(
      window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY),
      DEFAULT_SIDEBAR_WIDTH,
      MIN_SIDEBAR_WIDTH,
      MAX_SIDEBAR_WIDTH
    );
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [previewPanelWidth, setPreviewPanelWidth] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_PREVIEW_PANEL_WIDTH;
    }
    return resolveInitialPreviewPanelWidth(
      window.localStorage.getItem(PREVIEW_PANEL_WIDTH_STORAGE_KEY),
      DEFAULT_PREVIEW_PANEL_WIDTH,
      MIN_PREVIEW_PANEL_WIDTH,
      MAX_PREVIEW_PANEL_WIDTH
    );
  });
  const [isResizingPreviewPanel, setIsResizingPreviewPanel] = useState(false);

  // Persist sidebar width to localStorage
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(PREVIEW_PANEL_WIDTH_STORAGE_KEY, String(previewPanelWidth));
  }, [previewPanelWidth]);

  // Persist content view mode to localStorage
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(CONTENT_VIEW_MODE_STORAGE_KEY, contentViewMode);
  }, [contentViewMode]);

  // Persist cache directory and page size to app settings
  useEffect(() => {
    appSettingsStore.save({
      globalLocalCacheDirectory: globalLocalCacheDirectory.trim() || undefined,
      contentListingPageSize
    });
  }, [contentListingPageSize, globalLocalCacheDirectory]);

  // Validate cache directory via Tauri
  useEffect(() => {
    let isActive = true;
    const normalizedPath = globalLocalCacheDirectory.trim();

    if (!normalizedPath) {
      setLocalMappingDirectoryStatus("missing");
      return undefined;
    }

    if (!isTauri()) {
      setLocalMappingDirectoryStatus("valid");
      return undefined;
    }

    setLocalMappingDirectoryStatus("checking");

    void (async () => {
      try {
        const isValidDirectory = await validateLocalMappingDirectory(normalizedPath);

        if (!isActive) {
          return;
        }

        setLocalMappingDirectoryStatus(isValidDirectory ? "valid" : "invalid");
      } catch {
        if (!isActive) {
          return;
        }

        setLocalMappingDirectoryStatus("invalid");
      }
    })();

    return () => {
      isActive = false;
    };
  }, [globalLocalCacheDirectory]);

  // Apply col-resize cursor while resizing
  useEffect(() => {
    if (!isResizingSidebar && !isResizingPreviewPanel) {
      return undefined;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizingPreviewPanel, isResizingSidebar]);

  // Pointer event listeners for sidebar resize
  useEffect(() => {
    if (!isResizingSidebar) {
      return undefined;
    }

    function handlePointerMove(event: PointerEvent) {
      const workspaceElement = workspaceRef.current;

      if (!workspaceElement) {
        return;
      }

      const workspaceRect = workspaceElement.getBoundingClientRect();
      const nextWidth = event.clientX - workspaceRect.left;
      const maxWidth = Math.min(MAX_SIDEBAR_WIDTH, workspaceRect.width - MIN_CONTENT_WIDTH);
      const clampedWidth = Math.min(Math.max(nextWidth, MIN_SIDEBAR_WIDTH), maxWidth);

      setSidebarWidth(clampedWidth);
    }

    function handlePointerUp() {
      setIsResizingSidebar(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    if (!isResizingPreviewPanel) {
      return undefined;
    }

    function handlePointerMove(event: PointerEvent) {
      const containerElement = previewResizeContainerRef.current;

      if (!containerElement) {
        return;
      }

      const containerRect = containerElement.getBoundingClientRect();
      const nextWidth = containerRect.right - event.clientX;
      const maxWidth = Math.min(
        MAX_PREVIEW_PANEL_WIDTH,
        containerRect.width - MIN_PREVIEW_LIST_WIDTH
      );
      const clampedWidth = Math.min(
        Math.max(nextWidth, MIN_PREVIEW_PANEL_WIDTH),
        Math.max(MIN_PREVIEW_PANEL_WIDTH, maxWidth)
      );

      setPreviewPanelWidth(clampedWidth);
    }

    function handlePointerUp() {
      setIsResizingPreviewPanel(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizingPreviewPanel]);

  return {
    globalLocalCacheDirectory,
    contentListingPageSize,
    contentViewMode,
    sidebarWidth,
    previewPanelWidth,
    localMappingDirectoryStatus,
    isResizingSidebar,
    isResizingPreviewPanel,
    workspaceRef,
    previewResizeContainerRef,
    setGlobalLocalCacheDirectory,
    setContentListingPageSize,
    setContentViewMode,
    startResizing: () => setIsResizingSidebar(true),
    startResizingPreviewPanel: () => setIsResizingPreviewPanel(true)
  };
}

export { DEFAULT_CONTENT_LISTING_PAGE_SIZE };
