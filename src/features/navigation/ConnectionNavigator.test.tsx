import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionNavigator } from "./ConnectionNavigator";
import { connectionService } from "../connections/services/connectionService";
import { getAwsBucketRegion } from "../../lib/tauri/awsConnections";
import {
  listContainerItemsForSavedConnection,
  listContainersForSavedConnection,
  testConnectionForSavedConnection
} from "./providerReadAdapters";

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

vi.mock("./providerReadAdapters", () => ({
  testConnectionForSavedConnection: vi.fn(),
  listContainersForSavedConnection: vi.fn(),
  listContainerItemsForSavedConnection: vi.fn()
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
const mockedGetAwsBucketRegion = vi.mocked(getAwsBucketRegion);
const mockedTestConnectionForSavedConnection = vi.mocked(testConnectionForSavedConnection);
const mockedListContainersForSavedConnection = vi.mocked(listContainersForSavedConnection);
const mockedListContainerItemsForSavedConnection = vi.mocked(
  listContainerItemsForSavedConnection
);

describe("ConnectionNavigator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockedConnectionService.listConnections.mockResolvedValue([]);
    mockedConnectionService.getAwsConnectionDraft.mockResolvedValue({
      id: "connection-aws",
      name: "Production AWS",
      provider: "aws",
      accessKeyId: "AKIA",
      secretAccessKey: "SECRET",
      connectOnStartup: false,
      defaultUploadStorageClass: "STANDARD"
    });
    mockedGetAwsBucketRegion.mockResolvedValue("us-east-1");
    mockedTestConnectionForSavedConnection.mockResolvedValue({
      provider: "aws",
      accountLabel: "123456789012"
    });
    mockedListContainersForSavedConnection.mockResolvedValue([]);
    mockedListContainerItemsForSavedConnection.mockResolvedValue({
      provider: "aws",
      region: "us-east-1",
      directories: [],
      files: [],
      continuationToken: null,
      hasMore: false
    });
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

  it("connects an existing AWS connection and loads an empty bucket", async () => {
    const awsConnection = {
      id: "connection-aws",
      name: "Production AWS",
      provider: "aws" as const,
      connectOnStartup: false,
      defaultUploadStorageClass: "STANDARD" as const
    };
    mockedConnectionService.listConnections.mockResolvedValue([awsConnection]);
    mockedListContainersForSavedConnection.mockResolvedValue([
      { name: "archive", region: null },
      { name: "logs", region: null }
    ]);

    render(<ConnectionNavigator locale="en-US" onLocaleChange={vi.fn()} />);

    const connectionButton = await screen.findByRole("button", { name: /Production AWS/i });
    fireEvent.doubleClick(connectionButton);

    await waitFor(() => {
      expect(mockedTestConnectionForSavedConnection).toHaveBeenCalledWith(awsConnection);
    });
    await waitFor(() => {
      expect(mockedListContainersForSavedConnection).toHaveBeenCalledWith(awsConnection);
    });

    const archiveBucketButton = await screen.findByRole("button", { name: /archive/i });
    expect(screen.getByTitle("navigation.connection_status.connected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logs/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedGetAwsBucketRegion).toHaveBeenCalledWith(
        "AKIA",
        "SECRET",
        "archive",
        undefined
      );
    });

    fireEvent.click(archiveBucketButton);

    await waitFor(() => {
      expect(mockedListContainerItemsForSavedConnection).toHaveBeenCalledWith(
        awsConnection,
        "archive",
        expect.objectContaining({
          path: undefined,
          pageSize: expect.any(Number)
        })
      );
    });
    expect(await screen.findByText("content.list.empty_container")).toBeInTheDocument();
  });
});
