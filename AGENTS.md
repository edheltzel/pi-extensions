# Pi Extensions Monorepo

## Purpose

Develop independently loadable Pi extensions and supporting packages in one pnpm workspace. The repository follows Richard Gill's `extensions/` versus `packages/` ownership model and also carries Atlas-owned extensions distributed together through the repository's root Git package.

## Ownership

- `extensions/` owns Pi extension workspaces. Public and private extensions use the same source layout; private workspaces retain `"private": true`.
- `extensions/pi-anti-slop/`, `extensions/pi-better-ask-user/`, and `extensions/pi-better-btw/` are Atlas-owned. The remaining `extensions/` workspaces are the inherited Richard Gill stack, loaded from this repo rather than `npm:@richardgill/*`.
- `packages/` owns shared libraries, utilities, and composite distributions such as `pi-bits`; it must not hold copied third-party repositories.
- Third-party Pi packages are referenced from Pi settings or setup documentation, never copied into this repository. `pi-atelier` is installed as `npm:pi-atelier`.
- Package-level `AGENTS.md` files own extension-specific behavior, licensing, and verification rules.

## Local Contracts

- Use pnpm and the pinned `packageManager` from the root manifest. Keep one root `pnpm-lock.yaml`; do not add nested dependency lockfiles.
- Keep TypeScript source under `src/` and tests under `tests/` with `.unit.test.ts`, `.integration.test.ts`, or `.e2e.test.ts` suffixes.
- Pi loads TypeScript through jiti; extension workspaces normally need no build step.
- Keep each extension independently loadable through its own `package.json` `pi` manifest.
- The root `pi` manifest is the Git collection at `git:github.com/edheltzel/pi-extensions`. It loads every `extensions/*/src/index.ts` entry plus Atlas skill folders. Do not also install `npm:@richardgill/*` copies of the same extensions.
- Atlas-owned workspaces remain private until an explicit npm publishing decision removes that safeguard and adds a release changeset.
- Preserve upstream attribution, copyright, and split-license notices in package-level license files.

## Work Guidance

- Install dependencies with `pnpm install`.
- Add runtime libraries to the owning workspace's `dependencies`; list Pi host APIs as optional peer dependencies.
- Add a changeset only for a publishable package change. Never publish or remove `private: true` from a private workspace without explicit approval.
- Run `/reload` after changing resources loaded by an installed local or Git package.
- Keep machine-specific Pi package selections in the owning Pi settings repository, not in this source workspace.

## Verification

```bash
pnpm run check
pnpm run misc-checks
pnpm run typecheck
pnpm run test
pnpm run knip
```

Use `pnpm run local-ci` for the complete sequential local gate. Tests that need the interactive Pi TUI should follow the tmux procedure documented below.

### Extension smoke tests

From the repo root:

```bash
pi --no-extensions -e ./extensions/sub-pi/src/index.ts -p "Ping"
```

Expected: `Pong. How can I help?`

Interactive tests may run Pi in a bounded tmux session, send input, capture the pane, and always clean up the session.

## Child DOX Index

- `extensions/pi-anti-slop/AGENTS.md` - anti-authorship firewall, scanner packaging, licensing, and verification.
- `extensions/pi-better-ask-user/AGENTS.md` - decision UI, preview workflow, Herdr integration, and verification.
- `extensions/pi-better-btw/AGENTS.md` - temporary side-conversation overlay behavior and verification.

## Maintaining this file

Keep this contract concise and operational. Update it when workspace ownership, Git collection contents, third-party package handling, publishing, or verification changes.
