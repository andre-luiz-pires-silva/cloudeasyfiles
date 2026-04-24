import { type Dispatch, type SetStateAction, useState } from "react";
import {
  DEFAULT_AWS_UPLOAD_STORAGE_CLASS,
  type AwsUploadStorageClass
} from "../../connections/awsUploadStorageClasses";
import {
  DEFAULT_AZURE_UPLOAD_TIER,
  type AzureUploadTier
} from "../../connections/azureUploadTiers";
import type { NavigationPendingDeleteState } from "../navigationTypes";
import type {
  NavigationRestoreRequestState as RestoreRequestState,
  NavigationChangeStorageClassRequestState as ChangeStorageClassRequestState
} from "../navigationWorkflows";

export type ModalOrchestrationState = {
  restoreRequest: RestoreRequestState | null;
  restoreSubmitError: string | null;
  isSubmittingRestoreRequest: boolean;
  changeStorageClassRequest: ChangeStorageClassRequestState | null;
  changeStorageClassSubmitError: string | null;
  isSubmittingStorageClassChange: boolean;
  isCreateFolderModalOpen: boolean;
  newFolderName: string;
  createFolderError: string | null;
  isCreatingFolder: boolean;
  pendingContentDelete: NavigationPendingDeleteState | null;
  deleteConfirmationValue: string;
  deleteContentError: string | null;
  isDeletingContent: boolean;
  isUploadSettingsModalOpen: boolean;
  uploadSettingsStorageClass: AwsUploadStorageClass;
  uploadSettingsAzureTier: AzureUploadTier;
  uploadSettingsSubmitError: string | null;
  isSavingUploadSettings: boolean;
  setRestoreRequest: Dispatch<SetStateAction<RestoreRequestState | null>>;
  setRestoreSubmitError: Dispatch<SetStateAction<string | null>>;
  setIsSubmittingRestoreRequest: Dispatch<SetStateAction<boolean>>;
  setChangeStorageClassRequest: Dispatch<SetStateAction<ChangeStorageClassRequestState | null>>;
  setChangeStorageClassSubmitError: Dispatch<SetStateAction<string | null>>;
  setIsSubmittingStorageClassChange: Dispatch<SetStateAction<boolean>>;
  setIsCreateFolderModalOpen: Dispatch<SetStateAction<boolean>>;
  setNewFolderName: Dispatch<SetStateAction<string>>;
  setCreateFolderError: Dispatch<SetStateAction<string | null>>;
  setIsCreatingFolder: Dispatch<SetStateAction<boolean>>;
  setPendingContentDelete: Dispatch<SetStateAction<NavigationPendingDeleteState | null>>;
  setDeleteConfirmationValue: Dispatch<SetStateAction<string>>;
  setDeleteContentError: Dispatch<SetStateAction<string | null>>;
  setIsDeletingContent: Dispatch<SetStateAction<boolean>>;
  setIsUploadSettingsModalOpen: Dispatch<SetStateAction<boolean>>;
  setUploadSettingsStorageClass: Dispatch<SetStateAction<AwsUploadStorageClass>>;
  setUploadSettingsAzureTier: Dispatch<SetStateAction<AzureUploadTier>>;
  setUploadSettingsSubmitError: Dispatch<SetStateAction<string | null>>;
  setIsSavingUploadSettings: Dispatch<SetStateAction<boolean>>;
};

export function useModalOrchestrationState(): ModalOrchestrationState {
  const [restoreRequest, setRestoreRequest] = useState<RestoreRequestState | null>(null);
  const [restoreSubmitError, setRestoreSubmitError] = useState<string | null>(null);
  const [isSubmittingRestoreRequest, setIsSubmittingRestoreRequest] = useState(false);

  const [changeStorageClassRequest, setChangeStorageClassRequest] =
    useState<ChangeStorageClassRequestState | null>(null);
  const [changeStorageClassSubmitError, setChangeStorageClassSubmitError] = useState<string | null>(
    null
  );
  const [isSubmittingStorageClassChange, setIsSubmittingStorageClassChange] = useState(false);

  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const [pendingContentDelete, setPendingContentDelete] =
    useState<NavigationPendingDeleteState | null>(null);
  const [deleteConfirmationValue, setDeleteConfirmationValue] = useState("");
  const [deleteContentError, setDeleteContentError] = useState<string | null>(null);
  const [isDeletingContent, setIsDeletingContent] = useState(false);

  const [isUploadSettingsModalOpen, setIsUploadSettingsModalOpen] = useState(false);
  const [uploadSettingsStorageClass, setUploadSettingsStorageClass] = useState<AwsUploadStorageClass>(
    DEFAULT_AWS_UPLOAD_STORAGE_CLASS
  );
  const [uploadSettingsAzureTier, setUploadSettingsAzureTier] =
    useState<AzureUploadTier>(DEFAULT_AZURE_UPLOAD_TIER);
  const [uploadSettingsSubmitError, setUploadSettingsSubmitError] = useState<string | null>(null);
  const [isSavingUploadSettings, setIsSavingUploadSettings] = useState(false);

  return {
    restoreRequest,
    restoreSubmitError,
    isSubmittingRestoreRequest,
    changeStorageClassRequest,
    changeStorageClassSubmitError,
    isSubmittingStorageClassChange,
    isCreateFolderModalOpen,
    newFolderName,
    createFolderError,
    isCreatingFolder,
    pendingContentDelete,
    deleteConfirmationValue,
    deleteContentError,
    isDeletingContent,
    isUploadSettingsModalOpen,
    uploadSettingsStorageClass,
    uploadSettingsAzureTier,
    uploadSettingsSubmitError,
    isSavingUploadSettings,
    setRestoreRequest,
    setRestoreSubmitError,
    setIsSubmittingRestoreRequest,
    setChangeStorageClassRequest,
    setChangeStorageClassSubmitError,
    setIsSubmittingStorageClassChange,
    setIsCreateFolderModalOpen,
    setNewFolderName,
    setCreateFolderError,
    setIsCreatingFolder,
    setPendingContentDelete,
    setDeleteConfirmationValue,
    setDeleteContentError,
    setIsDeletingContent,
    setIsUploadSettingsModalOpen,
    setUploadSettingsStorageClass,
    setUploadSettingsAzureTier,
    setUploadSettingsSubmitError,
    setIsSavingUploadSettings
  };
}
