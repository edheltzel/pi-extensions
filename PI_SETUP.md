# My Pi setup

- Theme: Eldritch
- Default model: xAI `grok-4.6` at High thinking. I start there and switch models with `/model` as the work needs it.
- My [`AGENTS.md`](https://github.com/edheltzel/nix/blob/main/built/ai-agents/pi/AGENTS.md?plain=1) ([template](https://github.com/edheltzel/nix/blob/main/flake/modules/home-manager/dot-files/ai-agents/shared/partials/AGENTS.md.hbs?plain=1))
- My Pi [`settings.json`](https://github.com/edheltzel/nix/blob/main/out-of-store-config/ai-agents/pi/settings.json)

I only use `AGENTS.md` + skills.

Pi's [philosophy](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) is to keep things simple and not overdo it with bells and whistles.

Jump to [Install all extensions](#install-all-extensions).

The commands below assume a checkout of this repository. The Atlas Git collection provides the resources listed in the root manifest; other workspaces are installed directly from their checkout paths.

## Install the Atlas Git collection

The repository root exposes the Atlas-owned Anti-Slop, Better Ask User, Better BTW, Leader Key, and Tool Pills resources as one Git package:

```sh
pi install git:github.com/edheltzel/pi-extensions
```

Update the unpinned Git package with `pi update git:github.com/edheltzel/pi-extensions` or update every installed extension package with `pi update --extensions`.

## Load custom `CLAUDE.md` and `.claude/skills`

- Load custom context files, such as `CLAUDE.md`, `CLAUDE.local.md`, and `AGENTS.local.md`.
- Load custom skill folders, such as `.claude/skills`.
- Traverse parent folders up to `$HOME`, loading context files and skills.

```jsonc
// ~/.pi/agent/extension-config/project-resources.jsonc
{
  "contextFilenames": ["AGENTS.local.md", "CLAUDE.local.md"],
  "contextSectionTitle": "Extra Context Files",
  "skillDirectoryPaths": [".pi/skills", ".claude/skills"],
}
```

For example:

```text
~/code/
├── AGENTS.local.md
└── my-app/
    ├── CLAUDE.local.md
    ├── .pi/skills/review/SKILL.md
    └── packages/api/
        ├── AGENTS.local.md
        └── .claude/skills/database/SKILL.md
```

Starting Pi in `~/code/my-app/packages/api` loads all three instruction files and both skills.

```sh
pi install ./extensions/project-resources
```

[Source and documentation](./extensions/project-resources/README.md)

## Subagents / tasks

Pi is aware of my tmux setup and can spawn new Pi windows and worktrees using the [tmux-pi](https://github.com/edheltzel/nix/blob/main/built/ai-agents/pi/skills/tmux-pi/SKILL.md?plain=1) skill.

But if you're looking for "sub agents" directly in Pi, check out my [`sub-pi`](./extensions/sub-pi/README.md) and [`sub-pi-skill`](./extensions/sub-pi-skill/README.md) extensions which I used for a long time (be warned: it's not as polished as Claude Code or Codex).

## Use Firstmate for managed multi-agent work

If you want Pi to coordinate multiple supervised workers, use [Firstmate](https://github.com/kunchenguid/firstmate), a separate agent distro that supports Pi as a primary harness. Firstmate manages isolated worktrees, worker sessions, and task lifecycle; it is not another extension in this repository.

```sh
git clone https://github.com/kunchenguid/firstmate
cd firstmate
pi
```

Approve the project trust prompt on first launch so Pi loads Firstmate's tracked `.pi/extensions` files. See Firstmate's README and `AGENTS.md` for its supported workflow and backend setup.

## Up arrow remembers prompts from previous sessions

Pressing the up arrow shows prompts from previous Pi sessions, similar to Claude Code.

```sh
pi install ./extensions/pi-up-history
```

[Source and documentation](./extensions/pi-up-history/README.md)

## Load command output straight into context

Registers slash commands that run commands and put their output into Pi's context.

Example, `/diff` runs `git diff` and immediately populates the context window without an LLM turn.

```sh
pi install ./extensions/context-commands
```

```jsonc
// ~/.pi/agent/extension-config/context-commands.jsonc
{
  "commands": [
    {
      "name": "diff",
      "description": "Load local changes into context",
      "command": "git",
      "commandArgs": ["diff", "HEAD"],
    },
    {
      "name": "pr-diff",
      "description": "Load PR and local changes into context",
      "command": "git",
      "commandArgs": ["diff", "--merge-base", "origin/main"],
    },
  ],
}
```

[Source and documentation](./extensions/context-commands/README.md)

## `pi-bits`: the rest of my personal setup

- The [`pi-footer`](./extensions/footer/README.md) Atlas-style status line.
- Automatically trust every new folder - bypassing Pi's project trust prompt.

```sh
pi install ./packages/pi-bits
```

[Source and documentation](./packages/pi-bits/README.md)

## Install Ponytail

Ponytail is a third-party package and is not copied into this repository:

```sh
pi install git:github.com/DietrichGebert/ponytail
```

Update it with `pi update git:github.com/DietrichGebert/ponytail`.

[Source and documentation](https://github.com/DietrichGebert/ponytail)

## Install compact transcript

Compact transcript is a third-party package and is not copied into this repository:

```sh
pi install git:github.com/avhagedorn/pi-compact-transcript
```

Update it with `pi update git:github.com/avhagedorn/pi-compact-transcript`.

[Source and documentation](https://github.com/avhagedorn/pi-compact-transcript)

## Enable Codex fast mode

Adds OpenAI Codex `/fast` mode.

```sh
pi install git:github.com/calesennett/pi-codex-fast
```

[Source and documentation](https://github.com/calesennett/pi-codex-fast)

## Currently installed npm packages

These are live on this machine and are not copied into this repository:

- `npm:pi-mcp-adapter` - MCP adapter for Pi
- `npm:pi-web-access` - web search, URL fetch, GitHub clone, PDF and video analysis
- `npm:@devkade/pi-plan` - read-only plan mode with approval-based execution
- `npm:pi-simplify` - review recent diffs for clarity and maintainability
- `npm:pi-add-dir` - add external directories and their agent context files
- `npm:pi-prompt-template-model` - prompt-template model selector
- `npm:@narumitw/pi-goal` - autonomous `/goal` completion
- `npm:@tintinweb/pi-subagents` - Claude Code-style autonomous sub-agents
- `npm:pi-lens` - live LSP, lint, format, and structural feedback
- `npm:@vndv/pi-codegraph` - CodeGraph tools for Pi
- `npm:pi-unified-exec` - long-lived shell sessions with `write_stdin`
- `npm:@ogulcancelik/pi-codex-compaction` - Codex remote compaction
- `npm:@calesennett/pi-codex-fast` - Codex Fast and Ultrafast tiers
- `npm:@plannotator/pi-extension` - interactive plan and PR annotation

## Install all extensions

```sh
pi install git:github.com/edheltzel/pi-extensions
pi install git:github.com/DietrichGebert/ponytail
pi install git:github.com/avhagedorn/pi-compact-transcript
pi install ./packages/pi-bits
pi install ./extensions/context-commands
pi install ./extensions/project-resources
pi install ./extensions/pi-up-history
pi install git:github.com/calesennett/pi-codex-fast
```
