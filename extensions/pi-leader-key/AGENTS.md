# Pi Leader Key

## Purpose

Provide a Ctrl+X / `/lk` leader-key overlay that groups frequent Pi actions, including scoped-model and model-switcher flows.

## Ownership

- `src/index.ts` owns the palette, shortcut registration, and overlay navigation.
- `src/favourite-models.ts` owns the scoped-models picker.
- `src/model-switcher.ts` owns the searchable provider/model/thinking flow.
- `src/workflow-actions.ts` owns native command-launching entries.
- `src/overlay.ts` owns the local OverlayFrame helper.
- `tests/` owns palette, overlay, and helper regressions.

## Local Contracts

- Keep this workspace `private: true` until npm publication is explicitly authorized.
- Do not add a `packages/` copy of tomsej shared code. Overlay framing stays in this workspace.
- Do not reintroduce the upstream Contracts (`wf-gate`) or Plannotator groups unless those dependencies are first-party here.
- Preserve tomsej MIT attribution in `LICENSE` and `NOTICE`.

## Work Guidance

- Rewrite host imports to `@earendil-works/pi-*`.
- Update the README palette table when chords or actions change.
- Run `/reload` after changing an installed local or Git copy.

## Verification

Run from the repository root:

```bash
pnpm --filter @edheltzel/pi-leader-key test
pnpm --filter @edheltzel/pi-leader-key tsc
pnpm run misc-checks
```

## Child DOX Index

None.

## Maintaining this file

Update this contract when palette groups, model pickers, licensing, or verification changes.
