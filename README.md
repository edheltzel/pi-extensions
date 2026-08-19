# pi-extensions

> ### [My Setup →](./PI_SETUP.md)

This repository uses `extensions/` for owned Pi extension workspaces and `packages/` for shared libraries or composite distributions. Third-party extensions are installed through Pi package sources rather than copied into the workspace.

## Atlas Git collection

The root Pi manifest exposes these Atlas-owned private workspaces:

- [`pi-anti-slop`](./extensions/pi-anti-slop/README.md) - substance-defect review and repair skills plus a local house-style gate
- [`pi-better-ask-user`](./extensions/pi-better-ask-user/README.md) - interactive decision UI, decision-gate skill, and optional Herdr integration
- [`pi-better-btw`](./extensions/pi-better-btw/README.md) - temporary in-memory side conversation overlay
- [`pi-leader-key`](./extensions/pi-leader-key/README.md) - Ctrl+Q leader-key command palette
- [`pi-tool-pills`](./extensions/pi-tool-pills/README.md) - colored tool pills and Shiki diffs for built-in tools

The collection is a single Git-installable Pi package. The tutorial below explains how to install it, select its resources, develop against a local checkout, and publish updates.

## Installing, maintaining, and updating packages and skills

This section is a practical guide for managing Pi resources as a human. The key idea is that **a repository workspace, a Pi package, and an enabled resource are different things**:

- A **package** is an installable bundle that may contain extensions, skills, prompt templates, or themes.
- An **extension** is a TypeScript module that changes Pi's behavior by adding tools, commands, UI, or event handlers.
- A **skill** is an on-demand `SKILL.md` workflow that Pi can expose as a `/skill:<name>` command.
- A workspace in this monorepo is not automatically loaded merely because its directory exists. It must be exported by a package manifest or installed as a local package/resource.

### 1. Understand the two configuration layers

There are two separate decisions to keep straight:

1. **What this repository's Git collection provides** is defined by the root [`package.json`](./package.json), under its `pi` key:

   ```json
   {
     "pi": {
       "extensions": ["..."],
       "skills": ["..."]
     }
   }
   ```

   Only resources listed there are exported when someone installs `git:github.com/edheltzel/pi-extensions`. The presence of another workspace under `extensions/` does not add it to the collection automatically.

2. **Which package sources Pi loads globally** is defined by Pi's global `~/.pi/agent/settings.json`, under its `packages` array. On Atlas machines that file is symlinked into the Atlas Config repository, so edit the tracked Config source rather than replacing the symlink. This repository's `package.json` does not install packages by itself.

For a quick overview of the current global package sources, run:

```sh
pi list
```

### 2. Install a package

Install the Atlas collection from GitHub for normal use:

```sh
pi install git:github.com/edheltzel/pi-extensions
```

Install a package from Git:

```sh
pi install git:github.com/avhagedorn/pi-compact-transcript
```

During development, install a workspace directly from this checkout:

```sh
cd /path/to/PiExtensions
pi install .
pi install ./extensions/project-resources
pi install ./packages/pi-bits
```

Local-path packages are not copied into Pi's package cache. Pi points at the checkout, so source edits are available after `/reload`. This is the fastest way to test an extension before publishing or pushing a Git change.

By default, `pi install` changes the global package list. Use `-l` to install for only the current project instead:

```sh
pi install -l ./extensions/context-commands
```

A project-local install writes project settings under `.pi/` and may require Pi to trust that project before loading its resources. Only trust projects whose extensions and skills you intend to run.

After installing or changing package resources in an active Pi session, reload them with:

```text
/reload
```

Restart Pi if a package changes in a way that `/reload` does not pick up.

### 3. Use and manage skills

Skills bundled by an installed package are discovered automatically when that package is enabled. Use a skill explicitly with:

```text
/skill:anti-slop
```

Pi also discovers standalone skills from locations such as `~/.pi/agent/skills/`, `.pi/skills/`, and `.agents/skills/` in a trusted project. A package's `pi.skills` manifest is the right place to declare skills that should travel with that package.

Use Pi's resource configuration UI to enable or disable individual resources without removing the entire package:

```sh
pi config       # configure global resources
pi config -l    # configure project-local resources
```

This is useful when a package contains several extensions or skills but you only want some of them active.

### 4. Update installed packages

Update every unpinned installed package without updating Pi itself:

```sh
pi update --extensions
```

Update one package:

```sh
pi update git:github.com/edheltzel/pi-extensions
pi update git:github.com/avhagedorn/pi-compact-transcript
```

`pi update --all` also updates the Pi application itself. Versioned npm packages and Git packages installed with an explicit tag or commit are pinned; the general update command does not move them to a new version or ref. Install the desired new ref explicitly when you want to move a pinned package:

```sh
pi install git:github.com/edheltzel/pi-extensions@main
```

For a local-path package, updating means editing the checkout and using `/reload`; there is no remote version for Pi to download.

### 5. Remove or disable packages

Disable a package resource while keeping the package installed:

```sh
pi config
```

Remove the package source and its package-managed resources from the relevant settings scope:

```sh
pi remove git:github.com/edheltzel/pi-extensions
pi remove ./extensions/project-resources
```

Use the same `-l` flag for a project-local package when necessary:

```sh
pi remove -l ./extensions/context-commands
```

### 6. Change this repository's collection

To add or remove resources from the Atlas Git collection:

1. Edit the root [`package.json`](./package.json) `pi.extensions` or `pi.skills` arrays.
2. If a collection extension imports a runtime npm package, list it on the root `package.json` `dependencies` as well. Pi's Git install only installs that root manifest, not workspace `package.json` files.
3. If dependencies or workspace metadata changed, run `pnpm install` so [`pnpm-lock.yaml`](./pnpm-lock.yaml) stays current.
4. Run the relevant checks before sharing the change:

   ```sh
   pnpm run typecheck
   pnpm run test
   ```

5. Commit and push the repository change.
6. Update the installed Git package:

   ```sh
   pi update git:github.com/edheltzel/pi-extensions
   ```

A Pi process installed from Git uses its own checkout under `~/.pi/agent/git/`; edits in your working copy do not affect that installation until you either install the local path or commit, push, and update the Git package.

Extension-specific `config.ts` files control an extension's internal behavior. They do not decide which packages Pi installs or which workspaces the Atlas collection exports. For those decisions, use the root `package.json`, Pi's `settings.json`, and `pi config` as described above.

<details>
  <summary><strong>Resources & Inspiration for the help</strong></summary>

Below are the resources used to shape this Pi setup.

- [Pi setup guide](./PI_SETUP.md)
- [How About Pi Stuff](https://github.com/IgorWarzocha/howaboua-pi-stuff)

</details>

## Extensions (actively used)

### Repository workspaces

- [`pi-sub-pi`](./extensions/sub-pi/README.md) - Runs isolated Pi subprocesses for single, chained, or parallel tasks.
- [`pi-sub-pi-skill`](./extensions/sub-pi-skill/README.md) - Routes opted-in `/skill:` commands through the `sub-pi` tool.
- [`pi-skill-metadata-templates`](./extensions/skill-metadata-templates/README.md) - Appends templated instructions to skills based on frontmatter metadata.
- [`pi-context-commands`](./extensions/context-commands/README.md) - Registers slash commands that run commands and put the output into Pi context.
  - Example: `/diff` runs `git diff` and immediately populates context window with 0 LLM turns.
- [`pi-project-resources`](./extensions/project-resources/README.md) - Loads `AGENT.md` and `skills/` by traversing up directories from current working directory until `~`.
  - Allows you to use custom names e.g. `AGENT.local.md`, `CLAUDE.local.md` etc.
- [`pi-preset`](./extensions/preset/README.md) - Pi's preset example extension but with better config management.
- [`pi-up-history`](./extensions/pi-up-history/README.md) - Adds Up-arrow prompt history from saved sessions for the current working directory.
- [`pi-parrot`](./extensions/parrot/README.md) - Populates Pi's input box with the last assistant message.

### Private extension workspaces

These workspaces are not distributed individually. Footer and trust-all-projects are bundled by [`pi-bits`](./packages/pi-bits/README.md); thinking-toggle remains local-only.

- [`pi-footer`](./extensions/footer/README.md) - Atlas-style Pi status line.
- [`pi-trust-all-projects`](./extensions/trust-all-projects/README.md) - Automatically trusts every project.
- [`pi-thinking-toggle`](./extensions/thinking-toggle/README.md) - Cycles medium, high, and xhigh thinking levels.

### 3rd party (not mine)

- [`git:github.com/DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail) - Lazy senior-dev mode that prefers reuse, stdlib, and native features over new code.
- [`git:github.com/avhagedorn/pi-compact-transcript`](https://github.com/avhagedorn/pi-compact-transcript) - Collapses tool calls into one-line previews and adds a per-run summary.
- [`git:github.com/calesennett/pi-codex-fast`](https://github.com/calesennett/pi-codex-fast) - Adds OpenAI Codex `/fast` mode.

## Packages

- [`pi-config`](./packages/pi-config) - Loads JSONC config files with Zod defaults and templated strings.
- [`pi-zod-tool-call`](./packages/pi-zod-tool-call) - Defines Pi tool calls from Zod schemas with provider-compatible TypeBox parameters.

---

## Other extensions (not currently used)

### Repository workspaces

- [`pi-file-collector`](./extensions/file-collector/README.md) - Records files and line ranges that Pi reads, edits, writes, or cites in a JSONL file.
- [`pi-tmux-bash`](./extensions/tmux-bash/README.md) - Replaces Pi's bash tool with a tmux-backed version for background jobs and polling.

### Unpublished

These packages are intentionally local and have `private: true`.

- [`pi-bash-timeout-guard`](./extensions/bash-timeout-guard/README.md)
- [`pi-handoff`](./extensions/handoff/README.md) - Generates an editable context-transfer prompt and opens it in a new session.
- [`pi-task-context`](./extensions/task-context)

---
