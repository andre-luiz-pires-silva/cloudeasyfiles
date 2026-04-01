export type AppSettings = {
  globalLocalCacheDirectory?: string;
  defaultAwsUploadStorageClass?: string;
};

const STORAGE_KEY = "cloudeasyfiles.app-settings";

function isAppSettings(value: unknown): value is AppSettings {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.globalLocalCacheDirectory === "string" ||
    typeof candidate.globalLocalCacheDirectory === "undefined"
  ) && (
    typeof candidate.defaultAwsUploadStorageClass === "string" ||
    typeof candidate.defaultAwsUploadStorageClass === "undefined"
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
      return isAppSettings(parsedValue) ? parsedValue : {};
    } catch {
      return {};
    }
  }

  save(settings: AppSettings) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }
}

export const appSettingsStore = new AppSettingsStore();
