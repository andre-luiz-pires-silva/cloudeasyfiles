import {
  DEFAULT_CONTENT_LISTING_PAGE_SIZE,
  MAX_CONTENT_LISTING_PAGE_SIZE,
  MIN_CONTENT_LISTING_PAGE_SIZE,
  normalizeContentListingPageSize
} from "../settings/persistence/appSettingsStore";

type StoredConnectionMetadata = Record<string, { localCacheDirectory?: unknown }>;

export function parseLegacyGlobalCacheDirectoryCandidate(
  rawValue: string | null | undefined
): string | undefined {
  if (!rawValue) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }

    for (const candidate of Object.values(parsed as StoredConnectionMetadata)) {
      if (
        candidate &&
        typeof candidate === "object" &&
        "localCacheDirectory" in candidate &&
        typeof candidate.localCacheDirectory === "string"
      ) {
        const normalizedPath = candidate.localCacheDirectory.trim();

        if (normalizedPath) {
          return normalizedPath;
        }
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function resolveInitialGlobalCacheDirectory(params: {
  settingsDirectory?: string | null;
  legacyDirectoryCandidate?: string | null;
}): string {
  const settingsDirectory = params.settingsDirectory?.trim();

  if (settingsDirectory) {
    return settingsDirectory;
  }

  return params.legacyDirectoryCandidate?.trim() ?? "";
}

export function resolveInitialContentListingPageSize(
  storedPageSize: number | null | undefined
): number {
  if (typeof storedPageSize === "number") {
    return normalizeContentListingPageSize(storedPageSize);
  }

  return DEFAULT_CONTENT_LISTING_PAGE_SIZE;
}

export function resolveInitialContentViewMode(
  storedMode: string | null | undefined
): "list" | "compact" {
  return storedMode === "compact" ? "compact" : "list";
}

export function resolveInitialSidebarWidth(
  storedSidebarWidth: string | null | undefined,
  defaultSidebarWidth: number,
  minSidebarWidth: number,
  maxSidebarWidth: number
): number {
  if (!storedSidebarWidth) {
    return defaultSidebarWidth;
  }

  const parsedSidebarWidth = Number(storedSidebarWidth);

  if (!Number.isFinite(parsedSidebarWidth)) {
    return defaultSidebarWidth;
  }

  return Math.min(Math.max(parsedSidebarWidth, minSidebarWidth), maxSidebarWidth);
}

export function resolveInitialPreviewPanelWidth(
  storedPreviewPanelWidth: string | null | undefined,
  defaultPreviewPanelWidth: number,
  minPreviewPanelWidth: number,
  maxPreviewPanelWidth: number
): number {
  if (!storedPreviewPanelWidth) {
    return defaultPreviewPanelWidth;
  }

  const parsedPreviewPanelWidth = Number(storedPreviewPanelWidth);

  if (!Number.isFinite(parsedPreviewPanelWidth)) {
    return defaultPreviewPanelWidth;
  }

  return Math.min(Math.max(parsedPreviewPanelWidth, minPreviewPanelWidth), maxPreviewPanelWidth);
}

export const navigationPreferenceBounds = {
  defaultContentListingPageSize: DEFAULT_CONTENT_LISTING_PAGE_SIZE,
  minContentListingPageSize: MIN_CONTENT_LISTING_PAGE_SIZE,
  maxContentListingPageSize: MAX_CONTENT_LISTING_PAGE_SIZE
} as const;
