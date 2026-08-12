# Pi Better BTW

## Purpose

Provide a temporary in-memory side conversation through Pi's native `/btw` overlay.

## Ownership

- `src/index.ts` owns the command, in-memory agent session, overlay lifecycle, rendering, and controls.
- `tests/index.unit.test.ts` owns geometry, opacity, control-placement, session, and keybinding regressions.
- `assets/` owns the user-facing screenshot.

## Local Contracts

- The side conversation must never create a persisted Pi session file.
- Closing the overlay must dispose of the temporary session; hiding it must preserve the in-memory conversation.
- Keep interactive behavior TUI-only and preserve the active model at session creation.
- Keep this workspace `private: true` until npm publication is explicitly authorized.

## Work Guidance

- Keep overlay geometry responsive and bounded by Pi's current TUI contracts.
- Update README controls whenever shortcuts or overlay actions change.
- Run `/reload` after changing an installed local or Git copy.

## Verification

Run from the repository root:

```bash
pnpm --filter @edheltzel/pi-better-btw test
pnpm --filter @edheltzel/pi-better-btw tsc
pnpm run misc-checks
```

## Child DOX Index

None.

## Maintaining this file

Update this contract when overlay lifecycle, controls, session persistence, or verification changes.
