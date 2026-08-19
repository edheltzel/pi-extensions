import { readFileSync } from "node:fs";

export const ORCA_ASK_USER_TOOL_NAME = "AskUserQuestion";

const ORCA_HOOK_PATH = "/hook/pi";
const ORCA_HOOK_TIMEOUT_MS = 1000;
const ORCA_BLOCKED_LABEL = "better_ask_user";

export type OrcaHookEventName = "tool_call" | "tool_execution_end";

export interface OrcaAskUserToolInput {
  question: string;
  prompt: string;
  message: string;
}

export interface OrcaHookRequest {
  paneKey: string;
  launchToken: string;
  tabId: string;
  worktreeId: string;
  env: string;
  version: string;
  payload: {
    hook_event_name: OrcaHookEventName;
    tool_name: typeof ORCA_ASK_USER_TOOL_NAME;
    tool_input: OrcaAskUserToolInput;
  };
}

interface OrcaEvents {
  emit(name: string, payload: unknown): void;
}

export interface OrcaEnvironment {
  ORCA_AGENT_HOOK_PORT?: string;
  ORCA_AGENT_HOOK_TOKEN?: string;
  ORCA_PANE_KEY?: string;
  ORCA_AGENT_LAUNCH_TOKEN?: string;
  ORCA_TAB_ID?: string;
  ORCA_WORKTREE_ID?: string;
  ORCA_AGENT_HOOK_ENV?: string;
  ORCA_AGENT_HOOK_VERSION?: string;
  ORCA_AGENT_HOOK_ENDPOINT?: string;
}

type OrcaHookPoster = (request: OrcaHookRequest) => Promise<void>;

interface OrcaAdapterOptions {
  env?: OrcaEnvironment;
  post?: OrcaHookPoster;
  question?: string;
}

interface BetterAskUserOrcaWaitLifecycle {
  finish(): Promise<void>;
}

interface ResolvedHookCoords {
  port: string;
  token: string;
  env: string;
  version: string;
}

function emitBlocked(events: OrcaEvents, active: boolean): void {
  try {
    events.emit("orca:blocked", { active, label: ORCA_BLOCKED_LABEL });
  } catch {
    // Orca is optional and must never affect better_ask_user.
  }
}

function readEndpointFile(path: string | undefined): Record<string, string> {
  if (!path) return {};
  try {
    const contents = readFileSync(path, "utf8");
    const values: Record<string, string> = {};
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^(?:set\s+)?([A-Z0-9_]+)=(.*)$/);
      if (match) values[match[1]] = match[2].replace(/\r$/, "");
    }
    return values;
  } catch {
    return {};
  }
}

function firstPresent(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export function resolveOrcaHookCoords(
  env: OrcaEnvironment = process.env,
): ResolvedHookCoords | undefined {
  const fileEnv = readEndpointFile(env.ORCA_AGENT_HOOK_ENDPOINT);
  const port = firstPresent(fileEnv.ORCA_AGENT_HOOK_PORT, env.ORCA_AGENT_HOOK_PORT);
  const token = firstPresent(fileEnv.ORCA_AGENT_HOOK_TOKEN, env.ORCA_AGENT_HOOK_TOKEN);
  if (!port || !token || !/^\d+$/.test(port)) return undefined;

  return {
    port,
    token,
    env: firstPresent(fileEnv.ORCA_AGENT_HOOK_ENV, env.ORCA_AGENT_HOOK_ENV),
    version: firstPresent(fileEnv.ORCA_AGENT_HOOK_VERSION, env.ORCA_AGENT_HOOK_VERSION),
  };
}

export function buildOrcaAskUserHookRequest(
  env: OrcaEnvironment,
  coords: ResolvedHookCoords,
  eventName: OrcaHookEventName,
  question: string,
): OrcaHookRequest {
  const prompt = question.trim();
  return {
    paneKey: env.ORCA_PANE_KEY ?? "",
    launchToken: env.ORCA_AGENT_LAUNCH_TOKEN ?? "",
    tabId: env.ORCA_TAB_ID ?? "",
    worktreeId: env.ORCA_WORKTREE_ID ?? "",
    env: coords.env,
    version: coords.version,
    payload: {
      hook_event_name: eventName,
      tool_name: ORCA_ASK_USER_TOOL_NAME,
      tool_input: {
        question: prompt,
        prompt,
        message: prompt,
      },
    },
  };
}

async function postHookRequest(
  coords: ResolvedHookCoords,
  request: OrcaHookRequest,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ORCA_HOOK_TIMEOUT_MS);
  timer.unref?.();

  try {
    await fetch(`http://127.0.0.1:${coords.port}${ORCA_HOOK_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Orca-Agent-Hook-Token": coords.token,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Mark better_ask_user as waiting in Orca without delaying prompt presentation.
 * Uses Orca's Pi AskUserQuestion alias so the pane flips to blocked / Needs You.
 */
export function beginBetterAskUserOrcaWait(
  events: OrcaEvents,
  options: OrcaAdapterOptions = {},
): BetterAskUserOrcaWaitLifecycle | undefined {
  const env = options.env ?? process.env;
  const paneKey = env.ORCA_PANE_KEY?.trim();
  const coords = resolveOrcaHookCoords(env);
  if (!paneKey || !coords) return undefined;

  const post = options.post ?? ((request) => postHookRequest(coords, request));
  const question = options.question ?? "";
  const requestFor = (eventName: OrcaHookEventName) =>
    buildOrcaAskUserHookRequest(env, coords, eventName, question);

  emitBlocked(events, true);
  const report = Promise.resolve()
    .then(() => post(requestFor("tool_call")))
    .catch(() => undefined);
  let finishPromise: Promise<void> | undefined;

  return {
    finish() {
      if (finishPromise) return finishPromise;

      emitBlocked(events, false);
      finishPromise = report
        .then(() => post(requestFor("tool_execution_end")))
        .catch(() => undefined);
      return finishPromise;
    },
  };
}
