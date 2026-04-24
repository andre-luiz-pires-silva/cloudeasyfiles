import { type Dispatch, type SetStateAction, useState } from "react";
import {
  DEFAULT_AWS_UPLOAD_STORAGE_CLASS,
  type AwsUploadStorageClass
} from "../../connections/awsUploadStorageClasses";
import {
  DEFAULT_AZURE_UPLOAD_TIER,
  type AzureUploadTier
} from "../../connections/azureUploadTiers";
import type {
  AzureAuthenticationMethod,
  ConnectionFormMode,
  ConnectionProvider
} from "../../connections/models";
import type { NavigationFormErrors } from "../navigationValidation";

export type ConnectionTestStatus = "idle" | "testing" | "success" | "error";

export type ConnectionFormState = {
  isModalOpen: boolean;
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
  connectionTestStatus: ConnectionTestStatus;
  connectionTestMessage: string | null;
  formErrors: NavigationFormErrors;
  submitError: string | null;
  isSubmitting: boolean;
  setIsModalOpen: Dispatch<SetStateAction<boolean>>;
  setModalMode: Dispatch<SetStateAction<ConnectionFormMode>>;
  setEditingConnectionId: Dispatch<SetStateAction<string | null>>;
  setConnectionName: Dispatch<SetStateAction<string>>;
  setConnectionProvider: Dispatch<SetStateAction<ConnectionProvider>>;
  setAccessKeyId: Dispatch<SetStateAction<string>>;
  setSecretAccessKey: Dispatch<SetStateAction<string>>;
  setRestrictedBucketName: Dispatch<SetStateAction<string>>;
  setStorageAccountName: Dispatch<SetStateAction<string>>;
  setAzureAuthenticationMethod: Dispatch<SetStateAction<AzureAuthenticationMethod>>;
  setAzureAccountKey: Dispatch<SetStateAction<string>>;
  setConnectOnStartup: Dispatch<SetStateAction<boolean>>;
  setDefaultAwsUploadStorageClass: Dispatch<SetStateAction<AwsUploadStorageClass>>;
  setDefaultAzureUploadTier: Dispatch<SetStateAction<AzureUploadTier>>;
  setConnectionTestStatus: Dispatch<SetStateAction<ConnectionTestStatus>>;
  setConnectionTestMessage: Dispatch<SetStateAction<string | null>>;
  setFormErrors: Dispatch<SetStateAction<NavigationFormErrors>>;
  setSubmitError: Dispatch<SetStateAction<string | null>>;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
};

export function useConnectionFormState(): ConnectionFormState {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ConnectionFormMode>("create");
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState("");
  const [connectionProvider, setConnectionProvider] = useState<ConnectionProvider>("aws");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [restrictedBucketName, setRestrictedBucketName] = useState("");
  const [storageAccountName, setStorageAccountName] = useState("");
  const [azureAuthenticationMethod, setAzureAuthenticationMethod] =
    useState<AzureAuthenticationMethod>("shared_key");
  const [azureAccountKey, setAzureAccountKey] = useState("");
  const [connectOnStartup, setConnectOnStartup] = useState(false);
  const [defaultAwsUploadStorageClass, setDefaultAwsUploadStorageClass] =
    useState<AwsUploadStorageClass>(DEFAULT_AWS_UPLOAD_STORAGE_CLASS);
  const [defaultAzureUploadTier, setDefaultAzureUploadTier] =
    useState<AzureUploadTier>(DEFAULT_AZURE_UPLOAD_TIER);
  const [connectionTestStatus, setConnectionTestStatus] =
    useState<ConnectionTestStatus>("idle");
  const [connectionTestMessage, setConnectionTestMessage] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<NavigationFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return {
    isModalOpen,
    modalMode,
    editingConnectionId,
    connectionName,
    connectionProvider,
    accessKeyId,
    secretAccessKey,
    restrictedBucketName,
    storageAccountName,
    azureAuthenticationMethod,
    azureAccountKey,
    connectOnStartup,
    defaultAwsUploadStorageClass,
    defaultAzureUploadTier,
    connectionTestStatus,
    connectionTestMessage,
    formErrors,
    submitError,
    isSubmitting,
    setIsModalOpen,
    setModalMode,
    setEditingConnectionId,
    setConnectionName,
    setConnectionProvider,
    setAccessKeyId,
    setSecretAccessKey,
    setRestrictedBucketName,
    setStorageAccountName,
    setAzureAuthenticationMethod,
    setAzureAccountKey,
    setConnectOnStartup,
    setDefaultAwsUploadStorageClass,
    setDefaultAzureUploadTier,
    setConnectionTestStatus,
    setConnectionTestMessage,
    setFormErrors,
    setSubmitError,
    setIsSubmitting
  };
}
