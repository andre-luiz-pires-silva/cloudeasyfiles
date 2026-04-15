import type {
  AzureAuthenticationMethod,
  ConnectionFormMode,
  ConnectionProvider,
  SavedConnectionSummary
} from "../connections/models";
import {
  isConnectionNameFormatValid,
  isRestrictedBucketNameFormatValid,
  isStorageAccountNameFormatValid,
  MAX_CONNECTION_NAME_LENGTH
} from "../connections/services/connectionService";

export type NavigationFormErrors = Partial<
  Record<
    | "connectionName"
    | "accessKeyId"
    | "secretAccessKey"
    | "restrictedBucketName"
    | "storageAccountName"
    | "authenticationMethod"
    | "accountKey",
    string
  >
>;

type TranslationFn = (key: string) => string;

type SharedValidationInput = {
  provider: ConnectionProvider;
  accessKeyId: string;
  secretAccessKey: string;
  restrictedBucketName: string;
  storageAccountName: string;
  azureAuthenticationMethod: AzureAuthenticationMethod;
  azureAccountKey: string;
  t: TranslationFn;
};

export function validateConnectionTestFields(
  input: SharedValidationInput
): NavigationFormErrors {
  const nextErrors: NavigationFormErrors = {};

  if (input.provider === "aws") {
    if (!input.accessKeyId.trim()) {
      nextErrors.accessKeyId = input.t("navigation.modal.validation.access_key_required");
    }

    if (!input.secretAccessKey.trim()) {
      nextErrors.secretAccessKey = input.t("navigation.modal.validation.secret_key_required");
    }

    if (
      input.restrictedBucketName.trim() &&
      !isRestrictedBucketNameFormatValid(input.restrictedBucketName.trim())
    ) {
      nextErrors.restrictedBucketName = input.t(
        "navigation.modal.validation.restricted_bucket_invalid"
      );
    }

    return nextErrors;
  }

  if (!input.storageAccountName.trim()) {
    nextErrors.storageAccountName = input.t(
      "navigation.modal.validation.storage_account_name_required"
    );
  } else if (!isStorageAccountNameFormatValid(input.storageAccountName.trim())) {
    nextErrors.storageAccountName = input.t(
      "navigation.modal.validation.storage_account_name_invalid"
    );
  }

  if (input.azureAuthenticationMethod !== "shared_key") {
    nextErrors.authenticationMethod = input.t(
      "navigation.modal.validation.azure_authentication_method_invalid"
    );
  }

  if (!input.azureAccountKey.trim()) {
    nextErrors.accountKey = input.t("navigation.modal.validation.account_key_required");
  }

  return nextErrors;
}

type ConnectionFormValidationInput = SharedValidationInput & {
  connectionName: string;
  connections: SavedConnectionSummary[];
  modalMode: ConnectionFormMode;
  editingConnectionId: string | null;
};

export function validateConnectionForm(
  input: ConnectionFormValidationInput
): NavigationFormErrors {
  const nextErrors: NavigationFormErrors = {};
  const normalizedConnectionName = input.connectionName.trim();

  if (!normalizedConnectionName) {
    nextErrors.connectionName = input.t("navigation.modal.validation.connection_name_required");
  } else if (!isConnectionNameFormatValid(normalizedConnectionName)) {
    nextErrors.connectionName = input
      .t("navigation.modal.validation.connection_name_invalid")
      .replace("{max}", String(MAX_CONNECTION_NAME_LENGTH));
  } else {
    const hasDuplicateName = input.connections.some(
      (connection) =>
        connection.id !== (input.modalMode === "edit" ? input.editingConnectionId : null) &&
        connection.name.trim().toLocaleLowerCase() === normalizedConnectionName.toLocaleLowerCase()
    );

    if (hasDuplicateName) {
      nextErrors.connectionName = input.t("navigation.modal.validation.connection_name_duplicate");
    }
  }

  return {
    ...nextErrors,
    ...validateConnectionTestFields(input)
  };
}
