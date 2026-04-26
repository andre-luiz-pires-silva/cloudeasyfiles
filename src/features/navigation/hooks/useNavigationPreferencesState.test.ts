import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNavigationPreferencesState } from "./useNavigationPreferencesState";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false }));
vi.mock("../../../lib/tauri/commands", () => ({
  validateLocalMappingDirectory: vi.fn().mockResolvedValue(true)
}));
vi.mock("../../settings/persistence/appSettingsStore", () => ({
  appSettingsStore: {
    load: () => ({ globalLocalCacheDirectory: "", contentListingPageSize: undefined }),
    save: vi.fn()
  },
  DEFAULT_CONTENT_LISTING_PAGE_SIZE: 100
}));
vi.mock("../navigationCacheState", () => ({
  loadLegacyGlobalCacheDirectoryCandidateFromStorage: () => undefined
}));
vi.mock("../navigationPreferences", () => ({
  resolveInitialGlobalCacheDirectory: () => "",
  resolveInitialContentListingPageSize: () => 100,
  resolveInitialContentViewMode: (v: string | null) => (v === "compact" ? "compact" : "list"),
  resolveInitialSidebarWidth: (_v: unknown, def: number) => def,
  resolveInitialPreviewPanelWidth: (_v: unknown, def: number) => def
}));

describe("useNavigationPreferencesState", () => {
  let originalLocalStorage: Storage;

  beforeEach(() => {
    originalLocalStorage = window.localStorage;
    const store: Record<string, string> = {};
    vi.spyOn(window, "localStorage", "get").mockReturnValue({
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
      length: 0,
      key: () => null
    } as Storage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns initial values", () => {
    const { result } = renderHook(() => useNavigationPreferencesState());
    expect(result.current.globalLocalCacheDirectory).toBe("");
    expect(result.current.contentListingPageSize).toBe(100);
    expect(result.current.contentViewMode).toBe("list");
    expect(result.current.sidebarWidth).toBe(360);
    expect(result.current.previewPanelWidth).toBe(380);
    expect(result.current.isResizingSidebar).toBe(false);
    expect(result.current.isResizingPreviewPanel).toBe(false);
    expect(result.current.localMappingDirectoryStatus).toBe("missing");
  });

  it("setGlobalLocalCacheDirectory updates state and sets status to valid (non-Tauri)", async () => {
    const { result } = renderHook(() => useNavigationPreferencesState());
    await act(async () => {
      result.current.setGlobalLocalCacheDirectory("/some/path");
    });
    expect(result.current.globalLocalCacheDirectory).toBe("/some/path");
    expect(result.current.localMappingDirectoryStatus).toBe("valid");
  });

  it("setGlobalLocalCacheDirectory with empty string sets status to missing", async () => {
    const { result } = renderHook(() => useNavigationPreferencesState());
    await act(async () => {
      result.current.setGlobalLocalCacheDirectory("/some/path");
    });
    await act(async () => {
      result.current.setGlobalLocalCacheDirectory("   ");
    });
    expect(result.current.localMappingDirectoryStatus).toBe("missing");
  });

  it("setContentViewMode updates contentViewMode", () => {
    const { result } = renderHook(() => useNavigationPreferencesState());
    act(() => {
      result.current.setContentViewMode("compact");
    });
    expect(result.current.contentViewMode).toBe("compact");
  });

  it("setContentListingPageSize updates contentListingPageSize", () => {
    const { result } = renderHook(() => useNavigationPreferencesState());
    act(() => {
      result.current.setContentListingPageSize(50);
    });
    expect(result.current.contentListingPageSize).toBe(50);
  });

  it("startResizing sets isResizingSidebar to true", () => {
    const { result } = renderHook(() => useNavigationPreferencesState());
    act(() => {
      result.current.startResizing();
    });
    expect(result.current.isResizingSidebar).toBe(true);
  });

  it("startResizingPreviewPanel sets isResizingPreviewPanel to true", () => {
    const { result } = renderHook(() => useNavigationPreferencesState());
    act(() => {
      result.current.startResizingPreviewPanel();
    });
    expect(result.current.isResizingPreviewPanel).toBe(true);
  });

  it("workspaceRef is a mutable ref object", () => {
    const { result } = renderHook(() => useNavigationPreferencesState());
    expect(result.current.workspaceRef).toBeDefined();
    expect("current" in result.current.workspaceRef).toBe(true);
  });
});
