import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionNavigator } from "./ConnectionNavigator";
import { connectionService } from "../connections/services/connectionService";

const t = (key: string) => key;

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => false
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn()
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onDragDropEvent: vi.fn()
  })
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn()
}));

vi.mock("../connections/services/connectionService", () => ({
  connectionService: {
    listConnections: vi.fn(),
    getAwsConnectionDraft: vi.fn(),
    getAzureConnectionDraft: vi.fn(),
    saveAwsConnection: vi.fn(),
    saveAzureConnection: vi.fn(),
    updateAwsUploadStorageClass: vi.fn(),
    updateAzureUploadTier: vi.fn(),
    deleteConnection: vi.fn()
  }
}));

vi.mock("../../lib/tauri/awsConnections", () => ({
  awsObjectExists: vi.fn(),
  cancelAwsUpload: vi.fn(),
  cancelAwsDownload: vi.fn(),
  changeAwsObjectStorageClass: vi.fn(),
  createAwsFolder: vi.fn(),
  deleteAwsObjects: vi.fn(),
  deleteAwsPrefix: vi.fn(),
  downloadAwsObjectToPath: vi.fn(),
  findAwsCachedObjects: vi.fn(),
  getAwsBucketRegion: vi.fn(),
  openAwsCachedObject: vi.fn(),
  openAwsCachedObjectParent: vi.fn(),
  requestAwsObjectRestore: vi.fn(),
  startAwsUpload: vi.fn(),
  startAwsUploadFromBytes: vi.fn(),
  startAwsCacheDownload: vi.fn(),
  testAwsConnection: vi.fn()
}));

vi.mock("../../lib/tauri/azureConnections", () => ({
  azureBlobExists: vi.fn(),
  cancelAzureDownload: vi.fn(),
  changeAzureBlobAccessTier: vi.fn(),
  createAzureFolder: vi.fn(),
  downloadAzureBlobToPath: vi.fn(),
  deleteAzureObjects: vi.fn(),
  deleteAzurePrefix: vi.fn(),
  findAzureCachedObjects: vi.fn(),
  openAzureCachedObject: vi.fn(),
  openAzureCachedObjectParent: vi.fn(),
  cancelAzureUpload: vi.fn(),
  rehydrateAzureBlob: vi.fn(),
  startAzureCacheDownload: vi.fn(),
  startAzureUpload: vi.fn(),
  startAzureUploadFromBytes: vi.fn(),
  testAzureConnection: vi.fn()
}));

vi.mock("../../lib/i18n/useI18n", () => ({
  useI18n: () => ({
    t
  })
}));

const mockedConnectionService = vi.mocked(connectionService);

describe("ConnectionNavigator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockedConnectionService.listConnections.mockResolvedValue([]);
  });

  it("renders the home shell after loading connections and opens the create modal", async () => {
    const onLocaleChange = vi.fn().mockResolvedValue(undefined);

    render(<ConnectionNavigator locale="en-US" onLocaleChange={onLocaleChange} />);

    await waitFor(() => {
      expect(mockedConnectionService.listConnections).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("heading", { name: "app.title" })).toBeInTheDocument();
    expect(screen.getByText("home.hero.title")).toBeInTheDocument();
    expect(screen.getByText("navigation.empty.title")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("settings.language"), {
      target: { value: "pt-BR" }
    });
    expect(onLocaleChange).toHaveBeenCalledWith("pt-BR");

    fireEvent.click(screen.getByRole("button", { name: "navigation.new_connection" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "navigation.modal.title" })).toBeInTheDocument();
  });

  it("surfaces connection loading failures in the home view", async () => {
    mockedConnectionService.listConnections.mockRejectedValue(new Error("Unable to load"));

    render(<ConnectionNavigator locale="en-US" onLocaleChange={vi.fn()} />);

    expect(await screen.findByText("Unable to load")).toBeInTheDocument();
    expect(screen.getByText("navigation.empty.title")).toBeInTheDocument();
  });
});
