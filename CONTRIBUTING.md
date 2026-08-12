# Contributing

`CONTRIBUTING.md` is the conventional root-level file for contributor instructions. GitHub detects this filename and links it from issue and pull request flows.

## Setup

```bash
pnpm install
```

## Local checks

Run the same checks expected before a PR:

```bash
pnpm run local-ci
```

## Changesets

Use changesets for normal package changes that should be released:

```bash
pnpm changeset
```

Then choose the changed package, select the semver bump, and write a short release note.

## Developing Git-installed packages

The supported distribution path is the Atlas Git collection. The root manifest exposes the Atlas-owned resources listed in the root README:

```bash
pi install git:github.com/edheltzel/pi-extensions
pi update git:github.com/edheltzel/pi-extensions
```

For workspaces that are not in the root collection, install the workspace directly from a checkout:

```bash
pi install ./extensions/<extension-name>
```

Run `/reload` after changing a loaded extension source file.

## Normal release flow

For packages that already exist on npm:

```bash
pnpm changeset
pnpm changeset-version
pnpm changeset-publish
```
