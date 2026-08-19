/**
 * Multi-step model selector with searchable lists.
 *
 * Ported from tomsej/pi-ext leader-key/model-switcher.ts (MIT).
 */

import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { SettingsManager } from "@earendil-works/pi-coding-agent";
import { fuzzyFilter, Key, matchesKey } from "@earendil-works/pi-tui";
import { OverlayFrame } from "./overlay.js";

export const ALL_THINKING_LEVELS: ThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

interface ProviderInfo {
  name: string;
  modelCount: number;
}

function getEnabledModelSet(cwd: string): Set<string> | undefined {
  const sm = SettingsManager.create(cwd);
  const patterns = sm.getEnabledModels();
  if (!patterns || patterns.length === 0) return undefined;
  return new Set(patterns.map((p) => p.toLowerCase()));
}

export function isModelEnabled(
  provider: string,
  modelId: string,
  enabled: Set<string> | undefined,
): boolean {
  if (!enabled) return true;
  const key = `${provider}/${modelId}`.toLowerCase();
  if (enabled.has(key)) return true;
  for (const pattern of enabled) {
    if (pattern.includes("*") || pattern.includes("?")) {
      const regex = new RegExp(
        "^" +
          pattern
            .replace(/[.+^${}()|[\]\\]/g, "\\$&")
            .replace(/\*/g, ".*")
            .replace(/\?/g, ".") +
          "$",
      );
      if (regex.test(key)) return true;
    }
  }
  return false;
}

function getAvailableEnabledModels(ctx: ExtensionContext): Model<Api>[] {
  const enabled = getEnabledModelSet(ctx.cwd);
  return ctx.modelRegistry.getAvailable().filter((m) => isModelEnabled(m.provider, m.id, enabled));
}

function getProviders(ctx: ExtensionContext): ProviderInfo[] {
  const models = getAvailableEnabledModels(ctx);
  const providerMap = new Map<string, number>();

  for (const model of models) {
    providerMap.set(model.provider, (providerMap.get(model.provider) ?? 0) + 1);
  }

  return Array.from(providerMap.entries())
    .map(([name, count]) => ({ name, modelCount: count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getModelsForProvider(ctx: ExtensionContext, provider: string): Model<Api>[] {
  return getAvailableEnabledModels(ctx)
    .filter((m) => m.provider === provider)
    .sort((a, b) => a.name.localeCompare(b.name));
}

interface SearchableItem {
  value: string;
  label: string;
  description?: string;
}

const MAX_VISIBLE = 15;

async function searchableSelect<T extends string>(
  ctx: ExtensionContext,
  title: string,
  items: SearchableItem[],
  helpText?: string,
  defaultValue?: string,
): Promise<T | null> {
  const defaultIndex = defaultValue ? items.findIndex((i) => i.value === defaultValue) : -1;
  return ctx.ui.custom<T | null>(
    (tui, theme, _kb, done) => {
      let searchText = "";
      let filteredItems = [...items];
      let highlightedIndex = defaultIndex >= 0 ? defaultIndex : 0;
      let scrollOffset = 0;

      const th = theme;

      const applyFilter = () => {
        if (searchText === "") {
          filteredItems = [...items];
        } else {
          filteredItems = fuzzyFilter(items, searchText, (item) => `${item.label} ${item.value}`);
        }
        highlightedIndex = 0;
        scrollOffset = 0;
      };

      const ensureVisible = () => {
        if (highlightedIndex < scrollOffset) {
          scrollOffset = highlightedIndex;
        } else if (highlightedIndex >= scrollOffset + MAX_VISIBLE) {
          scrollOffset = highlightedIndex - MAX_VISIBLE + 1;
        }
      };

      return {
        render: (width: number) => {
          const f = new OverlayFrame(width, th);
          const lines: string[] = [];

          lines.push(f.top());
          lines.push(f.row(th.fg("accent", th.bold(title))));

          if (searchText.length > 0) {
            lines.push(
              f.row(th.fg("muted", "search: ") + th.fg("accent", searchText) + th.fg("dim", "▏")),
            );
          }

          lines.push(f.separator());

          if (filteredItems.length === 0) {
            lines.push(f.row(th.fg("warning", "  no matches")));
          } else {
            const visibleEnd = Math.min(scrollOffset + MAX_VISIBLE, filteredItems.length);

            if (scrollOffset > 0) {
              lines.push(f.row(th.fg("dim", `  ↑ ${scrollOffset} more`)));
            }

            for (let i = scrollOffset; i < visibleEnd; i++) {
              const item = filteredItems[i];
              const isHighlighted = i === highlightedIndex;

              const label = isHighlighted
                ? th.fg("accent", th.bold(item.label))
                : th.fg("text", item.label);

              let line = `${isHighlighted ? "> " : "  "}${label}`;

              if (item.description) {
                line += "  " + th.fg("dim", item.description);
              }

              lines.push(f.rowTruncated(line));
            }

            const remaining = filteredItems.length - visibleEnd;
            if (remaining > 0) {
              lines.push(f.row(th.fg("dim", `  ↓ ${remaining} more`)));
            }
          }

          lines.push(f.separator());
          const hint = helpText ?? "type to search • ↑↓ navigate • enter select • esc cancel";
          lines.push(f.row(th.fg("dim", hint)));
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
            if (searchText.length > 0) {
              searchText = searchText.slice(0, -1);
              applyFilter();
              tui.requestRender();
            }
            return;
          }

          if (matchesKey(data, "up") || matchesKey(data, Key.ctrl("p"))) {
            highlightedIndex = Math.max(0, highlightedIndex - 1);
            ensureVisible();
            tui.requestRender();
            return;
          }
          if (matchesKey(data, "down") || matchesKey(data, Key.ctrl("n"))) {
            highlightedIndex = Math.min(filteredItems.length - 1, highlightedIndex + 1);
            ensureVisible();
            tui.requestRender();
            return;
          }

          if (matchesKey(data, "enter")) {
            if (filteredItems.length > 0 && highlightedIndex < filteredItems.length) {
              done(filteredItems[highlightedIndex].value as T);
            }
            return;
          }

          if (data.length === 1 && data >= " " && data <= "~") {
            searchText += data;
            applyFilter();
            tui.requestRender();
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
}

export async function runModelSwitcher(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  if (!ctx.hasUI) return;

  const providers = getProviders(ctx);
  if (providers.length === 0) {
    ctx.ui.notify("No providers available", "warning");
    return;
  }

  const currentProvider = ctx.model?.provider;

  const providerItems: SearchableItem[] = providers.map((p) => {
    const isCurrent = p.name === currentProvider;
    const badge = isCurrent ? " (current)" : "";
    return {
      value: p.name,
      label: `${p.name}${badge}`,
      description: `${p.modelCount} model${p.modelCount !== 1 ? "s" : ""}`,
    };
  });

  const selectedProvider = await searchableSelect<string>(ctx, "Select Provider", providerItems);
  if (!selectedProvider) return;

  const models = getModelsForProvider(ctx, selectedProvider);
  if (models.length === 0) {
    ctx.ui.notify(`No models found for provider "${selectedProvider}"`, "warning");
    return;
  }

  const currentModelId = ctx.model?.id;

  const modelItems: SearchableItem[] = models.map((model) => {
    const isCurrent = model.provider === currentProvider && model.id === currentModelId;
    const badge = isCurrent ? " (current)" : "";
    const features: string[] = [];
    if (model.reasoning) features.push("reasoning");
    if (model.input.includes("image")) features.push("vision");
    const desc = features.length > 0 ? features.join(", ") : "";

    return {
      value: model.id,
      label: `${model.name}${badge}`,
      description: desc,
    };
  });

  const selectedModelId = await searchableSelect<string>(
    ctx,
    `Select Model (${selectedProvider})`,
    modelItems,
  );
  if (!selectedModelId) return;

  const selectedModel = ctx.modelRegistry.find(selectedProvider, selectedModelId);
  if (!selectedModel) {
    ctx.ui.notify(`Model ${selectedProvider}/${selectedModelId} not found`, "error");
    return;
  }

  const supportsReasoning = selectedModel.reasoning;
  let selectedThinking: ThinkingLevel = pi.getThinkingLevel();

  if (supportsReasoning) {
    const currentThinking = pi.getThinkingLevel();

    const thinkingItems: SearchableItem[] = ALL_THINKING_LEVELS.map((level) => {
      const isCurrent = level === currentThinking;
      return {
        value: level,
        label: isCurrent ? `${level} (current)` : level,
        description: getThinkingDescription(level),
      };
    });

    const thinkingChoice = await searchableSelect<ThinkingLevel>(
      ctx,
      `Thinking Level (${selectedModel.name})`,
      thinkingItems,
      "type to search • ↑↓ navigate • enter select • esc cancel",
    );

    if (!thinkingChoice) return;
    selectedThinking = thinkingChoice;
  }

  const ok = await pi.setModel(selectedModel);
  if (!ok) {
    ctx.ui.notify(`No API key available for ${selectedProvider}/${selectedModelId}`, "warning");
    return;
  }

  if (supportsReasoning) {
    pi.setThinkingLevel(selectedThinking);
  }

  ctx.ui.notify(
    `Switched to ${selectedModel.name}${supportsReasoning ? ` (thinking: ${selectedThinking})` : ""}`,
    "info",
  );
}

export function getThinkingDescription(level: ThinkingLevel): string {
  switch (level) {
    case "off":
      return "No extended thinking";
    case "minimal":
      return "Minimal reasoning effort";
    case "low":
      return "Low reasoning effort";
    case "medium":
      return "Moderate reasoning effort";
    case "high":
      return "High reasoning effort";
    case "xhigh":
      return "Maximum reasoning effort";
    default:
      return "";
  }
}

export async function runThinkingPicker(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  if (!ctx.hasUI) return;

  const currentThinking = pi.getThinkingLevel();

  const thinkingItems: SearchableItem[] = ALL_THINKING_LEVELS.map((level) => {
    const isCurrent = level === currentThinking;
    return {
      value: level,
      label: isCurrent ? `${level} (current)` : level,
      description: getThinkingDescription(level),
    };
  });

  const choice = await searchableSelect<ThinkingLevel>(ctx, "Select Thinking Level", thinkingItems);

  if (!choice) return;

  pi.setThinkingLevel(choice);
  ctx.ui.notify(`Thinking: ${choice}`, "info");
}
