# My Pi setup

- I use Pi with OpenAI Codex `gpt-5.6-sol` at the High thinking level (OpenAI has a generous policy allowing you to use your own harness)
- I only use `AGENTS.md` + skills.

Pi's [philosophy](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) is to keep things simple and not overdo it with bells and whistles.

Jump to [Install all extensions](#install-all-extensions).

## Install the Git collection

The repository root loads Atlas-owned resources and the inherited Richard Gill stack as one Git package. Do not also install `npm:@richardgill/*` copies of the same extensions.

```sh
pi install git:github.com/edheltzel/pi-extensions
```

Update the unpinned Git package with `pi update git:github.com/edheltzel/pi-extensions` or update every installed extension package with `pi update --extensions`.

`background-bash` and `tmux-bash` both replace Pi's bash tool. Disable the one you do not want with `pi config`.

## Run bash commands in the background

- Overrides Pi's built-in `bash` tool with a replacement that runs commands in the background.
- Commands taking over 30 seconds move to the background by default.
- Background processes trigger an LLM turn when they complete.
- See running processes and kill them with `/proc`.

Loaded by the Git collection from [`extensions/background-bash`](./extensions/background-bash/README.md).

## Load custom `CLAUDE.md` and `.claude/skills`

- Load custom context files, such as `CLAUDE.md`, `CLAUDE.local.md`, and `AGENTS.local.md`.
- Load custom skill folders, such as `.claude/skills`.
- Traverse parent folders up to `$HOME`, loading context files and skills.

```jsonc
// ~/.pi/agent/extension-config/project-resources.jsonc
{
  "contextFilenames": ["AGENTS.local.md", "CLAUDE.local.md"],
  "contextSectionTitle": "Extra Context Files",
  "skillDirectoryPaths": [".pi/skills", ".claude/skills"]
}
```

Loaded by the Git collection from [`extensions/project-resources`](./extensions/project-resources/README.md).

## Subagents / tasks

For in-Pi subprocesses, use [`sub-pi`](./extensions/sub-pi/README.md) and [`sub-pi-skill`](./extensions/sub-pi-skill/README.md). Both load from the Git collection.

## Up arrow remembers prompts from previous sessions

Pressing the up arrow shows prompts from previous Pi sessions. Loaded by the Git collection from [`extensions/pi-up-history`](./extensions/pi-up-history/README.md).

## Load command output straight into context

Registers slash commands that run commands and put their output into Pi's context.

```jsonc
// ~/.pi/agent/extension-config/context-commands.jsonc
{
  "commands": [
    {
      "name": "diff",
      "description": "Load local changes into context",
      "command": "git",
      "commandArgs": ["diff", "HEAD"]
    },
    {
      "name": "pr-diff",
      "description": "Load PR and local changes into context",
      "command": "git",
      "commandArgs": ["diff", "--merge-base", "origin/main"]
    }
  ]
}
```

Loaded by the Git collection from [`extensions/context-commands`](./extensions/context-commands/README.md).

## Footer and project trust

- Compact footer: model, thinking level, context usage, and extension statuses
- Automatically trust every new folder

Loaded by the Git collection from [`extensions/footer`](./extensions/footer/README.md) and [`extensions/trust-all-projects`](./extensions/trust-all-projects/README.md). Do not also install `npm:@richardgill/pi-bits`.

## Install Pi Atelier

Pi Atelier is a third-party package and is not copied into this repository:

```sh
pi install npm:pi-atelier
```

Update it with `pi update npm:pi-atelier`.

[Source and documentation](https://github.com/michaelmjhhhh/pi-atelier)

## Enable Codex fast mode

Adds OpenAI Codex `/fast` mode.

```sh
pi install npm:@calesennett/pi-codex-fast
```

[Package](https://www.npmjs.com/package/@calesennett/pi-codex-fast)

## View Codex usage

Adds `/codex:status` for viewing OpenAI Codex usage information.

```sh
pi install npm:pi-codex-status
```

[Source and documentation](https://github.com/lhl/pi-codex-status)

## Install all extensions

```sh
pi install git:github.com/edheltzel/pi-extensions
pi install npm:pi-atelier
pi install npm:@calesennett/pi-codex-fast
pi install npm:pi-codex-status
```
