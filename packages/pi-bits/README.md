# @edheltzel/pi-bits

A Pi package containing two independent extensions:

- [`footer`](../../extensions/footer/README.md) - Atlas-style Pi status line.
- `trust-all-projects` - Automatically trusts and remembers every project.

> [!WARNING]
> `trust-all-projects` automatically and persistently trusts every project Pi opens. This disables the project trust prompt and allows project-local instructions, configuration, and extensions to load. Install this package only if that is the behavior you want.

Build the bundle before installing it from a checkout:

```sh
pnpm run build
```

## Try without installing

```sh
pi -e ./packages/pi-bits
```

## Install

```sh
pi install ./packages/pi-bits
```

Pi loads each bundled extension separately, so each can be enabled or disabled independently with `pi config`.
