/**
 * Shared types for the leader-key extension.
 *
 * Ported from tomsej/pi-ext leader-key (MIT).
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface ActionItem {
  key: string;
  label: string;
  description?: string;
  action: (ctx: ExtensionContext) => void | Promise<void>;
}

export interface ActionGroup {
  key: string;
  label: string;
  items: ActionItem[];
}

export type TopLevelEntry =
  | { type: "group"; group: ActionGroup }
  | {
      type: "action";
      key: string;
      label: string;
      description?: string;
      action: (ctx: ExtensionContext) => void | Promise<void>;
    };
