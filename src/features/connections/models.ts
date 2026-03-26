export type ConnectionProvider = "aws" | "azure";

export type SavedConnectionSummary = {
  id: string;
  name: string;
  provider: ConnectionProvider;
  region: string;
  localCacheDirectory?: string;
};

export type AwsConnectionDraft = {
  id?: string;
  name: string;
  provider: "aws";
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  localCacheDirectory: string;
};

export type ConnectionFormMode = "create" | "edit";
