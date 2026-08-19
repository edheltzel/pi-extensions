/**
 * Tool Pills Extension
 *
 * Compact colored pills for built-in tools plus Shiki diffs for write/edit.
 * Ported from tomsej/pi-ext tool-pills (MIT).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function toolPills(pi: ExtensionAPI): void {
  let loading: Promise<void> | undefined;

  pi.on("before_agent_start", async () => {
    loading ??= import("./runtime.js").then(({ default: registerToolPills }) => {
      registerToolPills(pi);
    });
    await loading;
  });
}
