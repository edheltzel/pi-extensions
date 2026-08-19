/**
 * Scoped models picker.
 *
 * Ported from tomsej/pi-ext leader-key/favourite-models.ts (MIT).
 * Entries come from Pi's enabledModels scope plus the current model registry.
 */

import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { SettingsManager } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, parseKey } from "@earendil-works/pi-tui";
import { ALL_THINKING_LEVELS } from "./model-switcher.js";
import { OverlayFrame } from "./overlay.js";
import { THINKING_ROLES } from "./thinking-colors.js";

interface FavouriteModelEntry {
  label: string;
  provider: string;
  model: string;
  thinking?: ThinkingLevel;
}

interface ModelRow {
  type: "model";
  fav: FavouriteModelEntry;
  modelIndex: number;
}

interface HeaderRow {
  type: "header";
  provider: string;
  count: number;
}

type DisplayRow = ModelRow | HeaderRow;

export function buildDisplayRows(favourites: FavouriteModelEntry[]): DisplayRow[] {
  const sorted = favourites
    .map((f, i) => ({ ...f, originalIndex: i }))
    .sort((a, b) => {
      const pc = a.provider.localeCompare(b.provider);
      if (pc !== 0) return pc;
      return a.label.localeCompare(b.label);
    });

  const rows: DisplayRow[] = [];
  let lastProvider = "";
  let providerCount = 0;
  let providerStart = 0;

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    if (item.provider !== lastProvider) {
      if (lastProvider) {
        rows[providerStart] = { type: "header", provider: lastProvider, count: providerCount };
      }
      rows.push({ type: "header", provider: item.provider, count: 0 });
      providerStart = rows.length - 1;
      providerCount = 0;
      lastProvider = item.provider;
    }
    rows.push({ type: "model", fav: item, modelIndex: item.originalIndex });
    providerCount++;
  }
  if (lastProvider) {
    rows[providerStart] = { type: "header", provider: lastProvider, count: providerCount };
  }

  return rows;
}

function nextModelRow(rows: DisplayRow[], from: number, dir: -1 | 1): number {
  let i = from + dir;
  while (i >= 0 && i < rows.length) {
    if (rows[i].type === "model") return i;
    i += dir;
  }
  return from;
}

function nthModelRow(rows: DisplayRow[], n: number): number {
  let count = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].type === "model") {
      if (count === n) return i;
      count++;
    }
  }
  return -1;
}

const THINKING_SHORTCUTS: Record<string, ThinkingLevel> = {
  o: "off",
  i: "minimal",
  l: "low",
  m: "medium",
  h: "high",
  x: "xhigh",
};

function getPrintableKey(data: string): string | null {
  const parsed = parseKey(data);
  if (parsed && parsed.length === 1 && parsed >= " " && parsed <= "~") {
    return parsed.toLowerCase();
  }
  if (data.length === 1 && data >= " " && data <= "~") {
    return data.toLowerCase();
  }
  return null;
}

function isThinkingLevel(value: string | undefined): value is ThinkingLevel {
  return !!value && ALL_THINKING_LEVELS.includes(value as ThinkingLevel);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(pattern: string): RegExp {
  return new RegExp(
    "^" + escapeRegExp(pattern).replace(/\\\*/g, ".*").replace(/\\\?/g, ".") + "$",
    "i",
  );
}

function findExactModelReferenceMatch(
  modelReference: string,
  availableModels: Model<Api>[],
): Model<Api> | undefined {
  const slashIndex = modelReference.indexOf("/");
  if (slashIndex !== -1) {
    const provider = modelReference.substring(0, slashIndex).toLowerCase();
    const modelId = modelReference.substring(slashIndex + 1).toLowerCase();
    return availableModels.find(
      (model) => model.provider.toLowerCase() === provider && model.id.toLowerCase() === modelId,
    );
  }

  const matches = availableModels.filter(
    (model) => model.id.toLowerCase() === modelReference.toLowerCase(),
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function sortAllAvailableModels(
  availableModels: Model<Api>[],
  currentModel: Model<Api> | undefined,
): Model<Api>[] {
  return [...availableModels].sort((a, b) => {
    const aIsCurrent = currentModel?.provider === a.provider && currentModel?.id === a.id;
    const bIsCurrent = currentModel?.provider === b.provider && currentModel?.id === b.id;
    if (aIsCurrent && !bIsCurrent) return -1;
    if (!aIsCurrent && bIsCurrent) return 1;

    const providerCmp = a.provider.localeCompare(b.provider);
    if (providerCmp !== 0) return providerCmp;
    return a.name.localeCompare(b.name);
  });
}

function toEntry(model: Model<Api>, thinking?: ThinkingLevel): FavouriteModelEntry {
  return {
    label: model.name,
    provider: model.provider,
    model: model.id,
    thinking,
  };
}

function loadScopedModels(ctx: ExtensionContext): FavouriteModelEntry[] {
  const settings = SettingsManager.create(ctx.cwd);
  const patterns = settings.getEnabledModels();
  const availableModels = ctx.modelRegistry.getAvailable();

  if (!patterns || patterns.length === 0) {
    return sortAllAvailableModels(availableModels, ctx.model).map((model) => toEntry(model));
  }

  const resolved: FavouriteModelEntry[] = [];
  const seen = new Set<string>();

  const pushModel = (model: Model<Api>, thinking?: ThinkingLevel) => {
    const key = `${model.provider}/${model.id}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    resolved.push(toEntry(model, thinking));
  };

  for (const rawPattern of patterns) {
    const exactFullMatch = findExactModelReferenceMatch(rawPattern, availableModels);
    if (exactFullMatch) {
      pushModel(exactFullMatch);
      continue;
    }

    let pattern = rawPattern;
    let thinking: ThinkingLevel | undefined;
    const colonIndex = rawPattern.lastIndexOf(":");
    if (colonIndex !== -1) {
      const maybeThinking = rawPattern.substring(colonIndex + 1);
      if (isThinkingLevel(maybeThinking)) {
        thinking = maybeThinking;
        pattern = rawPattern.substring(0, colonIndex);
      }
    }

    const exactMatch = findExactModelReferenceMatch(pattern, availableModels);
    if (exactMatch) {
      pushModel(exactMatch, thinking);
      continue;
    }

    const matcher = globToRegExp(pattern);
    const matchingModels = availableModels.filter((model) => {
      const fullId = `${model.provider}/${model.id}`;
      return matcher.test(fullId) || matcher.test(model.id);
    });

    for (const model of matchingModels) {
      pushModel(model, thinking);
    }
  }

  return resolved;
}

interface PickerResult {
  fav: FavouriteModelEntry;
  thinking: ThinkingLevel;
}

export async function runFavouriteModels(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  if (!ctx.hasUI) return;

  const favourites = loadScopedModels(ctx);
  if (favourites.length === 0) {
    ctx.ui.notify(
      "No scoped models available. Use /scoped-models or configure API keys",
      "warning",
    );
    return;
  }

  const currentModel = ctx.model;
  const currentThinking = pi.getThinkingLevel();

  const thinkingIndices: number[] = favourites.map((fav) => {
    const idx = fav.thinking ? ALL_THINKING_LEVELS.indexOf(fav.thinking) : -1;
    return idx >= 0 ? idx : ALL_THINKING_LEVELS.indexOf(currentThinking);
  });

  const rows = buildDisplayRows(favourites);
  const firstModelRow = rows.findIndex((r) => r.type === "model");

  const selected = await ctx.ui.custom<PickerResult | null>(
    (tui, theme, _kb, done) => {
      let highlightedIndex = firstModelRow >= 0 ? firstModelRow : 0;
      const th = theme;

      const getModelIndex = (): number => {
        const row = rows[highlightedIndex];
        return row?.type === "model" ? row.modelIndex : -1;
      };

      return {
        render: (width: number) => {
          const f = new OverlayFrame(width, th);
          const lines: string[] = [];

          lines.push(f.top());
          lines.push(f.row(th.fg("accent", th.bold("Scoped Models"))));
          lines.push(f.separator());

          let modelCounter = 0;
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            if (row.type === "header") {
              const headerText = ` ${row.provider} ${row.count > 0 ? `(${row.count})` : ""} `;
              const padded = headerText.padEnd(width - 4, "─");
              lines.push(f.row(th.fg("dim", `──${padded}`)));
              continue;
            }

            const fav = row.fav;
            const isHighlighted = i === highlightedIndex;
            const mi = row.modelIndex;

            const isCurrent =
              currentModel?.provider === fav.provider && currentModel?.id === fav.model;

            const label = isHighlighted
              ? th.fg("accent", th.bold(fav.label))
              : th.fg("text", fav.label);

            const currentBadge = isCurrent ? " " + th.fg("success", "●") : "";

            const thinking = ALL_THINKING_LEVELS[thinkingIndices[mi]];
            const thinkingRole = THINKING_ROLES[thinking] ?? "dim";
            const thinkingTag = isHighlighted
              ? th.fg("dim", "‹") + th.fg(thinkingRole, ` ${thinking} `) + th.fg("dim", "›")
              : th.fg(thinkingRole, thinking);

            const num = modelCounter < 9 ? th.fg("dim", `${modelCounter + 1}`) : th.fg("dim", "·");
            const line = `${isHighlighted ? "> " : "  "}${num} ${label}${currentBadge}  ${thinkingTag}`;
            lines.push(f.rowTruncated(line));
            modelCounter++;
          }

          lines.push(f.separator());
          lines.push(f.row(th.fg("dim", "j/k navigate | 1-9 jump | left/right cycle thinking")));
          lines.push(f.row(th.fg("dim", "o/i/l/m/h/x set thinking | enter select | esc cancel")));
          lines.push(f.bottom());

          return lines;
        },
        invalidate: () => {},
        handleInput: (data: string) => {
          if (matchesKey(data, "escape") || matchesKey(data, Key.ctrl("c"))) {
            done(null);
            return;
          }

          if (matchesKey(data, "backspace")) {
            done(null);
            return;
          }

          const key = getPrintableKey(data);

          if (matchesKey(data, "up") || matchesKey(data, Key.ctrl("p")) || key === "k") {
            highlightedIndex = nextModelRow(rows, highlightedIndex, -1);
            tui.requestRender();
            return;
          }
          if (matchesKey(data, "down") || matchesKey(data, Key.ctrl("n")) || key === "j") {
            highlightedIndex = nextModelRow(rows, highlightedIndex, 1);
            tui.requestRender();
            return;
          }

          if (matchesKey(data, "left")) {
            const mi = getModelIndex();
            if (mi >= 0) {
              thinkingIndices[mi] =
                (thinkingIndices[mi] - 1 + ALL_THINKING_LEVELS.length) % ALL_THINKING_LEVELS.length;
              tui.requestRender();
            }
            return;
          }
          if (matchesKey(data, "right")) {
            const mi = getModelIndex();
            if (mi >= 0) {
              thinkingIndices[mi] = (thinkingIndices[mi] + 1) % ALL_THINKING_LEVELS.length;
              tui.requestRender();
            }
            return;
          }

          if (key) {
            const num = parseInt(key, 10);
            const modelCount = rows.filter((r) => r.type === "model").length;
            if (num >= 1 && num <= Math.min(9, modelCount)) {
              const target = nthModelRow(rows, num - 1);
              if (target >= 0) highlightedIndex = target;
              tui.requestRender();
              return;
            }
          }

          if (key) {
            const shortcutThinking = THINKING_SHORTCUTS[key];
            if (shortcutThinking) {
              const mi = getModelIndex();
              if (mi >= 0) {
                thinkingIndices[mi] = ALL_THINKING_LEVELS.indexOf(shortcutThinking);
                tui.requestRender();
              }
              return;
            }
          }

          if (matchesKey(data, "enter")) {
            const row = rows[highlightedIndex];
            if (row?.type === "model") {
              done({
                fav: row.fav,
                thinking: ALL_THINKING_LEVELS[thinkingIndices[row.modelIndex]],
              });
            }
          }
        },
      };
    },
    {
      overlay: true,
      overlayOptions: {
        anchor: "center",
        width: 80,
        minWidth: 50,
        maxHeight: "80%",
      },
    },
  );

  if (!selected) return;

  const modelInfo = ctx.modelRegistry.find(selected.fav.provider, selected.fav.model);
  if (!modelInfo) {
    ctx.ui.notify(
      `Model ${selected.fav.provider}/${selected.fav.model} not found in registry`,
      "error",
    );
    return;
  }

  const ok = await pi.setModel(modelInfo);
  if (!ok) {
    ctx.ui.notify(
      `No API key available for ${selected.fav.provider}/${selected.fav.model}`,
      "warning",
    );
    return;
  }
  pi.setThinkingLevel(selected.thinking);

  ctx.ui.notify(`Switched to ${selected.fav.label} (thinking: ${selected.thinking})`, "info");
}
