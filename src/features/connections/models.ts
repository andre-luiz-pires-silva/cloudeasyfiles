export type ConnectionProvider = "aws" | "azure";

export type SavedConnectionSummary = {
  id: string;
  name: string;
  provider: ConnectionProvider;
  localCacheDirectory?: string;
};

export type AwsConnectionDraft = {
  id?: string;
  name: string;
  provider: "aws";
  accessKeyId: string;
  secretAccessKey: string;
  localCacheDirectory: string;
};

export type ConnectionFormMode = "create" | "edit";
