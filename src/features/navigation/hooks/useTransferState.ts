import { type Dispatch, type MutableRefObject, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../../lib/i18n/useI18n";
import {
  buildTransferErrorToast,
  type NavigationActiveTransfer,
  type NavigationCompletionToast
} from "../navigationTransfers";
import type { UploadConflictDecision, UploadConflictPromptState } from "../navigationUploads";

export type TransferStateResult = {
  downloadedFilePaths: string[];
  activeTransfers: Record<string, NavigationActiveTransfer>;
  activeDirectDownloadItemIds: string[];
  completionToast: NavigationCompletionToast | null;
  uploadConflictPrompt: UploadConflictPromptState | null;
  isTransferModalOpen: boolean;
  isUploadDropTargetActive: boolean;
  uploadConflictResolverRef: MutableRefObject<((decision: UploadConflictDecision) => void) | null>;
  activeTransferList: NavigationActiveTransfer[];
  downloadedFilePathSet: Set<string>;
  setDownloadedFilePaths: Dispatch<SetStateAction<string[]>>;
  setActiveTransfers: Dispatch<SetStateAction<Record<string, NavigationActiveTransfer>>>;
  setActiveDirectDownloadItemIds: Dispatch<SetStateAction<string[]>>;
  setCompletionToast: Dispatch<SetStateAction<NavigationCompletionToast | null>>;
  setUploadConflictPrompt: Dispatch<SetStateAction<UploadConflictPromptState | null>>;
  setIsTransferModalOpen: Dispatch<SetStateAction<boolean>>;
  setIsUploadDropTargetActive: Dispatch<SetStateAction<boolean>>;
  showTransferErrorToast: (description: string) => void;
};

export function useTransferState(): TransferStateResult {
  const { t } = useI18n();

  const [downloadedFilePaths, setDownloadedFilePaths] = useState<string[]>([]);
  const [activeTransfers, setActiveTransfers] = useState<Record<string, NavigationActiveTransfer>>(
    {}
  );
  const [activeDirectDownloadItemIds, setActiveDirectDownloadItemIds] = useState<string[]>([]);
  const [completionToast, setCompletionToast] = useState<NavigationCompletionToast | null>(null);
  const [uploadConflictPrompt, setUploadConflictPrompt] =
    useState<UploadConflictPromptState | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isUploadDropTargetActive, setIsUploadDropTargetActive] = useState(false);
  const uploadConflictResolverRef = useRef<((decision: UploadConflictDecision) => void) | null>(
    null
  );

  const activeTransferList = useMemo(
    () => Object.values(activeTransfers).filter((transfer) => transfer.state === "progress"),
    [activeTransfers]
  );

  const downloadedFilePathSet = useMemo(() => new Set(downloadedFilePaths), [downloadedFilePaths]);

  useEffect(() => {
    if (!completionToast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCompletionToast((currentToast) =>
        currentToast?.id === completionToast.id ? null : currentToast
      );
    }, 4200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [completionToast]);

  function showTransferErrorToast(description: string) {
    const toastId =
      typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
        ? globalThis.crypto.randomUUID()
        : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setCompletionToast(buildTransferErrorToast(toastId, description, t));
  }

  return {
    downloadedFilePaths,
    activeTransfers,
    activeDirectDownloadItemIds,
    completionToast,
    uploadConflictPrompt,
    isTransferModalOpen,
    isUploadDropTargetActive,
    uploadConflictResolverRef,
    activeTransferList,
    downloadedFilePathSet,
    setDownloadedFilePaths,
    setActiveTransfers,
    setActiveDirectDownloadItemIds,
    setCompletionToast,
    setUploadConflictPrompt,
    setIsTransferModalOpen,
    setIsUploadDropTargetActive,
    showTransferErrorToast
  };
}
