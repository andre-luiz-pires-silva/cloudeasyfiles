import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

import { invoke } from "@tauri-apps/api/core";
import {
  deleteAwsConnectionSecrets,
  deleteAzureConnectionSecrets,
  loadAwsConnectionSecrets,
  loadAzureConnectionSecrets,
  saveAwsConnectionSecrets,
  saveAzureConnectionSecrets
} from "./connectionSecrets";

const invokeMock = vi.mocked(invoke);

describe("connectionSecrets", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("forwards AWS secret persistence commands to the expected Tauri handlers", async () => {
    invokeMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ accessKeyId: "AKIA", secretAccessKey: "SECRET" })
      .mockResolvedValueOnce(undefined);

    await expect(
      saveAwsConnectionSecrets({
        connectionId: "conn-1",
        accessKeyId: "AKIA",
        secretAccessKey: "SECRET"
      })
    ).resolves.toBeUndefined();
    await expect(loadAwsConnectionSecrets("conn-1")).resolves.toEqual({
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET"
    });
    await expect(deleteAwsConnectionSecrets("conn-1")).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenNthCalledWith(1, "save_aws_connection_secrets", {
      connectionId: "conn-1",
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "load_aws_connection_secrets", {
      connectionId: "conn-1"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "delete_aws_connection_secrets", {
      connectionId: "conn-1"
    });
  });

  it("forwards Azure secret persistence commands to the expected Tauri handlers", async () => {
    invokeMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ accountKey: "key" })
      .mockResolvedValueOnce(undefined);

    await expect(
      saveAzureConnectionSecrets({
        connectionId: "conn-2",
        accountKey: "key"
      })
    ).resolves.toBeUndefined();
    await expect(loadAzureConnectionSecrets("conn-2")).resolves.toEqual({
      accountKey: "key"
    });
    await expect(deleteAzureConnectionSecrets("conn-2")).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenNthCalledWith(1, "save_azure_connection_secrets", {
      connectionId: "conn-2",
      accountKey: "key"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "load_azure_connection_secrets", {
      connectionId: "conn-2"
    });
    expect(invokeMock).toHaveBeenNthCalledWith(3, "delete_azure_connection_secrets", {
      connectionId: "conn-2"
    });
  });
});
