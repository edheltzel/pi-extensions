# pi-tool-pills

Colored pill labels and collapsed output for Pi's built-in `ls`, `read`, and `bash` tools, plus Shiki-highlighted diffs for `write` and `edit`.

This workspace is an Atlas-owned port of [tomsej's tool-pills extension](https://github.com/tomsej/pi-ext/tree/main/extensions/tool-pills). Install it from this repository's Git collection, not from `git:github.com/tomsej/pi-ext`.

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
pi install ./extensions/pi-tool-pills
```

This workspace remains private and is not published to npm. Run `/reload` after installation or source changes.

## Behavior

- `ls` and `read` show an inverted-color name pill plus the path
- `bash` shows a pill and syntax-highlighted command text
- Long tool results collapse to 15 lines until expanded
- `write` and `edit` render Shiki-highlighted diffs, loaded only when highlighting is needed
- Third-party tools keep their own renderers

## Requirements

- [pi](https://github.com/earendil-works/pi) with extension support
- interactive mode for the custom tool renderers

## Development

Run from the monorepo root:

```bash
pnpm install
pnpm --filter @edheltzel/pi-tool-pills test
pnpm --filter @edheltzel/pi-tool-pills tsc
```

Run `/reload` in Pi after changing extension resources.

## License

MIT. Original work Copyright (c) 2025 tomsej. Atlas port Copyright (c) 2026 Ed Heltzel. See [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
