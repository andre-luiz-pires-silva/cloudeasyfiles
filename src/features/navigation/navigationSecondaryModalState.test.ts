import { describe, expect, it } from "vitest";

import {
  buildDeleteContentFailureState,
  buildDeleteContentSuccessState,
  buildClosedUploadSettingsModalState,
  buildConnectionDeleteErrorMessage,
  buildOpenedUploadSettingsModalState,
  buildPendingRemoveConnectionState
} from "./navigationSecondaryModalState";

describe("navigationSecondaryModalState", () => {
  it("builds upload settings modal state for aws and azure connections", () => {
    expect(
      buildOpenedUploadSettingsModalState(
        {
          id: "aws-1",
          name: "AWS Main",
          provider: "aws",
          defaultUploadStorageClass: "DEEP_ARCHIVE"
        },
        {
          uploadSettingsStorageClass: "STANDARD",
          uploadSettingsAzureTier: "Hot"
        }
      )
    ).toEqual({
      uploadSettingsStorageClass: "DEEP_ARCHIVE",
      uploadSettingsAzureTier: "Hot",
      uploadSettingsSubmitError: null,
      isUploadSettingsModalOpen: true,
      isSavingUploadSettings: false
    });

    expect(
      buildOpenedUploadSettingsModalState(
        {
          id: "az-1",
          name: "Azure Main",
          provider: "azure",
          storageAccountName: "storageaccount",
          authenticationMethod: "shared_key",
          defaultUploadTier: "Archive"
        },
        {
          uploadSettingsStorageClass: "STANDARD",
          uploadSettingsAzureTier: "Hot"
        }
      )
    ).toEqual({
      uploadSettingsStorageClass: "STANDARD",
      uploadSettingsAzureTier: "Archive",
      uploadSettingsSubmitError: null,
      isUploadSettingsModalOpen: true,
      isSavingUploadSettings: false
    });

    expect(
      buildOpenedUploadSettingsModalState(null, {
        uploadSettingsStorageClass: "STANDARD",
        uploadSettingsAzureTier: "Hot"
      })
    ).toBeNull();
  });

  it("builds closed upload settings and pending remove states", () => {
    expect(buildClosedUploadSettingsModalState()).toEqual({
      uploadSettingsStorageClass: "STANDARD",
      uploadSettingsAzureTier: "Hot",
      uploadSettingsSubmitError: null,
      isUploadSettingsModalOpen: false,
      isSavingUploadSettings: false
    });

    expect(buildPendingRemoveConnectionState("conn-1")).toEqual({
      pendingDeleteConnectionId: "conn-1",
      openMenuConnectionId: null
    });
  });

  it("builds delete error messages", () => {
    const t = (key: string) => key;
    expect(buildConnectionDeleteErrorMessage(new Error("boom"), t)).toBe("boom");
    expect(buildConnectionDeleteErrorMessage({}, t)).toBe(
      "navigation.connections.delete_error"
    );
  });

  it("builds delete success and failure state transitions", () => {
    const t = (key: string) => key;

    expect(
      buildDeleteContentSuccessState({
        toastId: "toast-1",
        itemCount: 3,
        fileCount: 2,
        directoryCount: 1,
        t
      })
    ).toEqual({
      completionToast: {
        id: "toast-1",
        title: "content.delete.success_title",
        description: "content.delete.success_description"
          .replace("{count}", "3")
          .replace("{files}", "2")
          .replace("{folders}", "1"),
        tone: "success"
      },
      deleteContentError: null,
      isDeletingContent: false
    });

    expect(buildDeleteContentFailureState({ error: new Error("boom"), t })).toEqual({
      deleteContentError: "boom",
      isDeletingContent: false
    });

    expect(buildDeleteContentFailureState({ error: {}, t })).toEqual({
      deleteContentError: "content.delete.failed",
      isDeletingContent: false
    });
  });
});
