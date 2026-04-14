export type UploadConflictDecision = "overwrite" | "skip" | "overwriteAll" | "skipAll";

export type UploadConflictPromptState = {
  currentConflictIndex: number;
  totalConflicts: number;
  fileName: string;
  objectKey: string;
};

export type UploadConflictItem = {
  fileName: string;
  objectKey: string;
  objectAlreadyExists: boolean;
};

export type UploadConflictResolution<T extends UploadConflictItem> = {
  item: T;
  shouldUpload: boolean;
};

export type UploadConflictContentItem = {
  kind: "directory" | "file";
  path: string;
  availabilityStatus?: "available" | "archived" | "restoring";
};

export async function resolveUploadConflictDecisions<T extends UploadConflictItem>(
  items: T[],
  promptForConflict: (input: UploadConflictPromptState) => Promise<UploadConflictDecision>
): Promise<Array<UploadConflictResolution<T>>> {
  const totalConflicts = items.filter((item) => item.objectAlreadyExists).length;
  let conflictCursor = 0;
  let applyRemainingDecision: "overwrite" | "skip" | null = null;
  const results: Array<UploadConflictResolution<T>> = [];

  for (const item of items) {
    let shouldUpload = true;

    if (item.objectAlreadyExists) {
      conflictCursor += 1;

      if (applyRemainingDecision) {
        shouldUpload = applyRemainingDecision === "overwrite";
      } else {
        const decision = await promptForConflict({
          currentConflictIndex: conflictCursor,
          totalConflicts,
          fileName: item.fileName,
          objectKey: item.objectKey
        });

        if (decision === "skipAll") {
          applyRemainingDecision = "skip";
          shouldUpload = false;
        } else if (decision === "overwriteAll") {
          applyRemainingDecision = "overwrite";
        } else {
          shouldUpload = decision === "overwrite";
        }
      }
    }

    results.push({ item, shouldUpload });
  }

  return results;
}

export function isAzureArchivedOverwriteBlocked(
  item: Pick<UploadConflictItem, "objectKey">,
  contentItems: UploadConflictContentItem[]
): boolean {
  return contentItems.some(
    (contentItem) =>
      contentItem.kind === "file" &&
      contentItem.path === item.objectKey &&
      contentItem.availabilityStatus === "archived"
  );
}
