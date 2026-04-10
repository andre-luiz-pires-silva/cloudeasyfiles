export type AppSettings = {
  globalLocalCacheDirectory?: string;
  contentListingPageSize?: number;
};

const STORAGE_KEY = "cloudeasyfiles.app-settings";
export const DEFAULT_CONTENT_LISTING_PAGE_SIZE = 200;
export const MIN_CONTENT_LISTING_PAGE_SIZE = 1;
export const MAX_CONTENT_LISTING_PAGE_SIZE = 1000;

export function normalizeContentListingPageSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_CONTENT_LISTING_PAGE_SIZE;
  }

  const normalizedValue = Math.trunc(value);

  if (normalizedValue < MIN_CONTENT_LISTING_PAGE_SIZE) {
    return MIN_CONTENT_LISTING_PAGE_SIZE;
  }

  if (normalizedValue > MAX_CONTENT_LISTING_PAGE_SIZE) {
    return MAX_CONTENT_LISTING_PAGE_SIZE;
  }

  return normalizedValue;
}

function isAppSettings(value: unknown): value is AppSettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    (typeof candidate.globalLocalCacheDirectory === "string" ||
      typeof candidate.globalLocalCacheDirectory === "undefined") &&
    (typeof candidate.contentListingPageSize === "number" ||
      typeof candidate.contentListingPageSize === "undefined")
  );
}

export class AppSettingsStore {
  load(): AppSettings {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    try {
      const parsedValue = JSON.parse(rawValue);
      return isAppSettings(parsedValue)
        ? {
            globalLocalCacheDirectory: parsedValue.globalLocalCacheDirectory,
            contentListingPageSize:
              typeof parsedValue.contentListingPageSize === "number"
                ? normalizeContentListingPageSize(parsedValue.contentListingPageSize)
                : undefined
          }
        : {};
    } catch {
      return {};
    }
  }

  save(settings: AppSettings) {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        globalLocalCacheDirectory: settings.globalLocalCacheDirectory,
        contentListingPageSize:
          typeof settings.contentListingPageSize === "number"
            ? normalizeContentListingPageSize(settings.contentListingPageSize)
            : undefined
      })
    );
  }
}

export const appSettingsStore = new AppSettingsStore();
