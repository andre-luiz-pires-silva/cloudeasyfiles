import { beforeEach, describe, expect, it } from "vitest";

import {
  AppSettingsStore,
  DEFAULT_CONTENT_LISTING_PAGE_SIZE,
  MAX_CONTENT_LISTING_PAGE_SIZE,
  MIN_CONTENT_LISTING_PAGE_SIZE,
  normalizeContentListingPageSize
} from "./appSettingsStore";

const STORAGE_KEY = "cloudeasyfiles.app-settings";

describe("normalizeContentListingPageSize", () => {
  it("returns the default when value is not a number", () => {
    expect(normalizeContentListingPageSize("200")).toBe(DEFAULT_CONTENT_LISTING_PAGE_SIZE);
    expect(normalizeContentListingPageSize(null)).toBe(DEFAULT_CONTENT_LISTING_PAGE_SIZE);
    expect(normalizeContentListingPageSize(undefined)).toBe(DEFAULT_CONTENT_LISTING_PAGE_SIZE);
  });

  it("returns the default when value is not finite", () => {
    expect(normalizeContentListingPageSize(NaN)).toBe(DEFAULT_CONTENT_LISTING_PAGE_SIZE);
    expect(normalizeContentListingPageSize(Infinity)).toBe(DEFAULT_CONTENT_LISTING_PAGE_SIZE);
    expect(normalizeContentListingPageSize(-Infinity)).toBe(DEFAULT_CONTENT_LISTING_PAGE_SIZE);
  });

  it("clamps to MIN_CONTENT_LISTING_PAGE_SIZE when value is too small", () => {
    expect(normalizeContentListingPageSize(0)).toBe(MIN_CONTENT_LISTING_PAGE_SIZE);
    expect(normalizeContentListingPageSize(-10)).toBe(MIN_CONTENT_LISTING_PAGE_SIZE);
  });

  it("clamps to MAX_CONTENT_LISTING_PAGE_SIZE when value is too large", () => {
    expect(normalizeContentListingPageSize(9999)).toBe(MAX_CONTENT_LISTING_PAGE_SIZE);
    expect(normalizeContentListingPageSize(MAX_CONTENT_LISTING_PAGE_SIZE + 1)).toBe(
      MAX_CONTENT_LISTING_PAGE_SIZE
    );
  });

  it("truncates decimal values", () => {
    expect(normalizeContentListingPageSize(50.9)).toBe(50);
    expect(normalizeContentListingPageSize(100.1)).toBe(100);
  });

  it("returns valid in-range values as-is", () => {
    expect(normalizeContentListingPageSize(200)).toBe(200);
    expect(normalizeContentListingPageSize(MIN_CONTENT_LISTING_PAGE_SIZE)).toBe(
      MIN_CONTENT_LISTING_PAGE_SIZE
    );
    expect(normalizeContentListingPageSize(MAX_CONTENT_LISTING_PAGE_SIZE)).toBe(
      MAX_CONTENT_LISTING_PAGE_SIZE
    );
  });
});

describe("AppSettingsStore", () => {
  let store: AppSettingsStore;

  beforeEach(() => {
    localStorage.clear();
    store = new AppSettingsStore();
  });

  describe("load", () => {
    it("returns an empty object when storage is empty", () => {
      expect(store.load()).toEqual({});
    });

    it("returns an empty object when stored value is invalid JSON", () => {
      localStorage.setItem(STORAGE_KEY, "not-json{{");
      expect(store.load()).toEqual({});
    });

    it("returns an empty object when stored value is not an object", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
      expect(store.load()).toEqual({});
    });

    it("returns an empty object when stored value fails validation", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ globalLocalCacheDirectory: 42 })
      );
      expect(store.load()).toEqual({});
    });

    it("loads valid settings with both fields", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ globalLocalCacheDirectory: "/cache", contentListingPageSize: 300 })
      );

      const result = store.load();

      expect(result.globalLocalCacheDirectory).toBe("/cache");
      expect(result.contentListingPageSize).toBe(300);
    });

    it("loads settings with only globalLocalCacheDirectory", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ globalLocalCacheDirectory: "/my/cache" })
      );

      const result = store.load();

      expect(result.globalLocalCacheDirectory).toBe("/my/cache");
      expect(result.contentListingPageSize).toBeUndefined();
    });

    it("normalizes contentListingPageSize during load when out of range", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ contentListingPageSize: 9999 }));

      const result = store.load();

      expect(result.contentListingPageSize).toBe(MAX_CONTENT_LISTING_PAGE_SIZE);
    });

    it("omits contentListingPageSize when stored value is not a number", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ contentListingPageSize: "200" })
      );

      const result = store.load();

      expect(result.contentListingPageSize).toBeUndefined();
    });
  });

  describe("save", () => {
    it("persists settings to localStorage", () => {
      store.save({ globalLocalCacheDirectory: "/tmp/cache", contentListingPageSize: 100 });

      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.globalLocalCacheDirectory).toBe("/tmp/cache");
      expect(parsed.contentListingPageSize).toBe(100);
    });

    it("normalizes contentListingPageSize on save", () => {
      store.save({ contentListingPageSize: 9999 });

      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw!);
      expect(parsed.contentListingPageSize).toBe(MAX_CONTENT_LISTING_PAGE_SIZE);
    });

    it("stores undefined contentListingPageSize as undefined (not serialized)", () => {
      store.save({ globalLocalCacheDirectory: "/path" });

      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw!);
      expect(parsed.contentListingPageSize).toBeUndefined();
    });

    it("round-trips settings through save and load", () => {
      const settings = { globalLocalCacheDirectory: "/data", contentListingPageSize: 50 };
      store.save(settings);

      const loaded = store.load();

      expect(loaded.globalLocalCacheDirectory).toBe("/data");
      expect(loaded.contentListingPageSize).toBe(50);
    });
  });
});
