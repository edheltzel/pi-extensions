# pi-extensions

> ### [My Setup →](./PI_SETUP.md)

This repository uses `extensions/` for owned Pi extension workspaces and `packages/` for shared libraries or composite distributions. Third-party extensions are installed through Pi package sources rather than copied into the workspace.

## Git collection

The root Pi manifest loads every in-repo extension from `git:github.com/edheltzel/pi-extensions`. Atlas-owned resources and the inherited Richard Gill stack share that one Git install. Do not also install `npm:@richardgill/*` copies of the same extensions.

```sh
pi install git:github.com/edheltzel/pi-extensions
pi update git:github.com/edheltzel/pi-extensions
```

For local development, install the repository path instead. Source edits remain live and can be applied with `/reload`.

`background-bash` and `tmux-bash` both replace Pi's bash tool. After install, disable the one you do not want with `pi config`.

<details>
  <summary><strong>Resources & Inspiration for the help</strong></summary>

Below are the resources I used to get to this point in my Pi setup.

- [Richard Gill My Pi Setup](https://github.com/richardgill/pi-extensions/blob/main/PI_SETUP.md)
- [howaboua Pi Stuff](https://github.com/IgorWarzocha/howaboua-pi-stuff)

</details>

## Atlas-owned

- [`pi-anti-slop`](./extensions/pi-anti-slop/README.md) - substance-defect review and repair skills plus a local house-style gate
- [`pi-better-ask-user`](./extensions/pi-better-ask-user/README.md) - interactive decision UI, decision-gate skill, and optional Herdr integration
- [`pi-better-btw`](./extensions/pi-better-btw/README.md) - temporary in-memory side conversation overlay

## Inherited stack

- [`pi-background-bash`](./extensions/background-bash/README.md) - background bash with `/proc`
- [`pi-context-commands`](./extensions/context-commands/README.md) - slash commands that load command output into context
- [`pi-project-resources`](./extensions/project-resources/README.md) - ancestor `AGENTS.md` / skill discovery
- [`pi-up-history`](./extensions/pi-up-history/README.md) - up-arrow prompt history from saved sessions
- [`pi-sub-pi`](./extensions/sub-pi/README.md) - isolated Pi subprocesses
- [`pi-sub-pi-skill`](./extensions/sub-pi-skill/README.md) - route opted-in `/skill:` commands through `sub-pi`
- [`pi-skill-metadata-templates`](./extensions/skill-metadata-templates/README.md) - templated skill instructions from frontmatter
- [`pi-preset`](./extensions/preset/README.md) - preset example with better config management
- [`pi-parrot`](./extensions/parrot/README.md) - populate the input box with the last assistant message
- [`pi-footer`](./extensions/footer/README.md) - model, thinking, context, and extension status footer
- [`pi-trust-all-projects`](./extensions/trust-all-projects/README.md) - automatically trust every project
- [`pi-thinking-toggle`](./extensions/thinking-toggle/README.md) - cycle thinking levels
- [`pi-file-collector`](./extensions/file-collector/README.md) - record files and line ranges Pi touches
- [`pi-tmux-bash`](./extensions/tmux-bash/README.md) - tmux-backed bash replacement
- [`pi-bash-timeout-guard`](./extensions/bash-timeout-guard/README.md) - timeout prompts for bash
- [`pi-handoff`](./extensions/handoff/README.md) - editable context-transfer prompt
- [`pi-task-context`](./extensions/task-context) - task context sidecar
- [`pi-notify`](./extensions/notify/README.md) - desktop notifications
- [`pi-process-info`](./extensions/process-info/README.md) - process info overlay

## Third-party (not in this repo)

- [`npm:pi-atelier`](https://github.com/michaelmjhhhh/pi-atelier) - status rail and activity sidebar
- [`npm:@calesennett/pi-codex-fast`](https://www.npmjs.com/package/@calesennett/pi-codex-fast) - OpenAI Codex `/fast` mode
- [`npm:pi-codex-status`](https://github.com/lhl/pi-codex-status) - `/codex:status` usage info

## Packages

- [`pi-config`](./packages/pi-config) - JSONC config with Zod defaults and templated strings
- [`pi-zod-tool-call`](./packages/pi-zod-tool-call) - Pi tool calls from Zod schemas
- [`pi-bits`](./packages/pi-bits/README.md) - compiled footer + trust-all-projects bundle; Git install uses the source workspaces instead
