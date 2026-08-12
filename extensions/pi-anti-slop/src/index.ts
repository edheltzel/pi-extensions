import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access, readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLED_SCRIPTS_DIR = join(PACKAGE_ROOT, "skills", "anti-slop", "scripts");
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_OUTPUT_BYTES = 16 * 1024;
const MARKDOWN_SUFFIXES = new Set([".md", ".markdown", ".mdown", ".mdx"]);

export interface AntiSlopExtensionOptions {
  scriptsDir?: string;
  pythonCommand?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export interface VoiceLintOptions extends AntiSlopExtensionOptions {
  content: string;
  targetPath: string;
  signal?: AbortSignal;
}

export type VoiceLintResult =
  | { status: "clean" }
  | { status: "unavailable" }
  | { status: "blocked"; reason: string };

interface ExactEdit {
  oldText: string;
  newText: string;
}

interface Match {
  newText: string;
  start: number;
  end: number;
}

interface LineSpan {
  start: number;
  end: number;
}

const UNICODE_PATH_SPACES = /[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g;

export function normalizeToolPath(path: string): string {
  let normalized = path.replace(UNICODE_PATH_SPACES, " ");
  if (normalized.startsWith("@")) normalized = normalized.slice(1);
  if (normalized === "~") return homedir();
  if (
    normalized.startsWith("~/") ||
    (process.platform === "win32" && normalized.startsWith("~\\"))
  ) {
    normalized = join(homedir(), normalized.slice(2));
  }
  if (normalized.startsWith("file://")) return fileURLToPath(normalized);
  return normalized;
}

export function resolveTargetPath(path: string, cwd: string): string {
  const normalized = normalizeToolPath(path);
  return isAbsolute(normalized) ? resolve(normalized) : resolve(cwd, normalized);
}

async function canonicalMutationPath(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code === "ENOENT" || code === "ENOTDIR") return path;
    throw error;
  }
}

function configuredScriptsDir(explicit?: string): string {
  return explicit ?? process.env.ANTI_SLOP_SCRIPTS ?? BUNDLED_SCRIPTS_DIR;
}

function countMatches(content: string, needle: string): { count: number; first: number } {
  let count = 0;
  let first = -1;
  let cursor = 0;

  while (cursor <= content.length - needle.length) {
    const index = content.indexOf(needle, cursor);
    if (index < 0) break;
    if (first < 0) first = index;
    count += 1;
    if (count > 1) break;
    cursor = index + Math.max(1, needle.length);
  }

  return { count, first };
}

function normalizeLineEndings(text: string): string {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function normalizeForFuzzyMatch(text: string): string {
  return text
    .normalize("NFKC")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
    .replace(/[\u00a0\u2002-\u200a\u202f\u205f\u3000]/g, " ");
}

function splitLinesWithEndings(content: string): string[] {
  return content.match(/[^\n]*\n|[^\n]+/g) ?? [];
}

function lineSpans(content: string): LineSpan[] {
  let offset = 0;
  return splitLinesWithEndings(content).map((line) => {
    const span = { start: offset, end: offset + line.length };
    offset = span.end;
    return span;
  });
}

function applyMatches(content: string, matches: Match[], offset = 0): string {
  let result = content;
  for (const match of [...matches].sort((left, right) => right.start - left.start)) {
    const start = match.start - offset;
    const end = match.end - offset;
    result = result.slice(0, start) + match.newText + result.slice(end);
  }
  return result;
}

function applyFuzzyMatchesPreservingLines(
  original: string,
  fuzzyBase: string,
  matches: Match[],
): string | undefined {
  const originalLines = splitLinesWithEndings(original);
  const spans = lineSpans(fuzzyBase);
  if (originalLines.length !== spans.length) return undefined;

  const groups: Array<{ startLine: number; endLine: number; matches: Match[] }> = [];
  for (const match of [...matches].sort((left, right) => left.start - right.start)) {
    const startLine = spans.findIndex(
      (span) => match.start >= span.start && match.start < span.end,
    );
    if (startLine < 0) return undefined;
    let endLine = startLine;
    while (endLine < spans.length && spans[endLine].end < match.end) endLine += 1;
    if (endLine >= spans.length) return undefined;

    const current = groups.at(-1);
    if (current && startLine < current.endLine) {
      current.endLine = Math.max(current.endLine, endLine + 1);
      current.matches.push(match);
    } else {
      groups.push({ startLine, endLine: endLine + 1, matches: [match] });
    }
  }

  let originalLine = 0;
  let result = "";
  for (const group of groups) {
    result += originalLines.slice(originalLine, group.startLine).join("");
    const start = spans[group.startLine].start;
    const end = spans[group.endLine - 1].end;
    result += applyMatches(fuzzyBase.slice(start, end), group.matches, start);
    originalLine = group.endLine;
  }
  return result + originalLines.slice(originalLine).join("");
}

function prepareEditMatches(
  normalizedContent: string,
  edits: ExactEdit[],
): { base: string; matches: Match[]; useFuzzyBase: boolean } | undefined {
  const normalizedEdits = edits.map((edit) => ({
    oldText: normalizeLineEndings(edit.oldText),
    newText: normalizeLineEndings(edit.newText),
  }));
  if (normalizedEdits.some((edit) => edit.oldText.length === 0)) return undefined;

  const useFuzzyBase = normalizedEdits.some((edit) => !normalizedContent.includes(edit.oldText));
  const base = useFuzzyBase ? normalizeForFuzzyMatch(normalizedContent) : normalizedContent;
  const uniquenessBase = normalizeForFuzzyMatch(base);
  const matches: Match[] = [];
  for (const edit of normalizedEdits) {
    const fuzzyOldText = normalizeForFuzzyMatch(edit.oldText);
    if (countMatches(uniquenessBase, fuzzyOldText).count !== 1) return undefined;

    const needle = useFuzzyBase ? fuzzyOldText : edit.oldText;
    const found = countMatches(base, needle);
    if (found.count !== 1) return undefined;
    matches.push({ newText: edit.newText, start: found.first, end: found.first + needle.length });
  }

  matches.sort((left, right) => left.start - right.start);
  const overlaps = matches.some(
    (match, index) => index > 0 && match.start < matches[index - 1].end,
  );
  return overlaps ? undefined : { base, matches, useFuzzyBase };
}

/** Apply edits with the same exact-then-fuzzy matching contract as Pi's edit tool. */
export function applyExactEdits(content: string, edits: ExactEdit[]): string | undefined {
  if (edits.length === 0) return undefined;

  const bom = content.startsWith("\ufeff") ? "\ufeff" : "";
  const withoutBom = bom ? content.slice(1) : content;
  const firstLf = withoutBom.indexOf("\n");
  const lineEnding = firstLf > 0 && withoutBom[firstLf - 1] === "\r" ? "\r\n" : "\n";
  const normalized = normalizeLineEndings(withoutBom);
  const prepared = prepareEditMatches(normalized, edits);
  if (!prepared) return undefined;

  const updated = prepared.useFuzzyBase
    ? applyFuzzyMatchesPreservingLines(normalized, prepared.base, prepared.matches)
    : applyMatches(prepared.base, prepared.matches);
  if (updated === undefined || updated === normalized) return undefined;
  const restored = lineEnding === "\r\n" ? updated.replaceAll("\n", "\r\n") : updated;
  return bom + restored;
}

function appendBounded(
  chunks: Buffer[],
  chunk: Buffer,
  state: { bytes: number; truncated: boolean },
  maxBytes: number,
): void {
  const remaining = maxBytes - state.bytes;
  if (remaining <= 0) {
    state.truncated = true;
    return;
  }

  const kept = chunk.subarray(0, remaining);
  chunks.push(kept);
  state.bytes += kept.byteLength;
  if (kept.byteLength < chunk.byteLength) state.truncated = true;
}

function formatBlockedReason(detail: string): string {
  return [
    "Anti-slop house-style gate blocked this file.",
    "This is a house style rule only, not a slop verdict and not an authorship signal.",
    detail.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatGateFailure(detail: string): string {
  return [
    "Anti-slop house-style gate could not evaluate this file.",
    "The scanner failed, so no style, slop, or authorship judgment was made.",
    detail.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function terminateProcessTree(child: ChildProcessWithoutNullStreams): void {
  child.stdin.destroy();
  child.stdout.destroy();
  child.stderr.destroy();
  if (child.pid && process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // The process may already have exited or may not own a process group.
    }
  }
  try {
    child.kill("SIGKILL");
  } catch {
    // A completed child needs no further cleanup.
  }
}

interface ScannerState {
  child: ChildProcessWithoutNullStreams;
  chunks: Buffer[];
  outputState: { bytes: number; truncated: boolean };
  signal?: AbortSignal;
  timeout?: NodeJS.Timeout;
  abortScanner: () => void;
  settled: boolean;
  resolve: (result: VoiceLintResult) => void;
}

function scannerOutput(state: ScannerState): string {
  const output = Buffer.concat(state.chunks).toString("utf8");
  return output + (state.outputState.truncated ? "\n[scanner output truncated]" : "");
}

function finishScanner(state: ScannerState, result: VoiceLintResult): void {
  if (state.settled) return;
  state.settled = true;
  if (state.timeout) clearTimeout(state.timeout);
  state.signal?.removeEventListener("abort", state.abortScanner);
  state.resolve(result);
}

function stopScanner(state: ScannerState, detail: string): void {
  if (state.settled) return;
  const output = scannerOutput(state);
  terminateProcessTree(state.child);
  finishScanner(state, {
    status: "blocked",
    reason: formatGateFailure(`${detail}${output ? `\n${output}` : ""}`),
  });
}

function scannerClosed(state: ScannerState, code: number | null): void {
  if (state.settled) return;
  if (code === 0) {
    finishScanner(state, { status: "clean" });
    return;
  }

  const output = scannerOutput(state) || "The scanner produced no output.";
  finishScanner(state, {
    status: "blocked",
    reason:
      code === 1
        ? formatBlockedReason(output)
        : formatGateFailure(`lint_voice.py failed with exit code ${code ?? "unknown"}.\n${output}`),
  });
}

function attachScannerLifecycle(
  state: ScannerState,
  timeoutMs: number,
  maxOutputBytes: number,
): void {
  state.abortScanner = () => stopScanner(state, "The scanner was cancelled before it completed.");
  state.signal?.addEventListener("abort", state.abortScanner, { once: true });
  state.timeout = setTimeout(
    () => stopScanner(state, `lint_voice.py timed out after ${timeoutMs}ms.`),
    timeoutMs,
  );
  state.timeout.unref?.();

  const capture = (chunk: Buffer) =>
    appendBounded(state.chunks, chunk, state.outputState, maxOutputBytes);
  state.child.stdout.on("data", capture);
  state.child.stderr.on("data", capture);
  state.child.on("error", (error) =>
    finishScanner(state, {
      status: "blocked",
      reason: formatGateFailure(`The local scanner could not start: ${error.message}`),
    }),
  );
  state.child.on("close", (code) => scannerClosed(state, code));
  state.child.stdin.on("error", () => {
    // The child may close stdin after a usage error. Its exit status remains authoritative.
  });
}

function executeVoiceLint(
  pythonCommand: string,
  args: string[],
  content: string,
  signal: AbortSignal | undefined,
  timeoutMs: number,
  maxOutputBytes: number,
): Promise<VoiceLintResult> {
  return new Promise((resolveResult) => {
    const child = spawn(pythonCommand, args, {
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    const state: ScannerState = {
      child,
      chunks: [],
      outputState: { bytes: 0, truncated: false },
      signal,
      abortScanner: () => undefined,
      settled: false,
      resolve: resolveResult,
    };
    attachScannerLifecycle(state, timeoutMs, maxOutputBytes);
    child.stdin.end(content);
  });
}

export async function runVoiceLint(options: VoiceLintOptions): Promise<VoiceLintResult> {
  const script = join(configuredScriptsDir(options.scriptsDir), "lint_voice.py");
  try {
    await access(script);
  } catch {
    return { status: "unavailable" };
  }
  if (options.signal?.aborted) {
    return {
      status: "blocked",
      reason: formatGateFailure("The scanner was cancelled before it could start."),
    };
  }

  const treatAs = MARKDOWN_SUFFIXES.has(extname(options.targetPath).toLowerCase())
    ? "markdown"
    : "text";
  return executeVoiceLint(
    options.pythonCommand ?? process.env.PYTHON ?? "python3",
    [script, "--stdin-name", options.targetPath, "--treat-as", treatAs],
    options.content,
    options.signal,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES,
  );
}

async function prospectiveContent(
  toolName: string,
  input: Record<string, unknown>,
  cwd: string,
): Promise<{ content: string; targetPath: string } | undefined> {
  if (typeof input.path !== "string" || input.path.length === 0) return undefined;
  let targetPath: string;
  try {
    targetPath = await canonicalMutationPath(resolveTargetPath(input.path, cwd));
  } catch {
    return undefined;
  }

  if (toolName === "write") {
    if (typeof input.content !== "string") return undefined;
    return { content: input.content, targetPath };
  }

  if (toolName !== "edit" || !Array.isArray(input.edits)) return undefined;
  const edits = input.edits.filter(
    (edit): edit is ExactEdit =>
      typeof edit === "object" &&
      edit !== null &&
      typeof (edit as Record<string, unknown>).oldText === "string" &&
      typeof (edit as Record<string, unknown>).newText === "string",
  );
  if (edits.length !== input.edits.length) return undefined;

  try {
    const current = await readFile(targetPath, "utf8");
    const content = applyExactEdits(current, edits);
    return content === undefined ? undefined : { content, targetPath };
  } catch {
    return undefined;
  }
}

export function createAntiSlopExtension(options: AntiSlopExtensionOptions = {}) {
  return function antiSlopExtension(pi: ExtensionAPI): void {
    const pendingPaths = new Set<string>();
    const pendingCalls = new Map<string, string>();
    const clearPending = (toolCallId: string) => {
      const path = pendingCalls.get(toolCallId);
      if (!path) return;
      pendingCalls.delete(toolCallId);
      pendingPaths.delete(path);
    };

    pi.on("tool_result", (event) => clearPending(event.toolCallId));
    pi.on("turn_end", () => {
      pendingCalls.clear();
      pendingPaths.clear();
    });

    pi.on("tool_call", async (event, context) => {
      if (event.toolName !== "write" && event.toolName !== "edit") return undefined;

      const candidate = await prospectiveContent(
        event.toolName,
        event.input as Record<string, unknown>,
        context.cwd,
      );
      if (!candidate) return undefined;
      if (pendingPaths.has(candidate.targetPath)) {
        return {
          block: true,
          reason: [
            "Anti-slop gates same-file tool calls serially.",
            "Retry this call after the earlier write or edit completes.",
            "No style, slop, or authorship judgment was made.",
          ].join("\n\n"),
        };
      }

      const result = await runVoiceLint({
        ...options,
        content: candidate.content,
        targetPath: candidate.targetPath,
        signal: context.signal,
      });
      if (result.status === "clean") {
        pendingPaths.add(candidate.targetPath);
        pendingCalls.set(event.toolCallId, candidate.targetPath);
        return undefined;
      }
      if (result.status === "unavailable") return undefined;

      if (context.hasUI)
        context.ui.notify("Anti-slop house-style gate blocked the file.", "warning");
      return { block: true, reason: result.reason };
    });
  };
}

export default createAntiSlopExtension();
