export type NavigationDroppedFileItem = {
  kind: string;
  getAsFile: () => File | null;
};

export function collectDroppedFiles(params: {
  items?: ArrayLike<NavigationDroppedFileItem> | null;
  files?: ArrayLike<File> | null;
}): File[] {
  const droppedFilesFromItems = Array.from(params.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((candidate): candidate is File => candidate instanceof File);

  if (droppedFilesFromItems.length > 0) {
    return droppedFilesFromItems;
  }

  return Array.from(params.files ?? []);
}

export function resolveSingleDirectoryPickResult(
  selectedPath: string | string[] | null
): string | null {
  if (!selectedPath || Array.isArray(selectedPath)) {
    return null;
  }

  return selectedPath;
}

export function resolveDirectoryPickerDefaultPath(
  currentDirectory: string | null | undefined
): string | undefined {
  const normalizedDirectory = currentDirectory?.trim();
  return normalizedDirectory ? normalizedDirectory : undefined;
}

export function resolveMultiFilePickResult(
  selectedPath: string | string[] | null
): string[] {
  if (!selectedPath) {
    return [];
  }

  return Array.isArray(selectedPath) ? selectedPath : [selectedPath];
}
