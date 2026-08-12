import { basename } from "node:path";

const READ_ONLY_COMMANDS = new Set([
  "basename",
  "cat",
  "cut",
  "diff",
  "dirname",
  "du",
  "echo",
  "file",
  "find",
  "git",
  "grep",
  "head",
  "hexdump",
  "id",
  "jq",
  "ls",
  "md5sum",
  "od",
  "printf",
  "pwd",
  "readlink",
  "realpath",
  "rg",
  "sha1sum",
  "sha256sum",
  "stat",
  "strings",
  "tail",
  "tree",
  "tr",
  "uniq",
  "wc",
  "whoami",
]);

const AMBIGUOUS_SHELL_SYNTAX = /(?:\r|\n|;|&&|\|\||\|&|[<>]|`|\$\(|[{}]|&\s*$)/;
const MUTATING_WORDS =
  /\b(?:chmod|chown|cp|curl|dd|exec|install|kill|killall|ln|mkdir|mkfifo|mknod|mv|nc|patch|pkill|rm|rmdir|source|tee|touch|truncate|unlink|wget|xargs)\b/i;
const MUTATING_FIND_ACTIONS =
  /(?:^|\s)-(?:delete|exec|execdir|fprint|fprint0|fprintf|ok|okdir)(?:\s|$)/;
const EXECUTING_RG_OPTIONS = /(?:^|\s)--pre(?:=|\s)/;
const READ_ONLY_GIT_SUBCOMMANDS = new Set([
  "blame",
  "cat-file",
  "count-objects",
  "describe",
  "diff",
  "for-each-ref",
  "fsck",
  "grep",
  "log",
  "ls-files",
  "ls-tree",
  "name-rev",
  "rev-list",
  "rev-parse",
  "shortlog",
  "show",
  "status",
  "whatchanged",
]);

function commandName(segment: string): string | undefined {
  const token = segment.trim().split(/\s+/, 1)[0];
  return token ? basename(token) : undefined;
}

function gitSubcommand(segment: string): string | undefined {
  const tokens = segment.trim().split(/\s+/);
  let index = 1;

  while (index < tokens.length) {
    const token = tokens[index];
    if (!token) return undefined;
    if (token === "-C" || token === "-c" || token === "--git-dir" || token === "--work-tree") {
      index += 2;
      continue;
    }
    if (token.startsWith("-")) {
      index += 1;
      continue;
    }
    return token;
  }

  return undefined;
}

/**
 * Conservatively identifies commands whose output is safe to collapse.
 * Ambiguous shell syntax remains visible instead of attempting to parse Bash.
 */
export function isReadOnlyCommand(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed || AMBIGUOUS_SHELL_SYNTAX.test(trimmed) || MUTATING_WORDS.test(trimmed)) {
    return false;
  }

  const segments = trimmed.split(/\s+\|\s+/);
  if (segments.length === 1 && trimmed.includes("|")) {
    return false;
  }

  for (const segment of segments) {
    const name = commandName(segment);
    if (!name || !READ_ONLY_COMMANDS.has(name)) {
      return false;
    }

    if (name === "find" && MUTATING_FIND_ACTIONS.test(segment)) {
      return false;
    }

    if (name === "rg" && EXECUTING_RG_OPTIONS.test(segment)) {
      return false;
    }

    if (name === "git") {
      const subcommand = gitSubcommand(segment);
      if (!subcommand || !READ_ONLY_GIT_SUBCOMMANDS.has(subcommand)) {
        return false;
      }
    }
  }

  return true;
}
