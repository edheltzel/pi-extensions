import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import {
  ORCA_ASK_USER_TOOL_NAME,
  beginBetterAskUserOrcaWait,
  buildOrcaAskUserHookRequest,
  resolveOrcaHookCoords,
  type OrcaHookRequest,
} from "../src/orca";

const QUESTION = "Which option should we use?";

function listen(handler: (request: IncomingMessage, response: ServerResponse) => void) {
  const server = createServer(handler);
  return new Promise<{ port: number; close: () => Promise<void> }>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("expected TCP address"));
        return;
      }
      resolve({
        port: address.port,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()));
          }),
      });
    });
  });
}

describe("Orca adapter", () => {
  const servers: Array<() => Promise<void>> = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((close) => close()));
  });

  test("stays disabled unless port, token, and pane key are present", () => {
    const events: unknown[] = [];
    const lifecycle = beginBetterAskUserOrcaWait(
      { emit: (...args) => events.push(args) },
      {
        env: { ORCA_AGENT_HOOK_PORT: "8787", ORCA_AGENT_HOOK_TOKEN: "token" },
        question: QUESTION,
        post: async () => {
          throw new Error("must not run");
        },
      },
    );

    expect(lifecycle).toBeUndefined();
    expect(events).toEqual([]);
  });

  test("rejects a non-numeric hook port", () => {
    expect(
      resolveOrcaHookCoords({
        ORCA_AGENT_HOOK_PORT: "abc",
        ORCA_AGENT_HOOK_TOKEN: "token",
        ORCA_PANE_KEY: "pane-1",
      }),
    ).toBeUndefined();
  });

  test("prefers live endpoint-file port and token over stale process env", async () => {
    const endpointPath = join(tmpdir(), `orca-endpoint-${crypto.randomUUID()}.env`);
    await writeFile(
      endpointPath,
      [
        "ORCA_AGENT_HOOK_PORT=9999",
        "ORCA_AGENT_HOOK_TOKEN=fresh-token",
        "ORCA_AGENT_HOOK_ENV=prod",
      ].join("\n"),
    );

    expect(
      resolveOrcaHookCoords({
        ORCA_AGENT_HOOK_ENDPOINT: endpointPath,
        ORCA_AGENT_HOOK_PORT: "1111",
        ORCA_AGENT_HOOK_TOKEN: "stale-token",
        ORCA_PANE_KEY: "pane-1",
      }),
    ).toEqual({
      port: "9999",
      token: "fresh-token",
      env: "prod",
      version: "",
    });
  });

  test("orders blocked report then clear and emits matching events", async () => {
    const requests: OrcaHookRequest[] = [];
    const events: Array<{ name: string; payload: unknown }> = [];
    let releaseReport: (() => void) | undefined;
    const reportPending = new Promise<void>((resolve) => {
      releaseReport = resolve;
    });

    const lifecycle = beginBetterAskUserOrcaWait(
      {
        emit(name, payload) {
          events.push({ name, payload });
        },
      },
      {
        env: {
          ORCA_AGENT_HOOK_PORT: "8787",
          ORCA_AGENT_HOOK_TOKEN: "token",
          ORCA_PANE_KEY: "pane-1",
          ORCA_TAB_ID: "tab-1",
          ORCA_WORKTREE_ID: "wt-1",
        },
        question: QUESTION,
        post: async (request) => {
          requests.push(request);
          if (request.payload.hook_event_name === "tool_call") await reportPending;
        },
      },
    );

    expect(lifecycle).toBeDefined();
    expect(events).toEqual([
      { name: "orca:blocked", payload: { active: true, label: "better_ask_user" } },
    ]);

    const cleanup = lifecycle!.finish();
    await Promise.resolve();
    expect(requests.map((request) => request.payload.hook_event_name)).toEqual(["tool_call"]);

    releaseReport?.();
    await cleanup;

    expect(requests.map((request) => request.payload.hook_event_name)).toEqual([
      "tool_call",
      "tool_execution_end",
    ]);
    expect(requests.every((request) => request.payload.tool_name === ORCA_ASK_USER_TOOL_NAME)).toBe(
      true,
    );
    expect(requests[0]?.payload.tool_input).toEqual({
      question: QUESTION,
      prompt: QUESTION,
      message: QUESTION,
    });
    expect(events).toEqual([
      { name: "orca:blocked", payload: { active: true, label: "better_ask_user" } },
      { name: "orca:blocked", payload: { active: false, label: "better_ask_user" } },
    ]);
  });

  test("cleanup is idempotent and transport failures stay best-effort", async () => {
    const events: Array<{ name: string; payload: unknown }> = [];
    let calls = 0;
    const lifecycle = beginBetterAskUserOrcaWait(
      { emit: (name, payload) => events.push({ name, payload }) },
      {
        env: {
          ORCA_AGENT_HOOK_PORT: "8787",
          ORCA_AGENT_HOOK_TOKEN: "token",
          ORCA_PANE_KEY: "pane-1",
        },
        question: QUESTION,
        post: async () => {
          calls += 1;
          throw new Error("hook unavailable");
        },
      },
    );

    await Promise.all([lifecycle!.finish(), lifecycle!.finish()]);

    expect(calls).toBe(2);
    expect(events).toEqual([
      { name: "orca:blocked", payload: { active: true, label: "better_ask_user" } },
      { name: "orca:blocked", payload: { active: false, label: "better_ask_user" } },
    ]);
  });

  test("posts ordered JSON hooks through the real loopback transport", async () => {
    const requests: Array<{ token: string | undefined; body: OrcaHookRequest }> = [];
    const listener = await listen((incoming, response) => {
      const chunks: Buffer[] = [];
      incoming.on("data", (chunk) => {
        chunks.push(Buffer.from(chunk));
      });
      incoming.on("end", () => {
        requests.push({
          token: incoming.headers["x-orca-agent-hook-token"] as string | undefined,
          body: JSON.parse(Buffer.concat(chunks).toString("utf8")) as OrcaHookRequest,
        });
        response.statusCode = 204;
        response.end();
      });
    });
    servers.push(listener.close);

    const env = {
      ORCA_AGENT_HOOK_PORT: String(listener.port),
      ORCA_AGENT_HOOK_TOKEN: "live-token",
      ORCA_PANE_KEY: "pane-real-http",
      ORCA_TAB_ID: "tab-real",
      ORCA_WORKTREE_ID: "wt-real",
    };
    const coords = resolveOrcaHookCoords(env);
    if (!coords) throw new Error("expected coords");

    const lifecycle = beginBetterAskUserOrcaWait({ emit() {} }, { env, question: QUESTION });
    if (!lifecycle) throw new Error("expected Orca lifecycle");

    const startedAt = performance.now();
    await lifecycle.finish();
    const elapsedMs = performance.now() - startedAt;

    expect(requests).toHaveLength(2);
    expect(requests.map(({ token }) => token)).toEqual(["live-token", "live-token"]);
    expect(requests.map(({ body }) => body.payload.hook_event_name)).toEqual([
      "tool_call",
      "tool_execution_end",
    ]);
    expect(requests[0]?.body).toEqual(
      buildOrcaAskUserHookRequest(env, coords, "tool_call", QUESTION),
    );
    expect(elapsedMs).toBeLessThan(1_000);
  });
});
