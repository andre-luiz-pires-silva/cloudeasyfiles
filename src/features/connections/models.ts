export type ConnectionProvider = "aws" | "azure";

export type SavedConnectionSummary = {
  id: string;
  name: string;
  provider: ConnectionProvider;
};

export type AwsConnectionDraft = {
  id?: string;
  name: string;
  provider: "aws";
  accessKeyId: string;
  secretAccessKey: string;
};

export type ConnectionFormMode = "create" | "edit";
