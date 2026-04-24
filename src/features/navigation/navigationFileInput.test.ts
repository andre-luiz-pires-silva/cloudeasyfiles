import { describe, expect, it } from "vitest";

import {
  collectDroppedFiles,
  resolveDirectoryPickerDefaultPath,
  resolveMultiFilePickResult,
  resolveSingleDirectoryPickResult
} from "./navigationFileInput";

describe("navigationFileInput", () => {
  it("prefers file items from drag-and-drop data transfer entries", () => {
    const fileA = new File(["a"], "a.txt");
    const fileB = new File(["b"], "b.txt");

    expect(
      collectDroppedFiles({
        items: [
          { kind: "file", getAsFile: () => fileA },
          { kind: "string", getAsFile: () => null },
          { kind: "file", getAsFile: () => fileB }
        ],
        files: [new File(["c"], "c.txt")]
      })
    ).toEqual([fileA, fileB]);
  });

  it("falls back to the file list when item entries do not provide files", () => {
    const file = new File(["a"], "a.txt");

    expect(
      collectDroppedFiles({
        items: [{ kind: "string", getAsFile: () => null }],
        files: [file]
      })
    ).toEqual([file]);
  });

  it("normalizes single-directory picker results", () => {
    expect(resolveSingleDirectoryPickResult(null)).toBeNull();
    expect(resolveSingleDirectoryPickResult(["/tmp/a", "/tmp/b"])).toBeNull();
    expect(resolveSingleDirectoryPickResult("/tmp/cache")).toBe("/tmp/cache");
  });

  it("normalizes directory picker default path and multi-file pick results", () => {
    expect(resolveDirectoryPickerDefaultPath("   ")).toBeUndefined();
    expect(resolveDirectoryPickerDefaultPath(" /tmp/cache ")).toBe("/tmp/cache");

    expect(resolveMultiFilePickResult(null)).toEqual([]);
    expect(resolveMultiFilePickResult("/tmp/a.txt")).toEqual(["/tmp/a.txt"]);
    expect(resolveMultiFilePickResult(["/tmp/a.txt", "/tmp/b.txt"])).toEqual([
      "/tmp/a.txt",
      "/tmp/b.txt"
    ]);
  });
});
