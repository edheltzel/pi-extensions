# pi-anti-slop

Native Pi port of [AgriciDaniel/anti-slop](https://github.com/AgriciDaniel/anti-slop). It finds and repairs substance defects in prose, code, documentation, commit messages, pull request descriptions, and agent output.

**It reports defects. It never reports authorship.**

## What is included

- One Pi extension that runs the house-style linter before every Pi `write` and valid `edit`.
- Five Pi skills: `anti-slop`, `slop-review`, `slop-rewrite`, `slop-code`, and `slop-verify`.
- Six deterministic Layer 0 scanners plus their shared Python helper.
- Six structural-test and evidence references.
- Two optional role packets for separate grader and verifier passes. They are references, not native Pi agents.

The scanners use Python's standard library only. The extension makes no network request. `scan_refs.py --online` and `scan_packages.py --online` perform network checks only when a skill or user explicitly runs them.

## Firewall

1. Never emit an authorship verdict. Report defects, not origin.
2. Never hard-fail on a stylistic marker alone. A marker only routes a span to a structural test.
3. Severity is impact. Confidence is certainty. Keep them separate.
4. Never let the model gate its own rewrite. Re-run deterministic scanners after repairs.

## Install

Install the Atlas extension collection directly from GitHub:

```bash
pi install git:github.com/edheltzel/pi-extensions
```

Pi installs missing Git packages into its managed package directory. Update the collection with:

```bash
pi update git:github.com/edheltzel/pi-extensions
```

For local development, install only this workspace from the monorepo root:

```bash
pi install ./extensions/pi-anti-slop
```

Use `-l` for a trusted project-local installation. Run `/reload` after installation or source changes.

## Global gate behavior

A global install activates `src/index.ts` in every Pi project. Before each `write` or valid Pi `edit` (including Pi's fuzzy text matching), it constructs the prospective file content and runs:

```bash
python3 skills/anti-slop/scripts/lint_voice.py --stdin-name <path> --treat-as <markdown-or-text>
```

The gate blocks the bundled default house-style findings: U+2014, U+2013, and spaced double hyphens. `lint_voice.py` also supports an explicit `--voice` file when run manually. A hit is a house-style violation only. It is not a slop verdict, a quality score, or authorship evidence.

The Pi port checks prospective content in `tool_call`, before mutation. The original Claude hook checked the file after mutation. To keep prospective state sound, a second same-file call is blocked until the earlier write or edit reports completion; retry that call separately.

Missing `lint_voice.py` fails open so unrelated work is not blocked by an absent optional gate. A Python launch error, timeout, or scanner usage error blocks loudly.

See [SECURITY.md](SECURITY.md) before enabling the extension globally. Use `pi config` to disable only the extension while retaining the skills.

## Scanner location

The `anti-slop` skill bundles shared scanners and references beneath its own directory so the five skills remain usable when copied into a harness skill directory. To use another trusted scanner checkout, set:

```bash
export ANTI_SLOP_SCRIPTS=/absolute/path/to/anti-slop-brain/scripts
```

Python files in that directory are executed with your user permissions. Treat the override as a code-execution trust boundary.

Scanner exit codes are uniform: 0 clean, 1 findings, 2 usage error. `scan_refs.py` and `scan_packages.py` are offline by default. Pass `--online` to check resolution or registry existence.

## Use

| Ask | Skill |
|---|---|
| Review prose or documentation | `slop-review` |
| Repair an existing findings report | `slop-rewrite` |
| Review code, tests, docs, commits, or PR text | `slop-code` |
| Verify citations, links, packages, or residue | `slop-verify` |
| Choose the right workflow | `anti-slop` |

The two role packets live under `skills/anti-slop/references/agents/`. An installed external worker facility may consume them. Without one, the router runs them as explicit separate passes and discloses that fresh-context isolation was not provided.

## Verify

```bash
pnpm --filter @edheltzel/pi-anti-slop test
pnpm --filter @edheltzel/pi-anti-slop tsc
pnpm run misc-checks
```

Smoke-check each scanner with `python3 skills/anti-slop/scripts/<scanner>.py --help`.

## Remove

Remove the Git collection with:

```bash
pi remove git:github.com/edheltzel/pi-extensions
```

For a direct local installation, remove the same local source string used during installation. Removing a package registration removes its global gate but does not delete the source repository.

## Licences and attribution

Code is Apache 2.0. Original prose is CC BY 4.0. Material adapted from Wikipedia remains CC BY-SA 4.0. See [LICENSE](LICENSE), [LICENSE-CONTENT](LICENSE-CONTENT), and [NOTICE](NOTICE).
