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
