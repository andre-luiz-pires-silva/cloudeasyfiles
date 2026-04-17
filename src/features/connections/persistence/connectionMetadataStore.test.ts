import { beforeEach, describe, expect, it } from "vitest";

import { ConnectionMetadataStore } from "./connectionMetadataStore";
import type { SavedConnectionSummary } from "../models";

const STORAGE_KEY = "cloudeasyfiles.connection-metadata";

describe("ConnectionMetadataStore", () => {
  let store: ConnectionMetadataStore;

  beforeEach(() => {
    localStorage.clear();
    store = new ConnectionMetadataStore();
  });

  describe("load", () => {
    it("returns an empty array when storage is empty", () => {
      expect(store.load()).toEqual([]);
    });

    it("returns an empty array when stored value is not valid JSON", () => {
      localStorage.setItem(STORAGE_KEY, "not-json{{{");
      expect(store.load()).toEqual([]);
    });

    it("returns an empty array when stored value is a non-array JSON value", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: "1" }));
      expect(store.load()).toEqual([]);
    });

    it("returns valid AWS connections", () => {
      const connections: SavedConnectionSummary[] = [
        { id: "aws-1", name: "My AWS", provider: "aws" }
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));

      const result = store.load();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("aws-1");
    });

    it("returns valid Azure connections", () => {
      const connections: SavedConnectionSummary[] = [
        {
          id: "az-1",
          name: "My Azure",
          provider: "azure",
          storageAccountName: "myaccount",
          authenticationMethod: "shared_key"
        }
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));

      const result = store.load();

      expect(result).toHaveLength(1);
      if (result[0].provider !== "azure") throw new Error("Expected Azure");
      expect(result[0].storageAccountName).toBe("myaccount");
      expect(result[0].authenticationMethod).toBe("shared_key");
    });

    it("filters out entries with missing id", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([{ name: "no id", provider: "aws" }])
      );
      expect(store.load()).toEqual([]);
    });

    it("filters out entries with missing name", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([{ id: "1", provider: "aws" }])
      );
      expect(store.load()).toEqual([]);
    });

    it("filters out entries with unknown provider", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([{ id: "1", name: "Test", provider: "gcs" }])
      );
      expect(store.load()).toEqual([]);
    });

    it("filters out non-object entries", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([null, "string", 42]));
      expect(store.load()).toEqual([]);
    });

    it("filters out entries with invalid connectOnStartup type", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([{ id: "1", name: "Test", provider: "aws", connectOnStartup: "yes" }])
      );
      expect(store.load()).toEqual([]);
    });

    it("accepts connectOnStartup as undefined", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([{ id: "1", name: "Test", provider: "aws" }])
      );
      expect(store.load()).toHaveLength(1);
    });

    it("accepts aws connections with valid defaultUploadStorageClass", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          { id: "1", name: "Test", provider: "aws", defaultUploadStorageClass: "STANDARD" }
        ])
      );
      expect(store.load()).toHaveLength(1);
    });

    it("filters out aws connections with invalid defaultUploadStorageClass value", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          { id: "1", name: "Test", provider: "aws", defaultUploadStorageClass: "INVALID_CLASS" }
        ])
      );
      expect(store.load()).toEqual([]);
    });

    it("filters out azure connections missing storageAccountName", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          { id: "1", name: "Test", provider: "azure", authenticationMethod: "shared_key" }
        ])
      );
      expect(store.load()).toEqual([]);
    });

    it("filters out azure connections with invalid authenticationMethod", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          {
            id: "1",
            name: "Test",
            provider: "azure",
            storageAccountName: "acc",
            authenticationMethod: "oauth"
          }
        ])
      );
      expect(store.load()).toEqual([]);
    });

    it("accepts azure connections with entra_id authenticationMethod", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          {
            id: "1",
            name: "Test",
            provider: "azure",
            storageAccountName: "acc",
            authenticationMethod: "entra_id"
          }
        ])
      );
      expect(store.load()).toHaveLength(1);
    });

    it("accepts azure connections with valid defaultUploadTier", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          {
            id: "1",
            name: "Test",
            provider: "azure",
            storageAccountName: "acc",
            authenticationMethod: "shared_key",
            defaultUploadTier: "Cool"
          }
        ])
      );
      expect(store.load()).toHaveLength(1);
    });

    it("filters out azure connections with invalid defaultUploadTier value", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          {
            id: "1",
            name: "Test",
            provider: "azure",
            storageAccountName: "acc",
            authenticationMethod: "shared_key",
            defaultUploadTier: "Ultra"
          }
        ])
      );
      expect(store.load()).toEqual([]);
    });

    it("keeps valid entries and discards invalid ones from a mixed array", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([
          { id: "aws-1", name: "Valid AWS", provider: "aws" },
          { name: "Missing id", provider: "aws" },
          null
        ])
      );
      const result = store.load();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("aws-1");
    });
  });

  describe("save", () => {
    it("persists connections to localStorage", () => {
      const connections: SavedConnectionSummary[] = [
        { id: "aws-1", name: "My AWS", provider: "aws" }
      ];
      store.save(connections);

      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe("aws-1");
    });

    it("persists an empty array", () => {
      store.save([]);

      const raw = localStorage.getItem(STORAGE_KEY);
      expect(JSON.parse(raw!)).toEqual([]);
    });

    it("overwrites previously stored connections", () => {
      store.save([{ id: "aws-1", name: "First", provider: "aws" }]);
      store.save([{ id: "aws-2", name: "Second", provider: "aws" }]);

      const result = store.load();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("aws-2");
    });
  });
});
