import { describe, expect, it } from "vitest";

import { isReadOnlyCommand } from "../src/read-only-command";

describe("isReadOnlyCommand", () => {
  it.each([
    "pwd",
    "git status --short",
    "/bin/ls -la",
    "rg TODO src | head -20",
    "printf '%s\\n' hello",
  ])("classifies a simple read-only command: %s", (command) => {
    expect(isReadOnlyCommand(command)).toBe(true);
  });

  it.each([
    "",
    "rm -rf build",
    "cat input > output",
    "printf x >> output",
    "cat input | tee output",
    "find . -delete",
    "find . -fprintf report '%p\\n'",
    "git status && rm file",
    "git config user.name",
    "git remote set-url origin git@example.com:repo.git",
    "sed -i '' 's/a/b/' file",
    "sort -o output input",
    "awk '{ print }' input",
    "env FOO=bar rg TODO src",
    "env sh -c 'rm file'",
    "fd --exec rm {}",
    "rg --pre 'rm file' TODO src",
    "grep TODO file --exclude-from=<(rm file)",
    "echo $(rm file)",
    "echo `rm file`",
    "curl https://example.com",
    "FOO=bar rg TODO src",
    "rg 'a|b' src",
  ])("keeps potentially mutating or ambiguous output visible: %s", (command) => {
    expect(isReadOnlyCommand(command)).toBe(false);
  });
});
