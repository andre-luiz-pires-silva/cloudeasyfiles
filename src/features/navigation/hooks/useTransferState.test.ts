import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTransferState } from "./useTransferState";

vi.mock("../../../lib/i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

vi.mock("../navigationTransfers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../navigationTransfers")>();
  return {
    ...actual,
    buildTransferErrorToast: (id: string, description: string) => ({
      id,
      title: "error-title",
      description,
      tone: "error" as const
    })
  };
});

function makeTransfer(operationId: string, state: "progress" | "completed" = "progress") {
  return {
    operationId,
    itemId: operationId,
    fileIdentity: operationId,
    fileName: "file.txt",
    bucketName: "bucket",
    provider: "aws" as const,
    transferKind: "cache" as const,
    progressPercent: 50,
    bytesTransferred: 50,
    totalBytes: 100,
    state
  };
}

describe("useTransferState", () => {
  it("returns initial values", () => {
    const { result } = renderHook(() => useTransferState());
    expect(result.current.downloadedFilePaths).toEqual([]);
    expect(result.current.activeTransfers).toEqual({});
    expect(result.current.activeDirectDownloadItemIds).toEqual([]);
    expect(result.current.completionToast).toBeNull();
    expect(result.current.uploadConflictPrompt).toBeNull();
    expect(result.current.isTransferModalOpen).toBe(false);
    expect(result.current.isUploadDropTargetActive).toBe(false);
  });

  it("activeTransferList filters to progress state only", () => {
    const { result } = renderHook(() => useTransferState());
    act(() => {
      result.current.setActiveTransfers({
        a: makeTransfer("a", "progress"),
        b: makeTransfer("b", "completed")
      });
    });
    expect(result.current.activeTransferList).toHaveLength(1);
    expect(result.current.activeTransferList[0].operationId).toBe("a");
  });

  it("downloadedFilePathSet reflects downloadedFilePaths", () => {
    const { result } = renderHook(() => useTransferState());
    act(() => {
      result.current.setDownloadedFilePaths(["/a/b.txt", "/c/d.txt"]);
    });
    expect(result.current.downloadedFilePathSet.has("/a/b.txt")).toBe(true);
    expect(result.current.downloadedFilePathSet.has("/missing")).toBe(false);
  });

  it("setIsTransferModalOpen updates isTransferModalOpen", () => {
    const { result } = renderHook(() => useTransferState());
    act(() => {
      result.current.setIsTransferModalOpen(true);
    });
    expect(result.current.isTransferModalOpen).toBe(true);
  });

  it("setIsUploadDropTargetActive updates isUploadDropTargetActive", () => {
    const { result } = renderHook(() => useTransferState());
    act(() => {
      result.current.setIsUploadDropTargetActive(true);
    });
    expect(result.current.isUploadDropTargetActive).toBe(true);
  });

  it("showTransferErrorToast sets completionToast with error tone", () => {
    const { result } = renderHook(() => useTransferState());
    act(() => {
      result.current.showTransferErrorToast("something went wrong");
    });
    expect(result.current.completionToast).not.toBeNull();
    expect(result.current.completionToast?.tone).toBe("error");
    expect(result.current.completionToast?.description).toBe("something went wrong");
  });

  it("uploadConflictResolverRef is a mutable ref", () => {
    const { result } = renderHook(() => useTransferState());
    expect(result.current.uploadConflictResolverRef).toBeDefined();
    expect("current" in result.current.uploadConflictResolverRef).toBe(true);
    expect(result.current.uploadConflictResolverRef.current).toBeNull();
  });
});
