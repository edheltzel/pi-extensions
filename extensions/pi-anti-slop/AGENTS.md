# Pi Anti-Slop

## Purpose

Provide Pi-native substance-defect review and repair skills plus a local house-style gate without making authorship claims.

## Ownership

- `src/index.ts` owns the global pre-write and pre-edit gate.
- `skills/` owns the five Pi skills and their self-contained scanners, references, and role packets.
- `tests/` owns extension, resource, packaging, firewall, and attribution coverage.
- `LICENSE`, `LICENSE-CONTENT`, and `NOTICE` own split-license attribution.

## Local Contracts

- Never emit an authorship verdict or hard-fail on a stylistic marker alone.
- Keep severity separate from confidence and re-run deterministic scanners after repairs.
- Keep scanner execution local, argument-vector based, bounded, and free of third-party runtime dependencies.
- Skills must remain self-contained when copied into another harness skill directory.
- Preserve upstream attribution headers in all CC BY-SA reference files and mark Pi adaptations.
- Keep this workspace `private: true` until npm publication is explicitly authorized.

## Work Guidance

- Keep the Python scanners beneath `skills/anti-slop/scripts/`; `src/index.ts` resolves them from the package root.
- Keep public extension behavior covered in `tests/index.unit.test.ts` and resource contracts in `tests/resources.unit.test.ts`.
- Do not weaken the four-rule firewall while adapting prose or workflows.

## Verification

Run from the repository root:

```bash
pnpm --filter @edheltzel/pi-anti-slop test
pnpm --filter @edheltzel/pi-anti-slop tsc
pnpm run misc-checks
```

Smoke-check scanners with `python3 extensions/pi-anti-slop/skills/anti-slop/scripts/<scanner>.py --help`.

## Child DOX Index

None.

## Maintaining this file

Update this contract when firewall behavior, scanner packaging, licensing, or verification changes.
