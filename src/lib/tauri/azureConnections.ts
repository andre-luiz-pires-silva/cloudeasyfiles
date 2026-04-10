import { invoke } from "@tauri-apps/api/core";

export type AzureConnectionTestResult = {
  storageAccountName: string;
  accountUrl: string;
};

export type AzureContainerSummary = {
  name: string;
};

export type AzureVirtualDirectorySummary = {
  name: string;
  path: string;
};

export type AzureBlobSummary = {
  name: string;
  size: number;
  eTag?: string | null;
  lastModified?: string | null;
  storageClass?: string | null;
  restoreInProgress?: boolean | null;
  restoreExpiryDate?: string | null;
};

export type AzureContainerItemsResult = {
  directories: AzureVirtualDirectorySummary[];
  files: AzureBlobSummary[];
  continuationToken?: string | null;
  hasMore: boolean;
};

export async function testAzureConnection(
  storageAccountName: string,
  accountKey: string
): Promise<AzureConnectionTestResult> {
  return invoke<AzureConnectionTestResult>("test_azure_connection", {
    storageAccountName,
    accountKey
  });
}

export async function listAzureContainers(
  storageAccountName: string,
  accountKey: string
): Promise<AzureContainerSummary[]> {
  return invoke<AzureContainerSummary[]>("list_azure_containers", {
    storageAccountName,
    accountKey
  });
}

export async function listAzureContainerItems(
  storageAccountName: string,
  accountKey: string,
  containerName: string,
  prefix?: string,
  continuationToken?: string
): Promise<AzureContainerItemsResult> {
  return invoke<AzureContainerItemsResult>("list_azure_container_items", {
    storageAccountName,
    accountKey,
    containerName,
    prefix,
    continuationToken
  });
}
