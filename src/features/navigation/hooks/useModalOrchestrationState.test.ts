import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useModalOrchestrationState } from "./useModalOrchestrationState";

describe("useModalOrchestrationState", () => {
  it("returns all initial values as falsy/empty", () => {
    const { result } = renderHook(() => useModalOrchestrationState());
    expect(result.current.restoreRequest).toBeNull();
    expect(result.current.restoreSubmitError).toBeNull();
    expect(result.current.isSubmittingRestoreRequest).toBe(false);
    expect(result.current.changeStorageClassRequest).toBeNull();
    expect(result.current.changeStorageClassSubmitError).toBeNull();
    expect(result.current.isSubmittingStorageClassChange).toBe(false);
    expect(result.current.isCreateFolderModalOpen).toBe(false);
    expect(result.current.newFolderName).toBe("");
    expect(result.current.createFolderError).toBeNull();
    expect(result.current.isCreatingFolder).toBe(false);
    expect(result.current.pendingContentDelete).toBeNull();
    expect(result.current.deleteConfirmationValue).toBe("");
    expect(result.current.deleteContentError).toBeNull();
    expect(result.current.isDeletingContent).toBe(false);
    expect(result.current.isUploadSettingsModalOpen).toBe(false);
    expect(result.current.uploadSettingsSubmitError).toBeNull();
    expect(result.current.isSavingUploadSettings).toBe(false);
  });

  it("create folder modal state can be toggled", () => {
    const { result } = renderHook(() => useModalOrchestrationState());
    act(() => {
      result.current.setIsCreateFolderModalOpen(true);
      result.current.setNewFolderName("my-folder");
    });
    expect(result.current.isCreateFolderModalOpen).toBe(true);
    expect(result.current.newFolderName).toBe("my-folder");
  });

  it("delete confirmation value can be set and reset", () => {
    const { result } = renderHook(() => useModalOrchestrationState());
    act(() => {
      result.current.setDeleteConfirmationValue("DELETE");
    });
    expect(result.current.deleteConfirmationValue).toBe("DELETE");
    act(() => {
      result.current.setDeleteConfirmationValue("");
    });
    expect(result.current.deleteConfirmationValue).toBe("");
  });

  it("upload settings modal state can be toggled", () => {
    const { result } = renderHook(() => useModalOrchestrationState());
    act(() => {
      result.current.setIsUploadSettingsModalOpen(true);
    });
    expect(result.current.isUploadSettingsModalOpen).toBe(true);
  });

  it("restore request submit error can be set", () => {
    const { result } = renderHook(() => useModalOrchestrationState());
    act(() => {
      result.current.setRestoreSubmitError("restore failed");
    });
    expect(result.current.restoreSubmitError).toBe("restore failed");
  });

  it("isSubmittingStorageClassChange can be toggled", () => {
    const { result } = renderHook(() => useModalOrchestrationState());
    act(() => {
      result.current.setIsSubmittingStorageClassChange(true);
    });
    expect(result.current.isSubmittingStorageClassChange).toBe(true);
  });

  it("pendingContentDelete can be set with delete plan", () => {
    const { result } = renderHook(() => useModalOrchestrationState());
    const plan = {
      items: [{ id: "1", kind: "file" as const, path: "/a.txt", name: "a.txt" }],
      fileCount: 1,
      directoryCount: 0,
      plan: { fileKeys: ["/a.txt"], directoryPrefixes: [] }
    };
    act(() => {
      result.current.setPendingContentDelete(plan);
    });
    expect(result.current.pendingContentDelete?.fileCount).toBe(1);
    expect(result.current.pendingContentDelete?.items).toHaveLength(1);
  });
});
