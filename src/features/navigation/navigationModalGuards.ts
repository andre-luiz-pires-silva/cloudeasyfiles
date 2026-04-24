export type NavigationDeleteModalState = {
  pendingContentDelete: null;
  deleteConfirmationValue: string;
  deleteContentError: string | null;
  isDeletingContent: boolean;
};

export type NavigationCreateFolderModalState = {
  isCreateFolderModalOpen: boolean;
  newFolderName: string;
  createFolderError: string | null;
  isCreatingFolder: boolean;
  contentAreaMenuAnchor: { x: number; y: number } | null;
};

export function canClosePendingDeleteModal(
  isDeletingContent: boolean,
  force = false
): boolean {
  return force || !isDeletingContent;
}

export function buildClosedPendingDeleteModalState(): NavigationDeleteModalState {
  return {
    pendingContentDelete: null,
    deleteConfirmationValue: "",
    deleteContentError: null,
    isDeletingContent: false
  };
}

export function canOpenCreateFolderModal(params: {
  selectedNodeKind: "connection" | "bucket" | null | undefined;
  hasSelectedBucketProvider: boolean;
}): boolean {
  return params.selectedNodeKind === "bucket" && params.hasSelectedBucketProvider;
}

export function canCloseCreateFolderModal(
  isCreatingFolder: boolean,
  force = false
): boolean {
  return force || !isCreatingFolder;
}

export function buildOpenedCreateFolderModalState(): NavigationCreateFolderModalState {
  return {
    isCreateFolderModalOpen: true,
    newFolderName: "",
    createFolderError: null,
    isCreatingFolder: false,
    contentAreaMenuAnchor: null
  };
}

export function buildClosedCreateFolderModalState(
  currentState: Pick<NavigationCreateFolderModalState, "contentAreaMenuAnchor" | "isCreatingFolder">
): NavigationCreateFolderModalState {
  return {
    isCreateFolderModalOpen: false,
    newFolderName: "",
    createFolderError: null,
    isCreatingFolder: currentState.isCreatingFolder,
    contentAreaMenuAnchor: currentState.contentAreaMenuAnchor
  };
}

export function shouldOpenContentAreaContextMenu(params: {
  hasSelectedNode: boolean;
  clickedContentListItem: boolean;
  clickedContentListHeader: boolean;
  clickedTreeMenuPopup: boolean;
}): boolean {
  if (!params.hasSelectedNode) {
    return false;
  }

  return !(
    params.clickedContentListItem ||
    params.clickedContentListHeader ||
    params.clickedTreeMenuPopup
  );
}
