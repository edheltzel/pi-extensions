import { afterEach, describe, expect, it } from "vitest";
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import {
  applyExactEdits,
  createAntiSlopExtension,
  normalizeToolPath,
  runVoiceLint,
  type AntiSlopExtensionOptions,
} from "../src/index";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "pi-anti-slop-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

type ExtensionHandler = (event: any, context: any) => Promise<unknown> | unknown;

function registerHandlers(options: AntiSlopExtensionOptions = {}): Map<string, ExtensionHandler> {
  const handlers = new Map<string, ExtensionHandler>();
  const pi = {
    on(event: string, candidate: ExtensionHandler) {
      handlers.set(event, candidate);
    },
  } as unknown as ExtensionAPI;

  createAntiSlopExtension(options)(pi);
  return handlers;
}

function registerGate(options: AntiSlopExtensionOptions = {}): ExtensionHandler {
  const handler = registerHandlers(options).get("tool_call");
  if (!handler) throw new Error("tool_call handler was not registered");
  return handler;
}

function context(cwd: string) {
  return {
    cwd,
    hasUI: false,
    ui: { notify() {} },
  };
}

function toolCall(toolName: string, input: Record<string, unknown>, toolCallId = "test-call") {
  return { type: "tool_call", toolCallId, toolName, input };
}

function blockedReason(result: Awaited<ReturnType<typeof runVoiceLint>>): string {
  if (result.status !== "blocked") throw new Error(`expected blocked result, got ${result.status}`);
  return result.reason;
}

describe("path and edit preparation", () => {
  it("normalizes every path form accepted by Pi file tools", () => {
    expect(normalizeToolPath("@docs/draft.md")).toBe("docs/draft.md");
    expect(normalizeToolPath("docs/draft.md")).toBe("docs/draft.md");
    expect(normalizeToolPath("~/draft.md")).toBe(join(homedir(), "draft.md"));
    expect(normalizeToolPath(pathToFileURL("/tmp/draft.md").href)).toBe("/tmp/draft.md");
    expect(normalizeToolPath("docs/non\u00a0breaking.md")).toBe("docs/non breaking.md");
  });

  it("applies unique non-overlapping edits against the original content", () => {
    const result = applyExactEdits("alpha beta gamma", [
      { oldText: "alpha", newText: "one" },
      { oldText: "gamma", newText: "three" },
    ]);

    expect(result).toBe("one beta three");
  });

  it("declines ambiguous, missing, and overlapping edits so Pi can reject them", () => {
    expect(applyExactEdits("same same", [{ oldText: "same", newText: "x" }])).toBeUndefined();
    expect(applyExactEdits("alpha", [{ oldText: "missing", newText: "x" }])).toBeUndefined();
    expect(
      applyExactEdits("alpha beta", [
        { oldText: "alpha beta", newText: "x" },
        { oldText: "beta", newText: "y" },
      ]),
    ).toBeUndefined();
  });

  it("preserves a BOM and CRLF line endings while constructing an edit candidate", () => {
    const result = applyExactEdits("\ufeffone\r\ntwo\r\n", [
      { oldText: "two\n", newText: "three\n" },
    ]);

    expect(result).toBe("\ufeffone\r\nthree\r\n");
  });

  it("matches Pi fuzzy edits while preserving unchanged lines", () => {
    const result = applyExactEdits("He said “hello”.\nKeep — dash.\n", [
      { oldText: 'He said "hello".', newText: "Changed—prose." },
    ]);

    expect(result).toBe("Changed—prose.\nKeep — dash.\n");
  });
});

describe("voice linter process", () => {
  it("returns clean for acceptable prose and blocks house-style findings", async () => {
    const clean = await runVoiceLint({ content: "Plain prose.\n", targetPath: "draft.md" });
    const blocked = await runVoiceLint({
      content: `A sentence${String.fromCodePoint(0x2014)}with a long dash.\n`,
      targetPath: "draft.md",
    });

    expect(clean.status).toBe("clean");
    expect(blocked.status).toBe("blocked");
    expect(blockedReason(blocked)).toContain("house style");
    expect(blockedReason(blocked)).toContain("not an authorship signal");
  });

  it("fails open when the configured scanner is absent", async () => {
    const scriptsDir = await temporaryDirectory();
    const result = await runVoiceLint({ content: "text", targetPath: "draft.md", scriptsDir });

    expect(result).toEqual({ status: "unavailable" });
  });

  it("blocks loudly when Python cannot launch", async () => {
    const result = await runVoiceLint({
      content: "text",
      targetPath: "draft.md",
      pythonCommand: "__pi_anti_slop_missing_python__",
    });

    expect(result.status).toBe("blocked");
    expect(blockedReason(result)).toContain("could not start");
  });

  it("treats scanner execution errors as gate failures, not style findings", async () => {
    const scriptsDir = await temporaryDirectory();
    await writeFile(
      join(scriptsDir, "lint_voice.py"),
      "import sys\nprint('scanner configuration failed', file=sys.stderr)\nsys.exit(2)\n",
      "utf8",
    );

    const result = await runVoiceLint({ content: "text", targetPath: "draft.md", scriptsDir });

    expect(result.status).toBe("blocked");
    expect(blockedReason(result)).toContain("failed with exit code 2");
    expect(blockedReason(result)).toContain("scanner configuration failed");
    expect(blockedReason(result)).not.toContain("house style");
  });

  it("bounds scanner output and enforces the timeout", async () => {
    const scriptsDir = await temporaryDirectory();
    await writeFile(
      join(scriptsDir, "lint_voice.py"),
      "import sys,time\nprint('x' * 50000)\ntime.sleep(1)\nsys.exit(1)\n",
      "utf8",
    );

    const result = await runVoiceLint({
      content: "text",
      targetPath: "draft.md",
      scriptsDir,
      timeoutMs: 25,
      maxOutputBytes: 1024,
    });

    expect(result.status).toBe("blocked");
    expect(blockedReason(result)).toContain("timed out");
    expect(blockedReason(result).length).toBeLessThan(1300);
  });

  it("returns promptly and terminates the scanner when its signal is aborted", async () => {
    const scriptsDir = await temporaryDirectory();
    await writeFile(join(scriptsDir, "lint_voice.py"), "import time\ntime.sleep(5)\n", "utf8");
    const controller = new AbortController();
    const startedAt = performance.now();
    const pending = runVoiceLint({
      content: "text",
      targetPath: "draft.md",
      scriptsDir,
      signal: controller.signal,
    });

    setTimeout(() => controller.abort(), 20);
    const result = await pending;

    expect(result.status).toBe("blocked");
    expect(blockedReason(result)).toContain("cancelled");
    expect(performance.now() - startedAt).toBeLessThan(500);
  });
});

describe("Pi tool gate", () => {
  it("ignores tools other than write and edit", async () => {
    const handler = registerGate();

    expect(
      await handler(toolCall("read", { path: "draft.md" }), context(process.cwd())),
    ).toBeUndefined();
  });

  it("permits clean writes and blocks house-style writes before mutation", async () => {
    const cwd = await temporaryDirectory();
    const handlers = registerHandlers();
    const handler = handlers.get("tool_call");
    const toolResult = handlers.get("tool_result");
    if (!handler || !toolResult) throw new Error("required handlers were not registered");

    expect(
      await handler(
        toolCall("write", { path: "draft.md", content: "Plain prose.\n" }, "clean"),
        context(cwd),
      ),
    ).toBeUndefined();
    await toolResult({ type: "tool_result", toolCallId: "clean" }, context(cwd));

    const blocked = await handler(
      toolCall("write", {
        path: "draft.md",
        content: `A sentence${String.fromCodePoint(0x2014)}with a long dash.\n`,
      }),
      context(cwd),
    );

    expect(blocked).toEqual(expect.objectContaining({ block: true }));
    expect((blocked as { reason: string }).reason).toContain("house style");
  });

  it("checks the prospective result of a valid fuzzy edit without changing its input", async () => {
    const cwd = await temporaryDirectory();
    const target = join(cwd, "draft.md");
    await writeFile(target, "Plain “prose”.\n", "utf8");
    const handler = registerGate();
    const event = toolCall("edit", {
      path: pathToFileURL(target).href,
      edits: [
        {
          oldText: 'Plain "prose".',
          newText: `Changed${String.fromCodePoint(0x2014)}prose.`,
        },
      ],
    });
    const originalInput = structuredClone(event.input);

    const blocked = await handler(event, context(cwd));

    expect(blocked).toEqual(expect.objectContaining({ block: true }));
    expect(event.input).toEqual(originalInput);
    expect(await readFile(target, "utf8")).toBe("Plain “prose”.\n");
  });

  it("leaves invalid edits to Pi and never evaluates paths through a shell", async () => {
    const cwd = await temporaryDirectory();
    const handler = registerGate();

    expect(
      await handler(
        toolCall("edit", {
          path: "missing.md",
          edits: [{ oldText: "x", newText: "y" }],
        }),
        context(cwd),
      ),
    ).toBeUndefined();

    expect(
      await handler(
        toolCall("write", {
          path: "draft;touch injected.md",
          content: "Plain prose.\n",
        }),
        context(cwd),
      ),
    ).toBeUndefined();
    await expect(access(join(cwd, "injected.md"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("serializes same-file calls until the earlier tool reports completion", async () => {
    const cwd = await temporaryDirectory();
    const handlers = registerHandlers();
    const gate = handlers.get("tool_call");
    const toolResult = handlers.get("tool_result");
    if (!gate || !toolResult) throw new Error("required handlers were not registered");

    expect(
      await gate(
        toolCall("write", { path: "draft.md", content: "First clean draft.\n" }, "first"),
        context(cwd),
      ),
    ).toBeUndefined();
    const blocked = await gate(
      toolCall("write", { path: "draft.md", content: "Second clean draft.\n" }, "second"),
      context(cwd),
    );
    expect(blocked).toEqual(expect.objectContaining({ block: true }));
    expect((blocked as { reason: string }).reason).toContain("serially");

    await toolResult({ type: "tool_result", toolCallId: "first" }, context(cwd));
    expect(
      await gate(
        toolCall("write", { path: "draft.md", content: "Retry clean draft.\n" }, "retry"),
        context(cwd),
      ),
    ).toBeUndefined();
  });

  it("serializes real and symlink aliases with Pi mutation-queue semantics", async () => {
    const cwd = await temporaryDirectory();
    await writeFile(join(cwd, "actual.md"), "Existing text.\n", "utf8");
    await symlink("actual.md", join(cwd, "alias.md"));
    const gate = registerHandlers().get("tool_call");
    if (!gate) throw new Error("tool_call handler was not registered");

    expect(
      await gate(
        toolCall("write", { path: "actual.md", content: "First clean draft.\n" }, "real"),
        context(cwd),
      ),
    ).toBeUndefined();
    const blocked = await gate(
      toolCall("write", { path: "alias.md", content: "Second clean draft.\n" }, "alias"),
      context(cwd),
    );

    expect(blocked).toEqual(expect.objectContaining({ block: true }));
    expect((blocked as { reason: string }).reason).toContain("serially");
  });

  it("honors the scanner directory override", async () => {
    const cwd = await temporaryDirectory();
    const scriptsDir = join(cwd, "scanners");
    await mkdir(scriptsDir);
    await writeFile(join(scriptsDir, "lint_voice.py"), "import sys\nsys.exit(1)\n", "utf8");
    const handler = registerGate({ scriptsDir });

    const result = await handler(
      toolCall("write", { path: "draft.txt", content: "plain text" }),
      context(cwd),
    );

    expect(result).toEqual(expect.objectContaining({ block: true }));
  });
});
