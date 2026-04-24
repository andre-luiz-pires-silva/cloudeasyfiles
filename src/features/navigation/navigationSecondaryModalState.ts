import {
  normalizeAwsUploadStorageClass,
  type AwsUploadStorageClass
} from "../connections/awsUploadStorageClasses";
import {
  normalizeAzureUploadTier,
  type AzureUploadTier
} from "../connections/azureUploadTiers";
import type { SavedConnectionSummary } from "../connections/models";

export type NavigationUploadSettingsModalState = {
  uploadSettingsStorageClass: AwsUploadStorageClass;
  uploadSettingsAzureTier: AzureUploadTier;
  uploadSettingsSubmitError: string | null;
  isUploadSettingsModalOpen: boolean;
  isSavingUploadSettings: boolean;
};

export type NavigationCompletionToastState = {
  id: string;
  title: string;
  description: string;
  tone?: "success" | "error";
};

export function buildOpenedUploadSettingsModalState(
  selectedConnection: SavedConnectionSummary | null,
  currentState: Pick<
    NavigationUploadSettingsModalState,
    "uploadSettingsStorageClass" | "uploadSettingsAzureTier"
  >
): NavigationUploadSettingsModalState | null {
  if (!selectedConnection) {
    return null;
  }

  return {
    uploadSettingsStorageClass:
      selectedConnection.provider === "aws"
        ? normalizeAwsUploadStorageClass(selectedConnection.defaultUploadStorageClass)
        : currentState.uploadSettingsStorageClass,
    uploadSettingsAzureTier:
      selectedConnection.provider === "azure"
        ? normalizeAzureUploadTier(selectedConnection.defaultUploadTier)
        : currentState.uploadSettingsAzureTier,
    uploadSettingsSubmitError: null,
    isUploadSettingsModalOpen: true,
    isSavingUploadSettings: false
  };
}

export function buildClosedUploadSettingsModalState(): NavigationUploadSettingsModalState {
  return {
    uploadSettingsStorageClass: "STANDARD",
    uploadSettingsAzureTier: "Hot",
    uploadSettingsSubmitError: null,
    isUploadSettingsModalOpen: false,
    isSavingUploadSettings: false
  };
}

export function buildPendingRemoveConnectionState(connectionId: string): {
  pendingDeleteConnectionId: string;
  openMenuConnectionId: null;
} {
  return {
    pendingDeleteConnectionId: connectionId,
    openMenuConnectionId: null
  };
}

export function buildConnectionDeleteErrorMessage(
  error: unknown,
  t: (key: string) => string
): string {
  return error instanceof Error ? error.message : t("navigation.connections.delete_error");
}

export function buildDeleteContentSuccessState(params: {
  toastId: string;
  itemCount: number;
  fileCount: number;
  directoryCount: number;
  t: (key: string) => string;
}) {
  return {
    completionToast: {
      id: params.toastId,
      title: params.t("content.delete.success_title"),
      description: params.t("content.delete.success_description")
        .replace("{count}", String(params.itemCount))
        .replace("{files}", String(params.fileCount))
        .replace("{folders}", String(params.directoryCount)),
      tone: "success" as const
    },
    deleteContentError: null as string | null,
    isDeletingContent: false
  };
}

export function buildDeleteContentFailureState(params: {
  error: unknown;
  t: (key: string) => string;
}) {
  return {
    deleteContentError:
      params.error instanceof Error ? params.error.message : params.t("content.delete.failed"),
    isDeletingContent: false
  };
}
