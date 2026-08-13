import {
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWriteTool,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { homedir } from "node:os";

// Adapted from Virgil Bulens' minimal-mode gist:
// https://gist.github.com/Virgil-Bulens/4d9d747ef85709b0850fc5aa01a6a4ef

function shortenPath(path: string): string {
  const home = homedir();
  return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
}

function textOutput(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content.find((content) => content.type === "text")?.text ?? "";
}

function countLines(output: string): number {
  return output.trim().split("\n").filter(Boolean).length;
}

function renderOutput(
  output: string,
  theme: { fg: (color: "error" | "toolOutput", text: string) => string },
  isError = false,
) {
  const trimmed = output.trim();
  if (!trimmed) return new Text("", 0, 0);

  const color = isError ? "error" : "toolOutput";
  return new Text(
    `\n${trimmed
      .split("\n")
      .map((line) => theme.fg(color, line))
      .join("\n")}`,
    0,
    0,
  );
}

const toolCache = new Map<string, ReturnType<typeof createBuiltInTools>>();

function createBuiltInTools(cwd: string) {
  return {
    read: createReadTool(cwd),
    edit: createEditTool(cwd),
    write: createWriteTool(cwd),
    find: createFindTool(cwd),
    grep: createGrepTool(cwd),
    ls: createLsTool(cwd),
  };
}

function getBuiltInTools(cwd: string) {
  const cached = toolCache.get(cwd);
  if (cached) return cached;

  const tools = createBuiltInTools(cwd);
  toolCache.set(cwd, tools);
  return tools;
}

export default function minimalMode(pi: ExtensionAPI) {
  const initialTools = getBuiltInTools(process.cwd());

  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    ctx.ui.setToolsExpanded(false);
    ctx.ui.setStatus("minimal-mode", ctx.ui.theme.fg("dim", "minimal tools"));
  });

  pi.registerTool({
    ...initialTools.read,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getBuiltInTools(ctx.cwd).read.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme) {
      const path = shortenPath(args.path || "");
      let display = path ? theme.fg("accent", path) : theme.fg("toolOutput", "...");
      if (args.offset !== undefined || args.limit !== undefined) {
        const start = args.offset ?? 1;
        const end = args.limit === undefined ? "" : start + args.limit - 1;
        display += theme.fg("warning", `:${start}${end ? `-${end}` : ""}`);
      }
      return new Text(`${theme.fg("toolTitle", theme.bold("read"))} ${display}`, 0, 0);
    },
    renderResult(result, options, theme, context) {
      if (!options.expanded && !context.isError) return new Text("", 0, 0);
      return renderOutput(textOutput(result), theme, context.isError);
    },
  });

  pi.registerTool({
    ...initialTools.write,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getBuiltInTools(ctx.cwd).write.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme) {
      const path = shortenPath(args.path || "");
      const display = path ? theme.fg("accent", path) : theme.fg("toolOutput", "...");
      const lines = args.content ? args.content.split("\n").length : 0;
      const suffix = lines > 0 ? theme.fg("muted", ` (${lines} lines)`) : "";
      return new Text(`${theme.fg("toolTitle", theme.bold("write"))} ${display}${suffix}`, 0, 0);
    },
    renderResult(result, _options, theme, context) {
      return renderOutput(textOutput(result), theme, context.isError);
    },
  });

  pi.registerTool({
    ...initialTools.edit,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getBuiltInTools(ctx.cwd).edit.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme) {
      const path = shortenPath(args.path || "");
      const display = path ? theme.fg("accent", path) : theme.fg("toolOutput", "...");
      return new Text(`${theme.fg("toolTitle", theme.bold("edit"))} ${display}`, 0, 0);
    },
    renderResult(result, _options, theme, context) {
      return renderOutput(textOutput(result), theme, context.isError);
    },
  });

  pi.registerTool({
    ...initialTools.find,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getBuiltInTools(ctx.cwd).find.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme) {
      const path = shortenPath(args.path || ".");
      return new Text(
        `${theme.fg("toolTitle", theme.bold("find"))} ${theme.fg("accent", args.pattern || "")} ${theme.fg("toolOutput", `in ${path}`)}`,
        0,
        0,
      );
    },
    renderResult(result, options, theme, context) {
      const output = textOutput(result);
      if (options.expanded || context.isError) {
        return renderOutput(output, theme, context.isError);
      }
      const count = countLines(output);
      return count > 0
        ? new Text(theme.fg("muted", ` → ${count} files`), 0, 0)
        : new Text("", 0, 0);
    },
  });

  pi.registerTool({
    ...initialTools.grep,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getBuiltInTools(ctx.cwd).grep.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme) {
      const path = shortenPath(args.path || ".");
      return new Text(
        `${theme.fg("toolTitle", theme.bold("grep"))} ${theme.fg("accent", `/${args.pattern || ""}/`)} ${theme.fg("toolOutput", `in ${path}`)}`,
        0,
        0,
      );
    },
    renderResult(result, options, theme, context) {
      const output = textOutput(result);
      if (options.expanded || context.isError) {
        return renderOutput(output, theme, context.isError);
      }
      const count = countLines(output);
      return count > 0
        ? new Text(theme.fg("muted", ` → ${count} matches`), 0, 0)
        : new Text("", 0, 0);
    },
  });

  pi.registerTool({
    ...initialTools.ls,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return getBuiltInTools(ctx.cwd).ls.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme) {
      const path = shortenPath(args.path || ".");
      return new Text(
        `${theme.fg("toolTitle", theme.bold("ls"))} ${theme.fg("accent", path)}`,
        0,
        0,
      );
    },
    renderResult(result, options, theme, context) {
      const output = textOutput(result);
      if (options.expanded || context.isError) {
        return renderOutput(output, theme, context.isError);
      }
      const count = countLines(output);
      return count > 0
        ? new Text(theme.fg("muted", ` → ${count} entries`), 0, 0)
        : new Text("", 0, 0);
    },
  });
}
