import {
  DEFAULT_AWS_UPLOAD_STORAGE_CLASS,
  normalizeAwsUploadStorageClass,
  type AwsUploadStorageClass
} from "../connections/awsUploadStorageClasses";
import {
  DEFAULT_AZURE_UPLOAD_TIER,
  normalizeAzureUploadTier,
  type AzureUploadTier
} from "../connections/azureUploadTiers";
import type {
  AzureAuthenticationMethod,
  ConnectionFormMode,
  ConnectionProvider,
  SavedConnectionSummary
} from "../connections/models";
import type { NavigationFormErrors } from "./navigationValidation";

export type NavigationModalFormState = {
  modalMode: ConnectionFormMode;
  editingConnectionId: string | null;
  connectionName: string;
  connectionProvider: ConnectionProvider;
  accessKeyId: string;
  secretAccessKey: string;
  restrictedBucketName: string;
  storageAccountName: string;
  azureAuthenticationMethod: AzureAuthenticationMethod;
  azureAccountKey: string;
  connectOnStartup: boolean;
  defaultAwsUploadStorageClass: AwsUploadStorageClass;
  defaultAzureUploadTier: AzureUploadTier;
  formErrors: NavigationFormErrors;
  submitError: string | null;
  isModalOpen: boolean;
};

export function buildResetModalFormState(): NavigationModalFormState {
  return {
    modalMode: "create",
    editingConnectionId: null,
    connectionName: "",
    connectionProvider: "aws",
    accessKeyId: "",
    secretAccessKey: "",
    restrictedBucketName: "",
    storageAccountName: "",
    azureAuthenticationMethod: "shared_key",
    azureAccountKey: "",
    connectOnStartup: false,
    defaultAwsUploadStorageClass: DEFAULT_AWS_UPLOAD_STORAGE_CLASS,
    defaultAzureUploadTier: DEFAULT_AZURE_UPLOAD_TIER,
    formErrors: {},
    submitError: null,
    isModalOpen: false
  };
}

export function buildCreateModalState(): NavigationModalFormState {
  return {
    ...buildResetModalFormState(),
    isModalOpen: true
  };
}

export function buildBaseEditModalState(
  connection: SavedConnectionSummary,
  connectionId: string
): NavigationModalFormState {
  return {
    modalMode: "edit",
    editingConnectionId: connectionId,
    connectionName: connection.name,
    connectionProvider: connection.provider,
    accessKeyId: "",
    secretAccessKey: "",
    restrictedBucketName:
      connection.provider === "aws" ? connection.restrictedBucketName ?? "" : "",
    storageAccountName:
      connection.provider === "azure" ? connection.storageAccountName ?? "" : "",
    azureAuthenticationMethod:
      connection.provider === "azure" ? connection.authenticationMethod : "shared_key",
    azureAccountKey: "",
    connectOnStartup: connection.connectOnStartup === true,
    defaultAwsUploadStorageClass: DEFAULT_AWS_UPLOAD_STORAGE_CLASS,
    defaultAzureUploadTier:
      connection.provider === "azure"
        ? normalizeAzureUploadTier(connection.defaultUploadTier)
        : DEFAULT_AZURE_UPLOAD_TIER,
    formErrors: {},
    submitError: null,
    isModalOpen: true
  };
}

export function buildAwsEditModalState(
  baseState: NavigationModalFormState,
  draft: {
    accessKeyId: string;
    secretAccessKey: string;
    restrictedBucketName?: string;
    connectOnStartup?: boolean;
    defaultUploadStorageClass?: AwsUploadStorageClass;
  }
): NavigationModalFormState {
  return {
    ...baseState,
    accessKeyId: draft.accessKeyId,
    secretAccessKey: draft.secretAccessKey,
    restrictedBucketName: draft.restrictedBucketName ?? "",
    connectOnStartup: draft.connectOnStartup === true,
    defaultAwsUploadStorageClass: normalizeAwsUploadStorageClass(draft.defaultUploadStorageClass)
  };
}

export function buildAzureEditModalState(
  baseState: NavigationModalFormState,
  draft: {
    storageAccountName: string;
    authenticationMethod: AzureAuthenticationMethod;
    accountKey: string;
    connectOnStartup?: boolean;
    defaultUploadTier?: AzureUploadTier;
  }
): NavigationModalFormState {
  return {
    ...baseState,
    storageAccountName: draft.storageAccountName,
    azureAuthenticationMethod: draft.authenticationMethod,
    azureAccountKey: draft.accountKey,
    connectOnStartup: draft.connectOnStartup === true,
    defaultAzureUploadTier: normalizeAzureUploadTier(draft.defaultUploadTier)
  };
}

export function buildModalLoadErrorMessage(
  error: unknown,
  t: (key: string) => string
): string {
  return error instanceof Error ? error.message : t("navigation.modal.credentials_load_warning");
}
