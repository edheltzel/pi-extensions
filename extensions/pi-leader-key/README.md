# pi-leader-key

Ctrl+X leader-key command palette for [pi](https://github.com/earendil-works/pi).

Press `Ctrl+X` (or run `/lk`) to open a floating palette of grouped actions, then press a chord and an action key. The palette is an Atlas-owned port of [tomsej's leader-key extension](https://github.com/tomsej/pi-ext).

## Install

Install the Atlas extension collection from GitHub:

```bash
pi install git:github.com/edheltzel/pi-extensions
```

Pi installs a missing Git package automatically and can update the unpinned collection with:

```bash
pi update git:github.com/edheltzel/pi-extensions
```

For local development, install only this workspace from the monorepo root:

```bash
pi install ./extensions/pi-leader-key
```

This workspace remains private and is not published to npm. Run `/reload` after installation or source changes.

## Usage

- `Ctrl+X` or `/lk` opens the leader palette
- `Ctrl+M` opens the scoped-models picker directly
- Chord keys open a group; a letter key runs an action
- `Esc` / `Backspace` goes back or closes
- Arrow keys plus `Enter` highlight and select

### Palette

| Key | Action |
| --- | --- |
| `m` then `s` | Scoped models (enabledModels + registry) |
| `m` then `w` | Full provider, model, then thinking switcher |
| `m` then `t` | Thinking-level picker |
| `a` then `s` | `/subagents` |
| `a` then `p` | `/ps` |
| `t` | `/tree` |
| `q` | Quit Pi |

## Not ported

These upstream groups depend on other tomsej/pi-ext pieces that are not vendored here:

- **Contracts (`c`)**: called `wf-gate` from tomsej's workflow package
- **Plannotator (`p`)**: called `/plannotator-*` commands from tomsej's plannotator extension

## Requirements

- [pi](https://github.com/earendil-works/pi) with extension support
- interactive mode (the overlay is TUI-only)

## Development

Run from the monorepo root:

```bash
pnpm install
pnpm --filter @edheltzel/pi-leader-key test
pnpm --filter @edheltzel/pi-leader-key tsc
```

Run `/reload` in Pi after changing extension resources.

## License

MIT. Original work Copyright (c) 2025 tomsej. Atlas port Copyright (c) 2026 Ed Heltzel. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
