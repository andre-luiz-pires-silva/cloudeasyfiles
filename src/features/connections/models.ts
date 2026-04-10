export type ConnectionProvider = "aws" | "azure";
import type { AzureUploadTier } from "./azureUploadTiers";

export type AzureAuthenticationMethod = "shared_key" | "entra_id";
export type AzureAccessTier = AzureUploadTier;

export type AwsUploadStorageClass =
  | "STANDARD"
  | "STANDARD_IA"
  | "ONEZONE_IA"
  | "INTELLIGENT_TIERING"
  | "GLACIER_IR"
  | "GLACIER"
  | "DEEP_ARCHIVE";

type SavedConnectionBase = {
  id: string;
  name: string;
  provider: ConnectionProvider;
  connectOnStartup?: boolean;
};

export type SavedAwsConnectionSummary = SavedConnectionBase & {
  provider: "aws";
  restrictedBucketName?: string;
  defaultUploadStorageClass?: AwsUploadStorageClass;
};

export type SavedAzureConnectionSummary = SavedConnectionBase & {
  provider: "azure";
  storageAccountName: string;
  authenticationMethod: AzureAuthenticationMethod;
  defaultUploadTier?: AzureUploadTier;
};

export type SavedConnectionSummary = SavedAwsConnectionSummary | SavedAzureConnectionSummary;

export type AwsConnectionDraft = {
  id?: string;
  name: string;
  provider: "aws";
  accessKeyId: string;
  secretAccessKey: string;
  restrictedBucketName?: string;
  connectOnStartup?: boolean;
  defaultUploadStorageClass?: AwsUploadStorageClass;
};

export type AzureConnectionDraft = {
  id?: string;
  name: string;
  provider: "azure";
  storageAccountName: string;
  authenticationMethod: AzureAuthenticationMethod;
  accountKey: string;
  connectOnStartup?: boolean;
  defaultUploadTier?: AzureUploadTier;
};

export type ConnectionFormMode = "create" | "edit";
