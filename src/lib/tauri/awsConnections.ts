import { invoke } from "@tauri-apps/api/core";

type AwsConnectionTestResult = {
  accountId: string;
  arn: string;
  userId: string;
};

export type AwsBucketSummary = {
  name: string;
};

export type AwsVirtualDirectorySummary = {
  name: string;
  path: string;
};

export type AwsObjectSummary = {
  key: string;
  size: number;
  eTag?: string | null;
  lastModified?: string | null;
  storageClass?: string | null;
};

export type AwsBucketItemsResult = {
  bucketRegion: string;
  directories: AwsVirtualDirectorySummary[];
  files: AwsObjectSummary[];
};

export async function testAwsConnection(
  accessKeyId: string,
  secretAccessKey: string
): Promise<AwsConnectionTestResult> {
  return invoke<AwsConnectionTestResult>("test_aws_connection", {
    accessKeyId,
    secretAccessKey
  });
}

export async function listAwsBuckets(
  accessKeyId: string,
  secretAccessKey: string
): Promise<AwsBucketSummary[]> {
  return invoke<AwsBucketSummary[]>("list_aws_buckets", {
    accessKeyId,
    secretAccessKey
  });
}

export async function getAwsBucketRegion(
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string
): Promise<string> {
  return invoke<string>("get_aws_bucket_region", {
    accessKeyId,
    secretAccessKey,
    bucketName
  });
}

export async function listAwsBucketItems(
  accessKeyId: string,
  secretAccessKey: string,
  bucketName: string,
  prefix?: string,
  bucketRegion?: string
): Promise<AwsBucketItemsResult> {
  return invoke<AwsBucketItemsResult>("list_aws_bucket_items", {
    accessKeyId,
    secretAccessKey,
    bucketName,
    prefix,
    bucketRegion
  });
}
