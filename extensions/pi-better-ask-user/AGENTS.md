# Pi Better Ask User

## Purpose

Provide the `better_ask_user` tool, bundled decision-gate skill, preview workflow, and optional Herdr lifecycle integration.

## Ownership

- `src/index.ts` owns tool registration, TUI modes, preview command, rendering, and result contracts.
- `src/herdr.ts` owns bounded best-effort Herdr blocked-state and metadata communication.
- `src/single-select-layout.ts` owns searchable single-select row layout.
- `skills/` owns the mandatory decision-gate workflow.
- `tests/` owns tool, layout, preview, and Herdr regression coverage.

## Local Contracts

- Keep the public tool name `better_ask_user` and preserve structured result details.
- Ask one focused question per tool call; overlay and inline modes must remain equivalent in result semantics.
- Herdr integration must remain optional, bounded, best-effort, and inactive outside a complete Herdr environment.
- Preserve upstream attribution while maintaining Atlas-specific behavior.
- Keep this workspace `private: true` until npm publication is explicitly authorized.

## Work Guidance

- Exercise model-free workflows with the real Pi UI:

```bash
pi --no-extensions -e ./extensions/pi-better-ask-user/src/index.ts
# Then: /better-ask-preview ./extensions/pi-better-ask-user/examples/preview-questions.json
```

- Keep environment-variable, parameter, skill, and event contracts synchronized with the README and tests.

## Verification

Run from the repository root:

```bash
pnpm --filter @edheltzel/pi-better-ask-user test
pnpm --filter @edheltzel/pi-better-ask-user tsc
pnpm run misc-checks
```

## Child DOX Index

None.

## Maintaining this file

Update this contract when UI modes, public inputs/results, Herdr integration, skill behavior, or verification changes.
