import { parse, sep } from "node:path";
import { VERSION, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const SYMBOLS = {
  thinking: "⚡︎", // U+FE0E keeps text presentation instead of emoji
  pi: "π",
  contextCell: "⛁",
} as const;

export const NERD_FONT_ICONS = {
  branch: "\uF418", // nf-oct-git_branch
  cache: "\uF49B", // nf-oct-cache
} as const;

type Theme = ExtensionContext["ui"]["theme"];
type Rgb = readonly [number, number, number];

type CacheUsage = {
  input: number;
  cacheRead: number;
  cacheWrite: number;
};

type StatusPalette = {
  brand: Rgb;
  text: Rgb;
  muted: Rgb;
  separator: Rgb;
  path: Rgb;
  branch: Rgb;
  pi: Rgb;
  contextEmpty: Rgb;
  cacheIcon: Rgb;
  gradient: readonly [Rgb, Rgb, Rgb, Rgb];
  usage: readonly [Rgb, Rgb, Rgb, Rgb];
  cache: readonly [Rgb, Rgb, Rgb, Rgb, Rgb];
};

const DARK_PALETTE: StatusPalette = {
  brand: [164, 140, 242],
  text: [235, 250, 250],
  muted: [112, 129, 208],
  separator: [50, 52, 73],
  path: [4, 209, 249],
  branch: [242, 101, 181],
  pi: [232, 97, 32],
  contextEmpty: [50, 52, 73],
  cacheIcon: [164, 140, 242],
  gradient: [
    [55, 244, 153],
    [241, 252, 121],
    [247, 198, 127],
    [241, 108, 117],
  ],
  usage: [
    [55, 244, 153],
    [251, 191, 36],
    [251, 146, 60],
    [241, 108, 117],
  ],
  cache: [
    [55, 244, 153],
    [4, 209, 249],
    [241, 252, 121],
    [247, 198, 127],
    [241, 108, 117],
  ],
};

const LIGHT_PALETTE: StatusPalette = {
  brand: [144, 122, 169],
  text: [87, 82, 121],
  muted: [121, 117, 147],
  separator: [223, 218, 217],
  path: [86, 148, 159],
  branch: [215, 130, 126],
  pi: [234, 157, 52],
  contextEmpty: [223, 218, 217],
  cacheIcon: [144, 122, 169],
  gradient: [
    [40, 105, 131],
    [234, 157, 52],
    [215, 130, 126],
    [180, 99, 122],
  ],
  usage: [
    [40, 105, 131],
    [234, 157, 52],
    [215, 130, 126],
    [180, 99, 122],
  ],
  cache: [
    [40, 105, 131],
    [86, 148, 159],
    [234, 157, 52],
    [215, 130, 126],
    [180, 99, 122],
  ],
};

// Extension statuses may already carry their own ANSI colors, so labels drop
// control characters while status text keeps them (only whitespace is folded).
const sanitizeLabel = (text: string) =>
  text
    .replace(/[\r\n\t]/g, " ")
    .replace(/\p{Cc}/gu, "")
    .replace(/ +/g, " ")
    .trim();

const sanitizeStatusText = (text: string) =>
  text
    .replace(/[\r\n\t]/g, " ")
    .replace(/ +/g, " ")
    .trim();

const color = (rgb: Rgb, text: string) => `\x1b[38;2;${rgb[0]};${rgb[1]};${rgb[2]}m${text}\x1b[39m`;

const mix = (from: Rgb, to: Rgb, amount: number): Rgb => {
  const clamped = Math.max(0, Math.min(1, amount));
  return [
    Math.round(from[0] + (to[0] - from[0]) * clamped),
    Math.round(from[1] + (to[1] - from[1]) * clamped),
    Math.round(from[2] + (to[2] - from[2]) * clamped),
  ];
};

// Detect a light theme from its name; the canonical dark palette is the default.
const paletteFor = (theme: Theme): StatusPalette => {
  const themeName = theme.name?.toLowerCase() || "";
  return /light|dawn|latte/.test(themeName) ? LIGHT_PALETTE : DARK_PALETTE;
};

// Shorten the working directory to `…/<parent>/<current>` (or less when shallow).
export const formatCurrentDirectory = (cwd: string): string => {
  const safeCwd = sanitizeLabel(cwd);
  const { root } = parse(safeCwd);
  const parts = safeCwd.slice(root.length).split(sep).filter(Boolean);

  if (parts.length === 0) return root || sep;

  const tail = parts.slice(-2).join(sep);
  if (root || parts.length > 2) return `…${sep}${tail}`;
  return tail;
};

// Cache hit rate for the latest assistant prompt: cacheRead / (input + cacheRead + cacheWrite).
export const calculateCacheHitPercent = (usage: CacheUsage): number | null => {
  const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
  if (!Number.isFinite(promptTokens) || promptTokens <= 0) return null;

  const percent = (usage.cacheRead / promptTokens) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
};

// Responsive context-meter width: 24 cells at normal widths, smaller when narrow.
export const contextBarWidth = (terminalWidth: number): number => {
  if (terminalWidth < 35) return 6;
  if (terminalWidth < 55) return 8;
  if (terminalWidth < 80) return 16;
  return 24;
};

export const contextFilledCells = (percent: number, width: number): number => {
  const clamped = Math.max(0, Math.min(100, Math.floor(percent)));
  return Math.max(0, Math.min(width, Math.floor((clamped * width) / 100)));
};

// Pack status items onto as few lines as fit the width, in the given order.
export const layoutStatusItems = (
  items: string[],
  width: number,
  separator = " · ",
  ellipsis = "…",
): string[] => {
  if (width <= 0 || items.length === 0) return [];

  const lines: string[] = [];
  let line = "";

  for (const item of items) {
    const fitted = truncateToWidth(item, width, ellipsis);
    const candidate = line ? `${line}${separator}${fitted}` : fitted;
    if (!line || visibleWidth(candidate) <= width) {
      line = candidate;
    } else {
      lines.push(line);
      line = fitted;
    }
  }

  if (line) lines.push(line);
  return lines;
};

const bucketColor = (position: number, width: number, palette: StatusPalette): Rgb => {
  const percent = (position * 100) / width;
  const [low, middle, warning, high] = palette.gradient;
  if (percent <= 33) return mix(low, middle, percent / 33);
  if (percent <= 66) return mix(middle, warning, (percent - 33) / 33);
  return mix(warning, high, (percent - 66) / 34);
};

const renderContextBar = (
  percent: number | null,
  width: number,
  palette: StatusPalette,
): string => {
  const filled = percent === null ? 0 : contextFilledCells(percent, width);
  let output = "";
  for (let position = 1; position <= width; position += 1) {
    const bucket =
      position <= filled ? bucketColor(position, width, palette) : palette.contextEmpty;
    output += color(bucket, SYMBOLS.contextCell);
  }
  return output;
};

const usageColor = (percent: number, palette: StatusPalette): Rgb => {
  if (percent >= 80) return palette.usage[3];
  if (percent >= 60) return palette.usage[2];
  if (percent >= 40) return palette.usage[1];
  return palette.usage[0];
};

const cacheColor = (percent: number, palette: StatusPalette): Rgb => {
  if (percent >= 80) return palette.cache[0];
  if (percent >= 60) return palette.cache[1];
  if (percent >= 40) return palette.cache[2];
  if (percent >= 20) return palette.cache[3];
  return palette.cache[4];
};

// Cache percent from the most recent successful assistant prompt.
const latestCacheHitPercent = (ctx: ExtensionContext): number | null => {
  const entries = ctx.sessionManager.getBranch();
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.type !== "message" || entry.message.role !== "assistant") continue;
    if (entry.message.stopReason === "aborted" || entry.message.stopReason === "error") continue;

    return calculateCacheHitPercent(entry.message.usage);
  }
  return null;
};

const createCacheHitPercentReader = (ctx: ExtensionContext) => {
  let cachedLeafId: string | null | undefined;
  let cachedPercent: number | null = null;

  return {
    read() {
      const leafId = ctx.sessionManager.getLeafId();
      if (leafId !== cachedLeafId) {
        cachedPercent = latestCacheHitPercent(ctx);
        cachedLeafId = leafId;
      }
      return cachedPercent;
    },
  };
};

// Build the ordered footer items: π + version, provider/model + thinking,
// working directory, git branch, context meter, and cache hit rate.
const buildStatusItems = (
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  palette: StatusPalette,
  branch: string | null,
  terminalWidth: number,
  layoutWidth: number,
  cachePercent: number | null,
): string[] => {
  const model = ctx.model;
  const provider = sanitizeLabel(model?.provider || "no-provider");
  const modelId = sanitizeLabel(model?.id || "no-model");
  const thinking = sanitizeLabel(pi.getThinkingLevel());
  const cwd = formatCurrentDirectory(ctx.sessionManager.getCwd());
  const gitBranch = sanitizeLabel(branch || "no-git");
  const usage = ctx.getContextUsage();
  const contextPercent =
    typeof usage?.percent === "number" && Number.isFinite(usage.percent)
      ? Math.max(0, Math.min(100, Math.floor(usage.percent)))
      : null;
  const separator = color(palette.separator, "·");

  const providerModel = `${color(palette.muted, `${provider}/`)}${color(palette.brand, modelId)}`;
  const modelText = [
    providerModel,
    color(palette.path, SYMBOLS.thinking),
    color(palette.brand, thinking),
  ].join(" ");
  const contextLabel =
    contextPercent === null
      ? color(palette.muted, "n/a")
      : color(usageColor(contextPercent, palette), `${contextPercent}%`);
  const contextText = `${renderContextBar(
    contextPercent,
    contextBarWidth(terminalWidth),
    palette,
  )} ${contextLabel}`;

  const items = [
    `${color(palette.pi, SYMBOLS.pi)} ${color(palette.text, VERSION)}`,
    modelText,
    color(palette.path, cwd),
    `${color(palette.branch, NERD_FONT_ICONS.branch)} ${color(palette.branch, gitBranch)}`,
    contextText,
  ];

  if (cachePercent !== null) {
    items.push(
      `${color(palette.cacheIcon, NERD_FONT_ICONS.cache)} ${color(
        cacheColor(cachePercent, palette),
        `${cachePercent}%`,
      )}`,
    );
  }

  return layoutStatusItems(items, layoutWidth, ` ${separator} `, color(palette.muted, "…"));
};

// `codex-status` and `mcp` are suppressed entirely; every other extension status
// keeps its own ANSI styling.
const hiddenStatusKeys = new Set(["codex-status", "mcp"]);
const backgroundBashStatusKey = "backgroundBashTmuxCommands";

const formatStatus = (key: string, value: string, theme: Theme) => {
  if (key !== backgroundBashStatusKey) return sanitizeStatusText(value);

  const backgroundCount = value.replace(/ procs?$/, "");
  return `${theme.fg("dim", `${backgroundCount} `)}${theme.fg("accent", theme.bold("/proc"))}`;
};

const getStatusLine = (
  statuses: ReadonlyMap<string, string>,
  theme: Theme,
  palette: StatusPalette,
  width: number,
): string | null => {
  const rendered = Array.from(statuses.entries())
    .filter(([key, value]) => Boolean(value) && !hiddenStatusKeys.has(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => formatStatus(key, value, theme));

  if (rendered.length === 0) return null;
  return truncateToWidth(rendered.join(" "), width, color(palette.muted, "…"));
};

const horizontalPadding = 1;
const bottomPaddingLines = 1;

const padFooterLine = (line: string, width: number) => {
  const contentWidth = Math.max(0, width - horizontalPadding * 2);
  return `${" ".repeat(horizontalPadding)}${truncateToWidth(line, contentWidth)}${" ".repeat(horizontalPadding)}`;
};

export default function footer(pi: ExtensionAPI) {
  let requestRender: (() => void) | undefined;
  const refresh = () => requestRender?.();

  pi.on("turn_start", refresh);
  pi.on("message_end", refresh);
  pi.on("agent_settled", refresh);
  pi.on("session_compact", refresh);
  pi.on("session_tree", refresh);
  pi.on("model_select", refresh);
  pi.on("thinking_level_select", refresh);

  pi.on("session_start", (_event, ctx) => {
    if (ctx.mode !== "tui") return;

    ctx.ui.setFooter((tui, theme, footerData) => {
      let active = true;
      let palette = paletteFor(theme);
      const cacheReader = createCacheHitPercentReader(ctx);
      const renderNow = () => {
        if (active) tui.requestRender();
      };
      requestRender = renderNow;
      const unsubscribeBranch = footerData.onBranchChange(renderNow);

      return {
        dispose() {
          active = false;
          unsubscribeBranch();
          if (requestRender === renderNow) requestRender = undefined;
        },
        invalidate() {
          palette = paletteFor(theme);
        },
        render(width: number): string[] {
          const contentWidth = Math.max(0, width - horizontalPadding * 2);
          // The meter sizes off the raw terminal width (spec breakpoints), while
          // item packing/truncation respects the padded content width.
          const lines = buildStatusItems(
            pi,
            ctx,
            palette,
            footerData.getGitBranch(),
            width,
            contentWidth,
            cacheReader.read(),
          );

          const statusLine = getStatusLine(
            footerData.getExtensionStatuses(),
            theme,
            palette,
            contentWidth,
          );
          if (statusLine) lines.push(statusLine);

          const bottomPadding = Array.from({ length: bottomPaddingLines }, () => "");
          return [...lines.map((line) => padFooterLine(line, width)), ...bottomPadding];
        },
      };
    });
  });

  pi.on("session_shutdown", () => {
    requestRender = undefined;
  });
}
