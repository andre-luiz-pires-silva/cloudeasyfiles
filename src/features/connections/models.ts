export type ConnectionProvider = "aws" | "azure";

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
  defaultUploadStorageClass?: AwsUploadStorageClass;
};

export type SavedAzureConnectionSummary = SavedConnectionBase & {
  provider: "azure";
};

export type SavedConnectionSummary = SavedAwsConnectionSummary | SavedAzureConnectionSummary;

export type AwsConnectionDraft = {
  id?: string;
  name: string;
  provider: "aws";
  accessKeyId: string;
  secretAccessKey: string;
  connectOnStartup?: boolean;
  defaultUploadStorageClass?: AwsUploadStorageClass;
};

export type ConnectionFormMode = "create" | "edit";
