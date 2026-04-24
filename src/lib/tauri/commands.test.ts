import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

import { invoke } from "@tauri-apps/api/core";
import { getGreeting, validateLocalMappingDirectory } from "./commands";

const invokeMock = vi.mocked(invoke);

describe("commands", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("forwards generic commands to the expected Tauri handlers", async () => {
    invokeMock.mockResolvedValueOnce("Hello").mockResolvedValueOnce(true);

    await expect(getGreeting("pt-BR")).resolves.toBe("Hello");
    await expect(validateLocalMappingDirectory("/tmp/cache")).resolves.toBe(true);

    expect(invokeMock).toHaveBeenNthCalledWith(1, "get_greeting", { locale: "pt-BR" });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "validate_local_mapping_directory", {
      path: "/tmp/cache"
    });
  });
});
