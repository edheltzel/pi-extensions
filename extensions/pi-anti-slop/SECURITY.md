# Security policy

## Scope

Pi packages and extensions execute with the installing user's permissions. Review this package before installing it.

| Area | Risk |
|---|---|
| Global extension | Gates every Pi `write` and `edit` in every project while enabled |
| `ANTI_SLOP_SCRIPTS` | Executes Python from an operator-selected directory |
| `scan_packages.py --online` | Sends dependency names to public package registries |
| `scan_refs.py --online` | Resolves identifiers and URLs found in the scanned artifact |
| Skill actions | May direct the active agent to read files or run scanners |

The bundled scanners use the Python standard library only. The extension itself makes no network requests and sends prospective content only to a local Python child process through stdin.

## The global house-style gate

A global installation registers a Pi `tool_call` handler for `write` and `edit`. It runs `scripts/lint_voice.py` on prospective content before mutation.

- It applies in every session and repository, not only when an anti-slop skill is active.
- The global gate blocks U+2014, U+2013, and spaced double hyphens. Manual scanner runs may also supply a voice file.
- A hit is a house-style violation only. It is not a slop verdict, quality score, or authorship signal.
- A missing scanner silently disables the gate. A scanner launch error, timeout, or nonzero scanner exit blocks and returns a bounded reason.
- The handler inspects but does not mutate tool arguments.
- It launches Python with an argument vector, never a shell command.

Pi performs tool-call preflight before execution. The gate blocks a second same-file mutation until the earlier call reports completion, so parallel siblings must be retried serially. It does not provide rollback after another extension or non-Pi process mutates a file.

Use `pi config` to disable the extension while keeping the skills, or install the package project-locally with `-l` so project trust controls loading.

## Scanner override

`ANTI_SLOP_SCRIPTS` overrides the bundled scripts directory. Every Python file executed from that directory has your full user permissions. Set it only to a reviewed, trusted checkout. A missing override target fails open by design.

## Reporting a vulnerability

Open a private security advisory through the repository's GitHub Security tab. Include the command or Pi action, expected behavior, actual behavior, and a minimal reproducer.

Security-relevant defects include firewall bypasses, scanner false negatives that launder a deterministic defect, path traversal, shell injection, unbounded scanner output, and non-deterministic scanner behavior.
