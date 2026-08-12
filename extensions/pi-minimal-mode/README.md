# pi-minimal-mode

Private Pi extension that keeps routine tool results compact while leaving mutations, errors, and potentially unsafe shell commands visible.

## Origin

Adapted from Virgil Bulens' [`minimal-mode.ts` gist](https://gist.github.com/Virgil-Bulens/4d9d747ef85709b0850fc5aa01a6a4ef), pinned at commit [`325caf9`](https://gist.github.com/Virgil-Bulens/4d9d747ef85709b0850fc5aa01a6a4ef/325caf9015a99c72b0acb5b2e587d51f72bbe164).

The adaptation uses the current `@earendil-works/*` Pi APIs and conservatively classifies shell commands before hiding their output.
No license was declared in the source gist, so this workspace stays private and is not published or added to the root Atlas collection manifest.

## Behavior

- Starts interactive sessions with tool results collapsed.
- Hides collapsed `read` output.
- Summarizes collapsed `find`, `grep`, and `ls` results by count.
- Summarizes collapsed shell output only when every simple pipeline command is on an explicit read-only allowlist.
- Always shows shell output for command chains, redirection, substitutions, background execution, unknown commands, and other potentially mutating syntax.
- Always shows `write` and `edit` results.
- Keeps full output available through Pi's tool expansion control.

This extension overrides Pi's built-in `read`, `bash`, `write`, `edit`, `find`, `grep`, and `ls` tools.
Load order matters when another extension overrides those same tools or their renderers.

## Install

From the monorepo root:

```bash
pi install ./extensions/pi-minimal-mode
```

Or test it without installing:

```bash
pi --no-extensions -e ./extensions/pi-minimal-mode/src/index.ts
```

Run `/reload` after source changes.

## Development

```bash
pnpm --filter @edheltzel/pi-minimal-mode test
pnpm --filter @edheltzel/pi-minimal-mode tsc
```
