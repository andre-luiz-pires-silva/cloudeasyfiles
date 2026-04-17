import { describe, expect, it, vi } from "vitest";

import {
  executeConnectionActionDispatch,
  executeDefaultConnectionAction,
  getConnectionActionDispatchSteps,
  getContentAreaActionDispatchStep,
  getDefaultConnectionActionStep
} from "./navigationActionDispatch";

describe("navigationActionDispatch", () => {
  it("plans connection menu actions in the expected order", () => {
    expect(getConnectionActionDispatchSteps("connect")).toEqual(["closeMenu", "connect"]);
    expect(getConnectionActionDispatchSteps("cancelConnect")).toEqual([
      "cancelConnect",
      "closeMenu"
    ]);
    expect(getConnectionActionDispatchSteps("disconnect")).toEqual([
      "disconnect",
      "closeMenu"
    ]);
    expect(getConnectionActionDispatchSteps("edit")).toEqual(["edit", "closeMenu"]);
    expect(getConnectionActionDispatchSteps("remove")).toEqual(["remove"]);
  });

  it("selects the default connection action from the current indicator status", () => {
    expect(getDefaultConnectionActionStep({ status: "connecting" })).toBe("noop");
    expect(getDefaultConnectionActionStep({ status: "connected" })).toBe("edit");
    expect(getDefaultConnectionActionStep({ status: "disconnected" })).toBe("connect");
    expect(getDefaultConnectionActionStep({ status: "error" })).toBe("connect");
  });

  it("maps content area actions to the right dispatch step", () => {
    expect(getContentAreaActionDispatchStep("createFolder")).toBe("openCreateFolder");
    expect(getContentAreaActionDispatchStep("refresh")).toBe("refresh");
  });

  it("executes connection action steps in order", async () => {
    const calls: string[] = [];

    await executeConnectionActionDispatch({
      steps: ["closeMenu", "connect", "edit", "remove"],
      handlers: {
        closeMenu: () => calls.push("closeMenu"),
        connect: vi.fn(async () => {
          calls.push("connect");
        }),
        cancelConnect: vi.fn(async () => {
          calls.push("cancelConnect");
        }),
        disconnect: vi.fn(async () => {
          calls.push("disconnect");
        }),
        edit: vi.fn(async () => {
          calls.push("edit");
        }),
        remove: vi.fn(async () => {
          calls.push("remove");
        })
      }
    });

    expect(calls).toEqual(["closeMenu", "connect", "edit", "remove"]);
  });

  it("executes the default connection action only for connect or edit", async () => {
    const connect = vi.fn(async () => {});
    const edit = vi.fn(async () => {});

    await executeDefaultConnectionAction({
      step: "connect",
      handlers: { connect, edit }
    });
    await executeDefaultConnectionAction({
      step: "edit",
      handlers: { connect, edit }
    });
    await executeDefaultConnectionAction({
      step: "noop",
      handlers: { connect, edit }
    });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(edit).toHaveBeenCalledTimes(1);
  });
});
