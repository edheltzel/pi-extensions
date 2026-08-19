/**
 * Theme roles for thinking-level indicators.
 *
 * Vendored from tomsej/pi-ext extensions/shared/thinking-colors.ts (MIT).
 */

import type { ThemeColor } from "@earendil-works/pi-coding-agent";

export const THINKING_ROLES: Record<string, ThemeColor> = {
  off: "dim",
  minimal: "dim",
  low: "success",
  medium: "warning",
  high: "bashMode",
  xhigh: "error",
};
