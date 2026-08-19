/**
 * Command-launching workflow entries for the leader palette.
 *
 * Ported from tomsej/pi-ext leader-key (MIT). The upstream Contracts picker
 * that called `wf-gate` is not included: that helper lives in tomsej/pi-ext
 * and is not vendored here.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TopLevelEntry } from "./types.js";

export function runCommand(ctx: ExtensionContext, command: string): void {
  ctx.ui.setEditorText(command);
  setTimeout(() => process.stdin.emit("data", "\r"), 0);
}

export function buildAgentsGroup(): TopLevelEntry {
  return {
    type: "group",
    group: {
      key: "a",
      label: "Agents",
      items: [
        {
          key: "s",
          label: "Subagents",
          description: "open the subagents panel",
          action: (ctx) => runCommand(ctx, "/subagents"),
        },
        {
          key: "p",
          label: "Processes",
          description: "show running processes",
          action: (ctx) => runCommand(ctx, "/ps"),
        },
      ],
    },
  };
}

export function buildTreeAction(): TopLevelEntry {
  return {
    type: "action",
    key: "t",
    label: "Tree",
    description: "open native session tree",
    action: (ctx) => runCommand(ctx, "/tree"),
  };
}

export function buildQuitAction(): TopLevelEntry {
  return {
    type: "action",
    key: "q",
    label: "Quit",
    description: "quit pi",
    action: (ctx) => ctx.shutdown(),
  };
}
