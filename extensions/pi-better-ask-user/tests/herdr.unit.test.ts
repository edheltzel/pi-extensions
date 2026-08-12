import { describe, expect, test } from "vitest";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { beginBetterAskUserHerdrWait, type HerdrMetadataRequest } from "../src/herdr";

interface WireRequest {
  id: string;
  method: string;
  params: HerdrMetadataRequest;
}

describe("Herdr adapter", () => {
  test("sends ordered report and clear requests through the real Unix socket transport", async () => {
    const socketPath = join(tmpdir(), `bau-${crypto.randomUUID().slice(0, 8)}.sock`);
    const requests: WireRequest[] = [];
    const server = createServer((socket) => {
      let buffer = "";
      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const request = JSON.parse(line) as WireRequest;
          requests.push(request);
          if (requests.length === 1) {
            socket.write(`${JSON.stringify({ id: request.id, result: {} })}\n`);
          }
        }
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(socketPath, resolve);
    });

    try {
      const lifecycle = beginBetterAskUserHerdrWait(
        { emit() {} },
        {
          env: {
            HERDR_ENV: "1",
            HERDR_SOCKET_PATH: socketPath,
            HERDR_PANE_ID: "pane-real-socket",
          },
        },
      );
      if (!lifecycle) throw new Error("expected Herdr lifecycle");

      const startedAt = performance.now();
      await lifecycle.finish();
      const elapsedMs = performance.now() - startedAt;

      expect(requests).toHaveLength(2);
      expect(requests.every(({ params }) => /^[A-Za-z0-9:._-]+$/.test(params.source))).toBe(true);
      expect(requests.map(({ method }) => method)).toEqual([
        "pane.report_metadata",
        "pane.report_metadata",
      ]);
      expect(requests.map(({ params }) => params)).toEqual([
        {
          pane_id: "pane-real-socket",
          source: "edheltzel:pi-better-ask-user",
          tokens: { ask: "❓1" },
        },
        {
          pane_id: "pane-real-socket",
          source: "edheltzel:pi-better-ask-user",
          tokens: { ask: null },
        },
      ]);
      expect(requests[0]?.id).not.toBe(requests[1]?.id);
      expect(elapsedMs).toBeLessThan(1_000);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await rm(socketPath, { force: true });
    }
  });

  test("orders metadata clear after an in-flight report", async () => {
    const requests: HerdrMetadataRequest[] = [];
    const events: Array<{ name: string; payload: unknown }> = [];
    let releaseReport: (() => void) | undefined;
    const reportPending = new Promise<void>((resolve) => {
      releaseReport = resolve;
    });

    const lifecycle = beginBetterAskUserHerdrWait(
      {
        emit(name, payload) {
          events.push({ name, payload });
        },
      },
      {
        env: {
          HERDR_ENV: "1",
          HERDR_SOCKET_PATH: "/tmp/herdr-test.sock",
          HERDR_PANE_ID: "pane-1",
        },
        send: async (request) => {
          requests.push(request);
          if (request.tokens.ask !== null) await reportPending;
        },
      },
    );

    expect(lifecycle).toBeDefined();
    expect(events).toEqual([
      { name: "herdr:blocked", payload: { active: true, label: "better_ask_user" } },
    ]);

    const cleanup = lifecycle!.finish();
    await Promise.resolve();
    expect(requests.map((request) => request.tokens.ask)).toEqual(["❓1"]);

    releaseReport?.();
    await cleanup;

    expect(requests.map((request) => request.tokens.ask)).toEqual(["❓1", null]);
    expect(requests.every((request) => request.source === "edheltzel:pi-better-ask-user")).toBe(
      true,
    );
    expect(events).toEqual([
      { name: "herdr:blocked", payload: { active: true, label: "better_ask_user" } },
      { name: "herdr:blocked", payload: { active: false, label: "better_ask_user" } },
    ]);
  });

  test("cleanup is idempotent and transport failures stay best-effort", async () => {
    const events: Array<{ name: string; payload: unknown }> = [];
    let calls = 0;
    const lifecycle = beginBetterAskUserHerdrWait(
      { emit: (name, payload) => events.push({ name, payload }) },
      {
        env: {
          HERDR_ENV: "1",
          HERDR_SOCKET_PATH: "/tmp/herdr-test.sock",
          HERDR_PANE_ID: "pane-1",
        },
        send: async () => {
          calls += 1;
          throw new Error("socket unavailable");
        },
      },
    );

    await Promise.all([lifecycle!.finish(), lifecycle!.finish()]);

    expect(calls).toBe(2);
    expect(events).toEqual([
      { name: "herdr:blocked", payload: { active: true, label: "better_ask_user" } },
      { name: "herdr:blocked", payload: { active: false, label: "better_ask_user" } },
    ]);
  });

  test("stays disabled unless every Herdr variable is present", () => {
    const events: unknown[] = [];
    const lifecycle = beginBetterAskUserHerdrWait(
      { emit: (...args) => events.push(args) },
      {
        env: { HERDR_ENV: "1", HERDR_SOCKET_PATH: "/tmp/herdr-test.sock" },
        send: async () => {
          throw new Error("must not run");
        },
      },
    );

    expect(lifecycle).toBeUndefined();
    expect(events).toEqual([]);
  });
});
