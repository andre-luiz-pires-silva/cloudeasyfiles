import { invoke } from "@tauri-apps/api/core";

type AwsConnectionTestResult = {
  accountId: string;
  arn: string;
  userId: string;
};

export async function testAwsConnection(
  region: string,
  accessKeyId: string,
  secretAccessKey: string
): Promise<AwsConnectionTestResult> {
  return invoke<AwsConnectionTestResult>("test_aws_connection", {
    region,
    accessKeyId,
    secretAccessKey
  });
}
