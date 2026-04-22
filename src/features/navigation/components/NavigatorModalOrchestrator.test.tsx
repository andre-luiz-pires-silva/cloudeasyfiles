import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  NavigatorModalOrchestrator,
  type NavigatorModalOrchestratorProps
} from "./NavigatorModalOrchestrator";
import type { ConnectionFormModalProps } from "./ConnectionFormModal";

vi.mock("../../../lib/i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

function buildConnectionFormProps(
  overrides: Partial<ConnectionFormModalProps> = {}
): ConnectionFormModalProps {
  return {
    isOpen: false,
    locale: "en-US",
    fieldIds: {
      nameFieldId: "connection-name",
      providerFieldId: "connection-provider",
      accessKeyFieldId: "access-key",
      secretKeyFieldId: "secret-key",
      restrictedBucketNameFieldId: "restricted-bucket",
      storageAccountNameFieldId: "storage-account",
      azureAuthenticationMethodFieldId: "azure-auth-method",
      azureAccountKeyFieldId: "azure-account-key",
      connectOnStartupFieldId: "connect-on-startup"
    },
    modalMode: "create",
    connectionName: "",
    connectionProvider: "aws",
    accessKeyId: "",
    secretAccessKey: "",
    restrictedBucketName: "",
    storageAccountName: "",
    azureAuthenticationMethod: "shared_key",
    azureAccountKey: "",
    connectOnStartup: false,
    defaultAwsUploadStorageClass: "STANDARD",
    defaultAzureUploadTier: "Hot",
    formErrors: {},
    submitError: null,
    isSubmitting: false,
    connectionTestStatus: "idle",
    connectionTestMessage: null,
    t: (key) => key,
    onConnectionNameChange: vi.fn(),
    onConnectionProviderChange: vi.fn(),
    onAccessKeyIdChange: vi.fn(),
    onSecretAccessKeyChange: vi.fn(),
    onRestrictedBucketNameChange: vi.fn(),
    onStorageAccountNameChange: vi.fn(),
    onAzureAuthenticationMethodChange: vi.fn(),
    onAzureAccountKeyChange: vi.fn(),
    onConnectOnStartupChange: vi.fn(),
    onDefaultAwsUploadStorageClassChange: vi.fn(),
    onDefaultAzureUploadTierChange: vi.fn(),
    onTestConnection: vi.fn(),
    onSaveConnection: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  };
}

function renderOrchestrator(overrides: Partial<NavigatorModalOrchestratorProps> = {}) {
  const props: NavigatorModalOrchestratorProps = {
    locale: "en-US",
    t: (key) => key,
    restoreRequest: null,
    restoreSubmitError: null,
    isSubmittingRestoreRequest: false,
    onCloseRestoreRequestModal: vi.fn(),
    onSubmitAwsRestoreRequest: vi.fn(),
    onSubmitAzureRehydrationRequest: vi.fn(),
    changeStorageClassRequest: null,
    changeStorageClassSubmitError: null,
    isSubmittingStorageClassChange: false,
    onCloseChangeStorageClassModal: vi.fn(),
    onSubmitChangeStorageClass: vi.fn(),
    isTransferModalOpen: false,
    activeTransferList: [],
    onCancelActiveTransfer: vi.fn(),
    onCloseTransferModal: vi.fn(),
    completionToast: null,
    onCloseCompletionToast: vi.fn(),
    connectionFormProps: buildConnectionFormProps(),
    isUploadSettingsModalOpen: false,
    selectedConnection: null,
    uploadSettingsStorageClass: "STANDARD",
    uploadSettingsAzureTier: "Hot",
    uploadSettingsSubmitError: null,
    isSavingUploadSettings: false,
    onUploadSettingsStorageClassChange: vi.fn(),
    onUploadSettingsAzureTierChange: vi.fn(),
    onSaveUploadSettings: vi.fn(),
    onCloseUploadSettingsModal: vi.fn(),
    isCreateFolderModalOpen: false,
    canCreateFolderInCurrentContext: false,
    newFolderNameFieldId: "new-folder-name",
    newFolderName: "",
    createFolderError: null,
    isCreatingFolder: false,
    selectedBucketProvider: null,
    selectedBucketName: null,
    selectedBucketPath: "",
    onNewFolderNameChange: vi.fn(),
    onClearCreateFolderError: vi.fn(),
    onCreateFolder: vi.fn(),
    onCloseCreateFolderModal: vi.fn(),
    pendingContentDelete: null,
    deleteConfirmationValue: "",
    deleteContentError: null,
    isDeletingContent: false,
    contentDeleteConfirmationText: "DELETE",
    onDeleteConfirmationValueChange: vi.fn(),
    onClearDeleteContentError: vi.fn(),
    onCloseDeleteContentModal: vi.fn(),
    onConfirmDeleteContent: vi.fn(),
    pendingDeleteConnection: null,
    onCancelDeleteConnection: vi.fn(),
    onConfirmDeleteConnection: vi.fn(),
    uploadConflictPrompt: null,
    onResolveUploadConflict: vi.fn(),
    ...overrides
  };

  render(<NavigatorModalOrchestrator {...props} />);

  return props;
}

describe("NavigatorModalOrchestrator", () => {
  it("renders restore and change-storage-class workflow modals", () => {
    renderOrchestrator({
      restoreRequest: {
        provider: "aws",
        connectionId: "connection-1",
        bucketName: "archive",
        targets: [{ objectKey: "cold/file.txt", storageClass: "GLACIER" }],
        request: {
          provider: "aws",
          fileName: "file.txt",
          fileSizeLabel: "1 KB",
          storageClass: "GLACIER"
        }
      },
      changeStorageClassRequest: {
        provider: "azure",
        connectionId: "connection-1",
        bucketName: "archive",
        targets: [{ objectKey: "cold/file.txt", currentStorageClass: "Hot" }],
        request: {
          fileCount: 1,
          totalSizeLabel: "1 KB",
          currentStorageClassLabel: "Hot"
        },
        currentStorageClass: "Hot"
      }
    });

    expect(screen.getByRole("heading", { name: /restore.modal.aws.title/ })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "content.azure_storage_class_change.title" })
    ).toBeInTheDocument();
  });

  it("renders transfer modal and dispatches transfer actions", () => {
    const props = renderOrchestrator({
      isTransferModalOpen: true,
      activeTransferList: [
        {
          operationId: "transfer-1",
          itemId: "item-1",
          fileIdentity: "connection:bucket:file.txt",
          fileName: "file.txt",
          bucketName: "archive",
          provider: "aws",
          transferKind: "upload",
          progressPercent: 42,
          bytesTransferred: 42,
          totalBytes: 100,
          state: "progress",
          objectKey: "folder/file.txt"
        }
      ]
    });

    expect(screen.getByText("file.txt")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "navigation.menu.cancel_upload" }));
    fireEvent.click(screen.getByRole("button", { name: "common.close" }));

    expect(props.onCancelActiveTransfer).toHaveBeenCalledWith("transfer-1", "upload");
    expect(props.onCloseTransferModal).toHaveBeenCalledTimes(1);
  });

  it("renders completion toast and connection form modal", () => {
    const connectionFormProps = buildConnectionFormProps({
      isOpen: true,
      connectionName: "Production"
    });

    const props = renderOrchestrator({
      completionToast: {
        id: "toast-1",
        title: "Upload complete",
        description: "file.txt uploaded",
        tone: "success"
      },
      connectionFormProps
    });

    expect(screen.getByText("Upload complete")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "navigation.modal.title" })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("common.close"));

    expect(props.onCloseCompletionToast).toHaveBeenCalledTimes(1);
  });

  it("renders upload settings modal and dispatches save and cancel", () => {
    const props = renderOrchestrator({
      isUploadSettingsModalOpen: true,
      selectedConnection: {
        id: "connection-1",
        name: "AWS Main",
        provider: "aws",
        connectOnStartup: false,
        defaultUploadStorageClass: "STANDARD"
      }
    });

    expect(
      screen.getByRole("heading", { name: "content.transfer.upload_settings_title" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    expect(props.onCloseUploadSettingsModal).toHaveBeenCalledTimes(1);
    expect(props.onSaveUploadSettings).toHaveBeenCalledTimes(1);
  });

  it("renders create-folder and content-delete modals", () => {
    const props = renderOrchestrator({
      isCreateFolderModalOpen: true,
      canCreateFolderInCurrentContext: true,
      newFolderName: "reports",
      createFolderError: "Invalid folder",
      selectedBucketProvider: "aws",
      selectedBucketName: "archive",
      selectedBucketPath: "2026",
      pendingContentDelete: {
        items: [{ id: "file-1", kind: "file", name: "old.txt", path: "old.txt" }],
        fileCount: 1,
        directoryCount: 0,
        plan: { fileKeys: ["old.txt"], directoryPrefixes: [] }
      },
      deleteConfirmationValue: "DELETE",
      deleteContentError: "Delete failed"
    });

    fireEvent.change(screen.getByPlaceholderText("content.folder.name_placeholder"), {
      target: { value: "reports-q2" }
    });
    fireEvent.click(screen.getByRole("button", { name: "content.folder.create_button" }));
    fireEvent.change(screen.getByDisplayValue("DELETE"), {
      target: { value: "DELETEX" }
    });
    fireEvent.click(screen.getByRole("button", { name: "content.delete.action" }));

    expect(props.onNewFolderNameChange).toHaveBeenCalledWith("reports-q2");
    expect(props.onClearCreateFolderError).toHaveBeenCalledTimes(1);
    expect(props.onCreateFolder).toHaveBeenCalledTimes(1);
    expect(props.onDeleteConfirmationValueChange).toHaveBeenCalledWith("DELETEX");
    expect(props.onClearDeleteContentError).toHaveBeenCalledTimes(1);
    expect(props.onConfirmDeleteContent).toHaveBeenCalledTimes(1);
  });

  it("renders delete-connection and upload-conflict modals", () => {
    const props = renderOrchestrator({
      pendingDeleteConnection: {
        id: "connection-1",
        name: "AWS Main",
        provider: "aws",
        connectOnStartup: false,
        defaultUploadStorageClass: "STANDARD"
      },
      uploadConflictPrompt: {
        currentConflictIndex: 1,
        totalConflicts: 2,
        fileName: "file.txt",
        objectKey: "folder/file.txt"
      }
    });

    expect(screen.getByRole("heading", { name: "navigation.connections.delete_confirm" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "content.transfer.conflict_modal_title" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "navigation.menu.remove" }));
    fireEvent.click(screen.getByRole("button", { name: "content.transfer.conflict_replace_all" }));

    expect(props.onConfirmDeleteConnection).toHaveBeenCalledTimes(1);
    expect(props.onResolveUploadConflict).toHaveBeenCalledWith("overwriteAll");
  });
});
