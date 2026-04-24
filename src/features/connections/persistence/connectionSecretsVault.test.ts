import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionSecretsVault } from "./connectionSecretsVault";

vi.mock("../../../lib/tauri/connectionSecrets", () => ({
  saveAwsConnectionSecrets: vi.fn().mockResolvedValue(undefined),
  loadAwsConnectionSecrets: vi.fn().mockResolvedValue({ accessKeyId: "AKIA123", secretAccessKey: "secret" }),
  deleteAwsConnectionSecrets: vi.fn().mockResolvedValue(undefined),
  saveAzureConnectionSecrets: vi.fn().mockResolvedValue(undefined),
  loadAzureConnectionSecrets: vi.fn().mockResolvedValue({ accountKey: "az-key" }),
  deleteAzureConnectionSecrets: vi.fn().mockResolvedValue(undefined)
}));

import {
  saveAwsConnectionSecrets,
  loadAwsConnectionSecrets,
  deleteAwsConnectionSecrets,
  saveAzureConnectionSecrets,
  loadAzureConnectionSecrets,
  deleteAzureConnectionSecrets
} from "../../../lib/tauri/connectionSecrets";

describe("ConnectionSecretsVault", () => {
  let vault: ConnectionSecretsVault;

  beforeEach(() => {
    vault = new ConnectionSecretsVault();
    vi.clearAllMocks();
  });

  it("saves AWS secrets by delegating to saveAwsConnectionSecrets", async () => {
    await vault.saveAwsSecrets("conn-1", "AKIAXXX", "secret-key");
    expect(saveAwsConnectionSecrets).toHaveBeenCalledWith({
      connectionId: "conn-1",
      accessKeyId: "AKIAXXX",
      secretAccessKey: "secret-key"
    });
  });

  it("loads AWS secrets by delegating to loadAwsConnectionSecrets", async () => {
    vi.mocked(loadAwsConnectionSecrets).mockResolvedValue({ accessKeyId: "AKIAXXX", secretAccessKey: "secret-key" });
    const result = await vault.loadAwsSecrets("conn-1");
    expect(loadAwsConnectionSecrets).toHaveBeenCalledWith("conn-1");
    expect(result).toEqual({ accessKeyId: "AKIAXXX", secretAccessKey: "secret-key" });
  });

  it("deletes AWS secrets by delegating to deleteAwsConnectionSecrets", async () => {
    await vault.deleteAwsSecrets("conn-1");
    expect(deleteAwsConnectionSecrets).toHaveBeenCalledWith("conn-1");
  });

  it("saves Azure secrets by delegating to saveAzureConnectionSecrets", async () => {
    await vault.saveAzureSecrets("conn-2", "az-account-key");
    expect(saveAzureConnectionSecrets).toHaveBeenCalledWith({
      connectionId: "conn-2",
      accountKey: "az-account-key"
    });
  });

  it("loads Azure secrets by delegating to loadAzureConnectionSecrets", async () => {
    vi.mocked(loadAzureConnectionSecrets).mockResolvedValue({ accountKey: "az-account-key" });
    const result = await vault.loadAzureSecrets("conn-2");
    expect(loadAzureConnectionSecrets).toHaveBeenCalledWith("conn-2");
    expect(result).toEqual({ accountKey: "az-account-key" });
  });

  it("deletes Azure secrets by delegating to deleteAzureConnectionSecrets", async () => {
    await vault.deleteAzureSecrets("conn-2");
    expect(deleteAzureConnectionSecrets).toHaveBeenCalledWith("conn-2");
  });
});
