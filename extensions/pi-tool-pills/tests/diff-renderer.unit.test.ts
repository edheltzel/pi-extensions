import { afterEach, describe, expect, it, vi } from "vitest";

const pendingHighlights: Array<{ code: string; resolve: (value: string) => void }> = [];

vi.mock("@shikijs/cli", () => ({
  codeToANSI: (code: string) =>
    new Promise<string>((resolve) => {
      pendingHighlights.push({ code, resolve });
    }),
}));

import { registerDiffTools } from "../src/diff-renderer";

const theme = {
  fg: (_role: string, text: string) => text,
  bold: (text: string) => text,
  inverse: (text: string) => text,
};

function writeRenderer() {
  const tools: Array<{
    name: string;
    renderCall: (...args: never[]) => { render: (width: number) => string[] };
  }> = [];
  registerDiffTools({
    registerTool: (tool: (typeof tools)[number]) => {
      tools.push(tool);
    },
  } as never);
  const tool = tools.find((entry) => entry.name === "write");
  if (!tool) throw new Error("write tool was not registered");
  return tool;
}

function renderCall(
  tool: { renderCall: (...args: never[]) => { render: (width: number) => string[] } },
  args: Record<string, unknown>,
  ctx: unknown,
): string {
  return tool
    .renderCall(args as never, theme as never, ctx as never)
    .render(200)
    .join("\n");
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !condition(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  expect(condition()).toBe(true);
}

describe("write preview", () => {
  afterEach(() => {
    pendingHighlights.length = 0;
  });

  it("refreshes a new-file preview when same-length content changes", async () => {
    const tool = writeRenderer();
    const ctx = {
      state: {},
      argsComplete: true,
      expanded: false,
      invalidate() {},
    };
    const path = `/tmp/tool-pills-${process.pid}-${Date.now()}.ts`;

    renderCall(tool, { path, content: "const a = 1;" }, ctx);
    await waitFor(() => pendingHighlights.length === 1);

    renderCall(tool, { path, content: "const b = 2;" }, ctx);
    await waitFor(() => pendingHighlights.length === 2);

    pendingHighlights[1]!.resolve(pendingHighlights[1]!.code);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(renderCall(tool, { path, content: "const b = 2;" }, ctx)).toContain("const b = 2;");

    pendingHighlights[0]!.resolve(pendingHighlights[0]!.code);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const rendered = renderCall(tool, { path, content: "const b = 2;" }, ctx);
    expect(rendered).toContain("const b = 2;");
    expect(rendered).not.toContain("const a = 1;");
  });
});
