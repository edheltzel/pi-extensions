import { Socket } from "node:net";

const HERDR_SOURCE = "edheltzel:pi-better-ask-user";
const HERDR_TIMEOUT_MS = 150;
let requestSequence = 0;

export interface HerdrMetadataRequest {
  pane_id: string;
  source: string;
  tokens: { ask: string | null };
}

interface HerdrEvents {
  emit(name: string, payload: unknown): void;
}

interface HerdrEnvironment {
  HERDR_ENV?: string;
  HERDR_SOCKET_PATH?: string;
  HERDR_PANE_ID?: string;
}

type HerdrMetadataSender = (request: HerdrMetadataRequest) => Promise<void>;

interface HerdrAdapterOptions {
  env?: HerdrEnvironment;
  send?: HerdrMetadataSender;
}

interface BetterAskUserHerdrWaitLifecycle {
  finish(): Promise<void>;
}

function emitBlocked(events: HerdrEvents, active: boolean): void {
  try {
    events.emit("herdr:blocked", { active, label: "better_ask_user" });
  } catch {
    // Herdr is optional and must never affect better_ask_user.
  }
}

function sendSocketRequest(socketPath: string, request: HerdrMetadataRequest): Promise<void> {
  const id = `pi-better-ask-user-${Date.now()}-${++requestSequence}`;

  return new Promise((resolve) => {
    let client: Socket | undefined;
    let buffer = "";
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client?.destroy();
      resolve();
    };
    const timer = setTimeout(finish, HERDR_TIMEOUT_MS);

    try {
      client = new Socket();
      client.once("connect", () => {
        client?.write(
          `${JSON.stringify({ id, method: "pane.report_metadata", params: request })}\n`,
        );
      });
      client.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          try {
            const response = JSON.parse(line) as { id?: string };
            if (response.id === id) {
              finish();
              return;
            }
          } catch {
            // Ignore unrelated or malformed socket messages.
          }
        }
      });
      client.once("error", finish);
      client.once("close", finish);
      client.connect(socketPath);
    } catch {
      finish();
    }
  });
}

/**
 * Mark better_ask_user as waiting in Herdr without delaying prompt presentation.
 * The returned lifecycle serializes metadata cleanup after the initial report.
 */
export function beginBetterAskUserHerdrWait(
  events: HerdrEvents,
  options: HerdrAdapterOptions = {},
): BetterAskUserHerdrWaitLifecycle | undefined {
  const env = options.env ?? process.env;
  const socketPath = env.HERDR_SOCKET_PATH;
  const paneId = env.HERDR_PANE_ID;

  if (env.HERDR_ENV !== "1" || !socketPath || !paneId) return undefined;

  const send = options.send ?? ((request) => sendSocketRequest(socketPath, request));
  const metadata = (ask: string | null): HerdrMetadataRequest => ({
    pane_id: paneId,
    source: HERDR_SOURCE,
    tokens: { ask },
  });

  emitBlocked(events, true);
  const report = Promise.resolve()
    .then(() => send(metadata("❓1")))
    .catch(() => undefined);
  let finishPromise: Promise<void> | undefined;

  return {
    finish() {
      if (finishPromise) return finishPromise;

      emitBlocked(events, false);
      finishPromise = report.then(() => send(metadata(null))).catch(() => undefined);
      return finishPromise;
    },
  };
}
