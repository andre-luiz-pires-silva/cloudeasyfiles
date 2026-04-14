import { describe, expect, it } from "vitest";

import {
  isAzureArchivedOverwriteBlocked,
  resolveUploadConflictDecisions,
  type UploadConflictDecision,
  type UploadConflictItem
} from "./navigationUploads";

describe("navigationUploads", () => {
  it("does not prompt for non-conflicting uploads", async () => {
    const items: UploadConflictItem[] = [
      { fileName: "report-a.csv", objectKey: "report-a.csv", objectAlreadyExists: false },
      { fileName: "report-b.csv", objectKey: "report-b.csv", objectAlreadyExists: false }
    ];
    const prompts: UploadConflictDecision[] = [];

    const result = await resolveUploadConflictDecisions(items, async () => {
      prompts.push("skip");
      return "skip";
    });

    expect(prompts).toEqual([]);
    expect(result.map((entry) => entry.shouldUpload)).toEqual([true, true]);
  });

  it("applies skip-all to remaining conflicting uploads without prompting again", async () => {
    const items: UploadConflictItem[] = [
      { fileName: "report-a.csv", objectKey: "report-a.csv", objectAlreadyExists: true },
      { fileName: "report-b.csv", objectKey: "report-b.csv", objectAlreadyExists: true },
      { fileName: "report-c.csv", objectKey: "report-c.csv", objectAlreadyExists: false }
    ];
    const prompts: string[] = [];

    const result = await resolveUploadConflictDecisions(items, async (prompt) => {
      prompts.push(`${prompt.currentConflictIndex}/${prompt.totalConflicts}:${prompt.fileName}`);
      return "skipAll";
    });

    expect(prompts).toEqual(["1/2:report-a.csv"]);
    expect(result.map((entry) => entry.shouldUpload)).toEqual([false, false, true]);
  });

  it("applies overwrite-all to remaining conflicting uploads without prompting again", async () => {
    const items: UploadConflictItem[] = [
      { fileName: "report-a.csv", objectKey: "report-a.csv", objectAlreadyExists: true },
      { fileName: "report-b.csv", objectKey: "report-b.csv", objectAlreadyExists: true },
      { fileName: "report-c.csv", objectKey: "report-c.csv", objectAlreadyExists: false }
    ];
    const prompts: string[] = [];

    const result = await resolveUploadConflictDecisions(items, async (prompt) => {
      prompts.push(`${prompt.currentConflictIndex}/${prompt.totalConflicts}:${prompt.fileName}`);
      return "overwriteAll";
    });

    expect(prompts).toEqual(["1/2:report-a.csv"]);
    expect(result.map((entry) => entry.shouldUpload)).toEqual([true, true, true]);
  });

  it("tracks individual prompt order for mixed overwrite and skip decisions", async () => {
    const items: UploadConflictItem[] = [
      { fileName: "report-a.csv", objectKey: "report-a.csv", objectAlreadyExists: true },
      { fileName: "report-b.csv", objectKey: "report-b.csv", objectAlreadyExists: false },
      { fileName: "report-c.csv", objectKey: "report-c.csv", objectAlreadyExists: true }
    ];
    const prompts: string[] = [];
    const decisions: UploadConflictDecision[] = ["overwrite", "skip"];

    const result = await resolveUploadConflictDecisions(items, async (prompt) => {
      prompts.push(`${prompt.currentConflictIndex}/${prompt.totalConflicts}:${prompt.fileName}`);
      return decisions.shift() ?? "skip";
    });

    expect(prompts).toEqual(["1/2:report-a.csv", "2/2:report-c.csv"]);
    expect(result.map((entry) => entry.shouldUpload)).toEqual([true, true, false]);
  });

  it("blocks azure overwrite attempts when the existing blob is archived", () => {
    expect(
      isAzureArchivedOverwriteBlocked(
        { objectKey: "archive.zip" },
        [
          { kind: "directory", path: "docs" },
          { kind: "file", path: "archive.zip", availabilityStatus: "archived" }
        ]
      )
    ).toBe(true);

    expect(
      isAzureArchivedOverwriteBlocked(
        { objectKey: "report.csv" },
        [{ kind: "file", path: "report.csv", availabilityStatus: "available" }]
      )
    ).toBe(false);
  });
});
