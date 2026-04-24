import { describe, expect, it } from "vitest";

import {
  buildClosedCreateFolderModalState,
  buildClosedPendingDeleteModalState,
  buildOpenedCreateFolderModalState,
  canCloseCreateFolderModal,
  canClosePendingDeleteModal,
  canOpenCreateFolderModal,
  shouldOpenContentAreaContextMenu
} from "./navigationModalGuards";

describe("navigationModalGuards", () => {
  it("guards delete modal closing while delete is in progress", () => {
    expect(canClosePendingDeleteModal(false)).toBe(true);
    expect(canClosePendingDeleteModal(true)).toBe(false);
    expect(canClosePendingDeleteModal(true, true)).toBe(true);
    expect(buildClosedPendingDeleteModalState()).toEqual({
      pendingContentDelete: null,
      deleteConfirmationValue: "",
      deleteContentError: null,
      isDeletingContent: false
    });
  });

  it("guards create-folder modal open and close transitions", () => {
    expect(
      canOpenCreateFolderModal({ selectedNodeKind: "bucket", hasSelectedBucketProvider: true })
    ).toBe(true);
    expect(
      canOpenCreateFolderModal({ selectedNodeKind: "connection", hasSelectedBucketProvider: true })
    ).toBe(false);
    expect(
      canOpenCreateFolderModal({ selectedNodeKind: "bucket", hasSelectedBucketProvider: false })
    ).toBe(false);

    expect(canCloseCreateFolderModal(false)).toBe(true);
    expect(canCloseCreateFolderModal(true)).toBe(false);
    expect(canCloseCreateFolderModal(true, true)).toBe(true);

    expect(buildOpenedCreateFolderModalState()).toEqual({
      isCreateFolderModalOpen: true,
      newFolderName: "",
      createFolderError: null,
      isCreatingFolder: false,
      contentAreaMenuAnchor: null
    });

    expect(
      buildClosedCreateFolderModalState({
        contentAreaMenuAnchor: { x: 10, y: 12 },
        isCreatingFolder: false
      })
    ).toEqual({
      isCreateFolderModalOpen: false,
      newFolderName: "",
      createFolderError: null,
      isCreatingFolder: false,
      contentAreaMenuAnchor: { x: 10, y: 12 }
    });
  });

  it("opens content area context menu only for the right target", () => {
    expect(
      shouldOpenContentAreaContextMenu({
        hasSelectedNode: true,
        clickedContentListItem: false,
        clickedContentListHeader: false,
        clickedTreeMenuPopup: false
      })
    ).toBe(true);

    expect(
      shouldOpenContentAreaContextMenu({
        hasSelectedNode: false,
        clickedContentListItem: false,
        clickedContentListHeader: false,
        clickedTreeMenuPopup: false
      })
    ).toBe(false);

    expect(
      shouldOpenContentAreaContextMenu({
        hasSelectedNode: true,
        clickedContentListItem: true,
        clickedContentListHeader: false,
        clickedTreeMenuPopup: false
      })
    ).toBe(false);
  });
});
