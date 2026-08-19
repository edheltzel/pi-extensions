# Pi Tool Pills

## Purpose

Replace built-in `ls`, `read`, `bash`, `write`, and `edit` renderers with compact pills and highlighted diffs.

## Ownership

- `src/index.ts` owns lazy registration before the first agent turn.
- `src/runtime.ts` owns the ls/read/bash wrappers.
- `src/diff-renderer.ts` owns write/edit Shiki diffs.
- `src/pill.ts` owns the inverted-color badge.
- `tests/` owns lazy-load and preview-refresh regressions.

## Local Contracts

- Keep this workspace `private: true` until npm publication is explicitly authorized.
- Do not add a third-party `git:github.com/tomsej/pi-ext` install for this extension.
- Preserve tomsej and pi-diff MIT attribution in `LICENSE` and `NOTICE`.
- Keep Shiki behind a dynamic import so startup does not load the highlighter.

## Work Guidance

- Rewrite host imports to `@earendil-works/pi-*`.
- Keep tests under `tests/` with `.unit.test.ts` suffixes.
- Run `/reload` after changing an installed local or Git copy.

## Verification

Run from the repository root:

```bash
pnpm --filter @edheltzel/pi-tool-pills test
pnpm --filter @edheltzel/pi-tool-pills tsc
pnpm run misc-checks
```

## Child DOX Index

None.

## Maintaining this file

Update this contract when tool coverage, highlighter loading, licensing, or verification changes.
