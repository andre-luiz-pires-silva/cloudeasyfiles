import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectionFormModal, type ConnectionFormModalProps } from "./ConnectionFormModal";

vi.mock("../../../lib/i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

const fieldIds = {
  nameFieldId: "connection-name",
  providerFieldId: "connection-provider",
  accessKeyFieldId: "access-key",
  secretKeyFieldId: "secret-key",
  restrictedBucketNameFieldId: "restricted-bucket",
  storageAccountNameFieldId: "storage-account",
  azureAuthenticationMethodFieldId: "azure-auth-method",
  azureAccountKeyFieldId: "azure-account-key",
  connectOnStartupFieldId: "connect-on-startup"
};

function renderModal(overrides: Partial<ConnectionFormModalProps> = {}) {
  const props: ConnectionFormModalProps = {
    isOpen: true,
    locale: "en-US",
    fieldIds,
    modalMode: "create",
    connectionName: "Production",
    connectionProvider: "aws",
    accessKeyId: "AKIA",
    secretAccessKey: "secret",
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

  render(<ConnectionFormModal {...props} />);

  return props;
}

describe("ConnectionFormModal", () => {
  it("does not render when closed", () => {
    renderModal({ isOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders AWS create form and dispatches field changes", () => {
    const props = renderModal();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "navigation.modal.title" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("navigation.modal.name_label"), {
      target: { value: "Archive" }
    });
    fireEvent.change(screen.getByLabelText("navigation.modal.type_label"), {
      target: { value: "azure" }
    });
    fireEvent.change(screen.getByLabelText("navigation.modal.aws.access_key_label"), {
      target: { value: "NEXT" }
    });
    fireEvent.change(screen.getByLabelText("navigation.modal.aws.secret_key_label"), {
      target: { value: "next-secret" }
    });

    expect(props.onConnectionNameChange).toHaveBeenCalledWith("Archive");
    expect(props.onConnectionProviderChange).toHaveBeenCalledWith("azure");
    expect(props.onAccessKeyIdChange).toHaveBeenCalledWith("NEXT");
    expect(props.onSecretAccessKeyChange).toHaveBeenCalledWith("next-secret");
  });

  it("renders Azure edit form with disabled provider and validation errors", () => {
    renderModal({
      modalMode: "edit",
      connectionProvider: "azure",
      storageAccountName: "storageacct",
      azureAccountKey: "account-key",
      formErrors: {
        connectionName: "Name required",
        storageAccountName: "Storage invalid",
        accountKey: "Key required"
      },
      submitError: "Save failed"
    });

    expect(screen.getByRole("heading", { name: "navigation.modal.edit_title" })).toBeInTheDocument();
    expect(screen.getByLabelText("navigation.modal.type_label")).toBeDisabled();
    expect(screen.getByText("Name required")).toBeInTheDocument();
    expect(screen.getByText("Storage invalid")).toBeInTheDocument();
    expect(screen.getByText("Key required")).toBeInTheDocument();
    expect(screen.getByText("Save failed")).toBeInTheDocument();
  });

  it("dispatches Azure field changes", () => {
    const props = renderModal({ connectionProvider: "azure" });

    fireEvent.change(screen.getByPlaceholderText("navigation.modal.azure.storage_account_placeholder"), {
      target: { value: "nextstorage" }
    });
    fireEvent.change(screen.getByPlaceholderText("navigation.modal.azure.account_key_placeholder"), {
      target: { value: "next-key" }
    });
    fireEvent.click(screen.getByRole("checkbox"));

    expect(props.onStorageAccountNameChange).toHaveBeenCalledWith("nextstorage");
    expect(props.onAzureAccountKeyChange).toHaveBeenCalledWith("next-key");
    expect(props.onConnectOnStartupChange).toHaveBeenCalledWith(true);
  });

  it("dispatches test, cancel, and submit actions", () => {
    const props = renderModal();

    fireEvent.click(screen.getByRole("button", { name: "navigation.modal.aws.test_connection_button" }));
    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    expect(props.onTestConnection).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onSaveConnection).toHaveBeenCalledTimes(1);
  });

  it("renders connection test status and disables actions while busy", () => {
    renderModal({
      isSubmitting: true,
      connectionTestStatus: "testing",
      connectionTestMessage: "Checking"
    });

    expect(
      screen.getByLabelText("navigation.modal.aws.test_connection_status.testing: Checking")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "navigation.modal.aws.test_connection_button" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "common.save" })).toBeDisabled();
  });
});
