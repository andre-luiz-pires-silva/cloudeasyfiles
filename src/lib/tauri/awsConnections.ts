import { invoke } from "@tauri-apps/api/core";

type AwsConnectionTestResult = {
  accountId: string;
  arn: string;
  userId: string;
};

export type AwsBucketSummary = {
  name: string;
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
