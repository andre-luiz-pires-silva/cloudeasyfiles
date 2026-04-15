import { describe, expect, it } from "vitest";

import {
  buildConnectedIndicator,
  buildConnectingIndicator,
  buildConnectionErrorIndicator,
  buildConnectionTestInProgressState,
  buildConnectionTestMissingAccountState,
  buildConnectionTestSuccessState,
  buildConnectionTestValidationFailureState,
  buildDisconnectedIndicator,
  buildNextConnectionRequestId,
  buildResetConnectionTestState,
  clearConnectionProviderAccountId,
  setConnectionProviderAccountId,
  updateConnectionIndicatorMap
} from "./navigationConnectionState";

describe("navigationConnectionState", () => {
  it("builds connection test reset and in-progress states", () => {
    const t = (key: string) => key;

    expect(buildResetConnectionTestState(2)).toEqual({
      requestId: 3,
      status: "idle",
      message: null
    });
    expect(buildConnectionTestInProgressState("aws", 4, t)).toEqual({
      requestId: 5,
      status: "testing",
      message: "navigation.modal.aws.test_connection_in_progress"
    });
    expect(buildConnectionTestInProgressState("azure", 1, t)).toEqual({
      requestId: 2,
      status: "testing",
      message: "navigation.modal.azure.test_connection_in_progress"
    });
  });

  it("builds validation, missing-account and success states", () => {
    const t = (key: string) => key;

    expect(buildConnectionTestValidationFailureState("aws", t)).toEqual({
      status: "error",
      message: "navigation.modal.aws.test_connection_validation_error"
    });
    expect(buildConnectionTestMissingAccountState("azure", t)).toEqual({
      status: "error",
      message: "navigation.modal.azure.test_connection_failure"
    });
    expect(buildConnectionTestSuccessState("aws", "123456789012", t)).toEqual({
      status: "success",
      message: "navigation.modal.aws.test_connection_success".replace(
        "{accountId}",
        "123456789012"
      )
    });
    expect(buildConnectionTestSuccessState("azure", "storageaccount", t)).toEqual({
      status: "success",
      message: "navigation.modal.azure.test_connection_success".replace(
        "{storageAccountName}",
        "storageaccount"
      )
    });
  });

  it("updates connection indicators and account labels immutably", () => {
    expect(
      updateConnectionIndicatorMap(
        { "conn-1": { status: "disconnected" } },
        "conn-2",
        { status: "connecting" }
      )
    ).toEqual({
      "conn-1": { status: "disconnected" },
      "conn-2": { status: "connecting" }
    });

    expect(clearConnectionProviderAccountId({ "conn-1": "acct-1", "conn-2": "acct-2" }, "conn-1")).toEqual({
      "conn-2": "acct-2"
    });

    expect(setConnectionProviderAccountId({ "conn-1": "acct-1" }, "conn-2", "acct-2")).toEqual({
      "conn-1": "acct-1",
      "conn-2": "acct-2"
    });
  });

  it("builds request ids and indicator helpers", () => {
    expect(buildNextConnectionRequestId({ "conn-1": 3 }, "conn-1")).toEqual({
      requestId: 4,
      requestIds: { "conn-1": 4 }
    });
    expect(buildNextConnectionRequestId({}, "conn-2")).toEqual({
      requestId: 1,
      requestIds: { "conn-2": 1 }
    });

    expect(buildDisconnectedIndicator()).toEqual({ status: "disconnected" });
    expect(buildConnectingIndicator()).toEqual({ status: "connecting" });
    expect(buildConnectedIndicator()).toEqual({ status: "connected" });
    expect(buildConnectionErrorIndicator("failed")).toEqual({
      status: "error",
      message: "failed"
    });
  });
});
