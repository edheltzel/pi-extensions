import { afterEach, describe, expect, it, vi } from "vitest";
import { buildEntries } from "../src/index";
import { buildDisplayRows } from "../src/favourite-models";
import { getThinkingDescription, isModelEnabled } from "../src/model-switcher";
import {
  buildAgentsGroup,
  buildQuitAction,
  buildTreeAction,
  runCommand,
} from "../src/workflow-actions";

const keys = (entries: ReturnType<typeof buildEntries>) =>
  entries.map((entry) => (entry.type === "group" ? entry.group.key : entry.key));

describe("leader palette entries", () => {
  it("exposes model, agent, tree, and quit actions", () => {
    const entries = buildEntries(
      {} as never,
      async () => {},
      async () => {},
      async () => {},
    );
    expect(keys(entries)).toEqual(["m", "a", "t", "q"]);

    const model = entries.find((entry) => entry.type === "group" && entry.group.key === "m");
    expect(model?.type).toBe("group");
    if (model?.type === "group") {
      expect(model.group.items.map((item) => item.key)).toEqual(["s", "w", "t"]);
    }

    const agents = entries.find((entry) => entry.type === "group" && entry.group.key === "a");
    expect(agents?.type).toBe("group");
    if (agents?.type === "group") {
      expect(agents.group.items.map((item) => item.key)).toEqual(["s", "p"]);
    }
  });

  it("does not expose tomsej-only contracts or plannotator groups", () => {
    const entries = buildEntries(
      {} as never,
      async () => {},
      async () => {},
      async () => {},
    );
    expect(keys(entries)).not.toContain("c");
    expect(keys(entries)).not.toContain("p");
  });

  it("launches native commands and quits directly", async () => {
    const setEditorText = vi.fn();
    const shutdown = vi.fn();
    const ctx = {
      ui: { setEditorText },
      shutdown,
    } as never;
    const stdinEmit = vi.spyOn(process.stdin, "emit").mockImplementation(() => true);

    try {
      const agents = buildAgentsGroup();
      if (agents.type !== "group") throw new Error("Agents group missing");
      for (const key of ["s", "p"]) {
        await agents.group.items.find((item) => item.key === key)?.action(ctx);
      }

      const tree = buildTreeAction();
      if (tree.type !== "action") throw new Error("Tree action missing");
      await tree.action(ctx);

      const quit = buildQuitAction();
      if (quit.type !== "action") throw new Error("Quit action missing");
      await quit.action(ctx);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(setEditorText.mock.calls.map(([command]) => command)).toEqual([
        "/subagents",
        "/ps",
        "/tree",
      ]);
      expect(shutdown).toHaveBeenCalledTimes(1);
    } finally {
      stdinEmit.mockRestore();
    }
  });

  it("stages a slash command and submits it", async () => {
    const setEditorText = vi.fn();
    const stdinEmit = vi.spyOn(process.stdin, "emit").mockImplementation(() => true);
    try {
      runCommand({ ui: { setEditorText } } as never, "/tree");
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(setEditorText).toHaveBeenCalledWith("/tree");
      expect(stdinEmit).toHaveBeenCalled();
    } finally {
      stdinEmit.mockRestore();
    }
  });
});

describe("model helpers", () => {
  it("describes every thinking level", () => {
    expect(getThinkingDescription("off")).toBe("No extended thinking");
    expect(getThinkingDescription("xhigh")).toBe("Maximum reasoning effort");
  });

  it("matches enabledModels exact ids and globs", () => {
    expect(isModelEnabled("anthropic", "claude", undefined)).toBe(true);
    expect(isModelEnabled("anthropic", "claude", new Set(["anthropic/claude"]))).toBe(true);
    expect(isModelEnabled("openai", "gpt", new Set(["anthropic/*"]))).toBe(false);
    expect(isModelEnabled("anthropic", "claude-opus", new Set(["anthropic/*"]))).toBe(true);
  });

  it("groups scoped models by provider", () => {
    const rows = buildDisplayRows([
      { label: "Opus", provider: "anthropic", model: "opus" },
      { label: "GPT", provider: "openai", model: "gpt" },
      { label: "Sonnet", provider: "anthropic", model: "sonnet" },
    ]);
    expect(rows.map((row) => row.type)).toEqual(["header", "model", "model", "header", "model"]);
    expect(rows[0]).toMatchObject({ type: "header", provider: "anthropic", count: 2 });
    expect(rows[3]).toMatchObject({ type: "header", provider: "openai", count: 1 });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
