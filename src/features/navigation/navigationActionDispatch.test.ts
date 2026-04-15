import { describe, expect, it } from "vitest";

import {
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
});
