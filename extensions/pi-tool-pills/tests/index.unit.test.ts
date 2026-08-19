import { describe, expect, it, vi } from "vitest";

import toolPills from "../src/index";

vi.mock("../src/runtime.ts", () => ({
  default: (pi: { registerTool: (tool: { name: string }) => void }) => {
    for (const name of ["ls", "read", "bash", "write", "edit"]) {
      pi.registerTool({ name });
    }
  },
}));

describe("tool pills lazy registration", () => {
  it("registers tool overrides only before the first agent turn", async () => {
    let beforeAgentStart: (() => Promise<void>) | undefined;
    const registeredTools: string[] = [];
    const pi = {
      on(event: string, handler: () => Promise<void>) {
        if (event === "before_agent_start") beforeAgentStart = handler;
      },
      registerTool(tool: { name: string }) {
        registeredTools.push(tool.name);
      },
    };

    toolPills(pi as never);

    expect(registeredTools).toEqual([]);
    expect(beforeAgentStart).toBeDefined();
    await beforeAgentStart!();
    expect(registeredTools.sort()).toEqual(["bash", "edit", "ls", "read", "write"]);

    await beforeAgentStart!();
    expect(registeredTools).toHaveLength(5);
  });
});
