import { sep } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { VERSION } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";

import footer, {
  calculateCacheHitPercent,
  contextBarWidth,
  contextFilledCells,
  formatCurrentDirectory,
  layoutStatusItems,
  NERD_FONT_ICONS,
} from "../src/index";

const ESC = String.fromCharCode(27);
const ansiPattern = new RegExp(`${ESC}\\[[0-9;]*m`, "g");
const stripAnsi = (text: string) => text.replace(ansiPattern, "");
const p = (...segments: string[]) => segments.join(sep);

describe("formatCurrentDirectory", () => {
  it("shortens a deep path to …/<parent>/<current>", () => {
    expect(formatCurrentDirectory(p("", "home", "user", "code", "myproj"))).toBe(
      `…${sep}code${sep}myproj`,
    );
  });

  it("keeps the leading ellipsis for a two-segment absolute path", () => {
    expect(formatCurrentDirectory(p("", "home", "user"))).toBe(`…${sep}home${sep}user`);
  });

  it("returns the tail without ellipsis for a shallow relative path", () => {
    expect(formatCurrentDirectory(p("parent", "current"))).toBe(p("parent", "current"));
  });
});

describe("calculateCacheHitPercent", () => {
  it("computes cacheRead / (input + cacheRead + cacheWrite)", () => {
    expect(calculateCacheHitPercent({ input: 100, cacheRead: 300, cacheWrite: 100 })).toBe(60);
  });

  it("rounds to a whole percent", () => {
    expect(calculateCacheHitPercent({ input: 0, cacheRead: 1, cacheWrite: 2 })).toBe(33);
    expect(calculateCacheHitPercent({ input: 0, cacheRead: 2, cacheWrite: 1 })).toBe(67);
  });

  it("returns null when there are no prompt tokens", () => {
    expect(calculateCacheHitPercent({ input: 0, cacheRead: 0, cacheWrite: 0 })).toBeNull();
  });
});

describe("contextBarWidth", () => {
  it("uses 24 cells at normal widths and smaller responsive meters when narrow", () => {
    expect(contextBarWidth(34)).toBe(6);
    expect(contextBarWidth(54)).toBe(8);
    expect(contextBarWidth(79)).toBe(16);
    expect(contextBarWidth(80)).toBe(24);
    expect(contextBarWidth(200)).toBe(24);
  });
});

describe("contextFilledCells", () => {
  it("fills whole cells proportional to the percent", () => {
    expect(contextFilledCells(50, 24)).toBe(12);
    expect(contextFilledCells(100, 24)).toBe(24);
    expect(contextFilledCells(0, 24)).toBe(0);
  });

  it("clamps out-of-range percents", () => {
    expect(contextFilledCells(150, 24)).toBe(24);
    expect(contextFilledCells(-10, 24)).toBe(0);
  });
});

describe("layoutStatusItems", () => {
  it("preserves item order and wraps onto extra lines when needed", () => {
    const lines = layoutStatusItems(["alpha", "beta", "gamma"], 12);
    expect(lines).toEqual(["alpha · beta", "gamma"]);
  });
});

type RenderHarness = {
  render: (width: number) => string[];
  rawRender: (width: number) => string;
  statuses: Map<string, string>;
};

type AssistantUsage = { input: number; cacheRead: number; cacheWrite: number };

const assistantEntry = (usage: AssistantUsage, stopReason = "stop") => ({
  type: "message",
  message: { role: "assistant", stopReason, usage },
});

const defaultBranch = [assistantEntry({ input: 100, cacheRead: 300, cacheWrite: 100 })];

const mountFooter = (options?: {
  statuses?: Map<string, string>;
  contextPercent?: number;
  branchEntries?: unknown[];
}): RenderHarness => {
  const statuses = options?.statuses ?? new Map<string, string>();
  const branchEntries = options?.branchEntries ?? defaultBranch;
  const handlers = new Map<string, (event: unknown, ctx: ExtensionContext) => void>();

  const pi = {
    on: (event: string, handler: (event: unknown, ctx: ExtensionContext) => void) => {
      handlers.set(event, handler);
    },
    getThinkingLevel: () => "high",
  } as unknown as ExtensionAPI;

  const ctx = {
    mode: "tui",
    model: { provider: "anthropic", id: "claude-opus-4" },
    getContextUsage: () => ({
      tokens: 50_000,
      contextWindow: 200_000,
      percent: options?.contextPercent ?? 25,
    }),
    sessionManager: {
      getCwd: () => p("", "home", "user", "code", "myproj"),
      getBranch: () => branchEntries,
    },
    ui: {},
  } as unknown as ExtensionContext;

  let component: (Component & { render(width: number): string[] }) | undefined;
  type Component = { render(width: number): string[] };

  const setFooter = vi.fn(
    (factory: (tui: unknown, theme: unknown, footerData: unknown) => Component) => {
      const tui = { requestRender: vi.fn() };
      const theme = {
        name: "eldritch",
        fg: (_color: string, text: string) => text,
        bold: (text: string) => text,
      };
      const footerData = {
        getGitBranch: () => "main",
        getExtensionStatuses: () => statuses,
        onBranchChange: () => () => {},
      };
      component = factory(tui, theme, footerData);
    },
  );
  (ctx.ui as unknown as { setFooter: typeof setFooter }).setFooter = setFooter;

  footer(pi);
  handlers.get("session_start")?.({}, ctx);
  if (!component) throw new Error("footer did not register a component");
  const active = component;

  return {
    render: (width: number) => active.render(width),
    rawRender: (width: number) => active.render(width).join("\n"),
    statuses,
  };
};

describe("footer render", () => {
  it("renders the Atlas items in order: π + version, provider/model + thinking, cwd, branch, meter, cache", () => {
    const { render } = mountFooter();
    const text = stripAnsi(render(200).join("\n"));

    const order = [
      "π",
      VERSION,
      "anthropic/",
      "claude-opus-4",
      "high",
      `code${sep}myproj`,
      NERD_FONT_ICONS.branch,
      "main",
      "25%",
      NERD_FONT_ICONS.cache,
      "60%",
    ];
    let previous = -1;
    for (const token of order) {
      const index = text.indexOf(token);
      expect(index, `expected to find ${JSON.stringify(token)}`).toBeGreaterThan(previous);
      previous = index;
    }
  });

  const countCells = (lines: string[]) => (stripAnsi(lines.join("\n")).match(/⛁/g) ?? []).length;

  it("uses a 24-cell context meter at normal widths (including the 80-column boundary)", () => {
    const { render } = mountFooter();
    expect(countCells(render(200))).toBe(24);
    expect(countCells(render(80))).toBe(24);
  });

  it("uses smaller responsive meters at narrow widths", () => {
    const { render } = mountFooter();
    expect(countCells(render(79))).toBe(16);
    expect(countCells(render(54))).toBe(8);
    expect(countCells(render(34))).toBe(6);
  });

  it("suppresses mcp and codex-status while preserving another extension's ANSI styling", () => {
    const styled = `${ESC}[32mbuild-ok${ESC}[39m`;
    const statuses = new Map<string, string>([
      ["mcp", "MCP_SHOULD_BE_HIDDEN"],
      ["codex-status", "CODEX_SHOULD_BE_HIDDEN"],
      ["other-ext", styled],
    ]);
    const raw = mountFooter({ statuses }).rawRender(200);

    expect(raw).not.toContain("MCP_SHOULD_BE_HIDDEN");
    expect(raw).not.toContain("CODEX_SHOULD_BE_HIDDEN");
    // The status keeps its own SGR color rather than being re-styled or stripped.
    expect(raw).toContain(styled);
  });

  it("keeps the background process special case", () => {
    const statuses = new Map<string, string>([["backgroundBashProcesses", "3 procs"]]);
    const text = stripAnsi(mountFooter({ statuses }).render(200).join("\n"));
    expect(text).toContain("3 ");
    expect(text).toContain("/proc");
  });

  it("reads cache from the latest successful assistant prompt, skipping aborted/error prompts", () => {
    const branchEntries = [
      assistantEntry({ input: 100, cacheRead: 100, cacheWrite: 0 }), // older, successful -> 50%
      assistantEntry({ input: 0, cacheRead: 300, cacheWrite: 0 }, "aborted"), // newer, aborted -> 100%
    ];
    const text = stripAnsi(mountFooter({ branchEntries }).render(200).join("\n"));

    expect(text).toContain("50%");
    expect(text).not.toContain("100%");
  });
});
