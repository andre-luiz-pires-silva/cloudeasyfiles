import { describe, expect, it } from "vitest";

import {
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
});
