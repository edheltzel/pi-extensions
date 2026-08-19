# Red Team ParallelAnalysis: footer vs pi-bits

**Workflow:** ParallelAnalysis (Red Team, skill `red-team`)
**Date:** 2026-08-19
**Method:** Reduced 12-persona dispatch (3 per family) instead of the full 32. The claim is one loader/identity question; 32 specialists would add volume, not new attack surfaces. No `SKILLCUSTOMIZATIONS/red-team/` overlay existed. `themis_notify` reported inactive Themis mode; Echo `localhost:8888/notify` was attempted.

**Position under test:** Installing both the local footer workspace and `packages/pi-bits` creates a real footer duplicate or precedence conflict.

**Decision:** Only true under a specific condition. False on the live machine today.

---

## Position analyzed

The strongest fair form is: listing both `extensions/footer` and `packages/pi-bits` in Pi settings installs two undeduped footer sources, so a second factory will collide with the live status line.

---

## First-principles decomposition

### Fundamental truths

- Live `~/.pi/agent/settings.json` lists both `../../Developer/Atlas/PiExtensions/extensions/footer` and `../../Developer/Atlas/PiExtensions/packages/pi-bits`. `pi list` resolves both to those checkout directories.
- Package identity is npm name, git host/path, or `local:` plus resolved absolute path. These two paths are different identities, so package-level dedup keeps both.
- Extension-file collapse is `canonicalizePath` of the loaded file only. First `addResource` wins for the same path; different paths both stay.
- `packages/pi-bits/src/footer.ts` re-exports `../../../extensions/footer/src/index`.
- `packages/pi-bits/package.json` declares `./dist/footer.mjs` and `./dist/trust-all-projects.mjs`. `dist/` is gitignored and does not exist in the live checkout or in the installed Git collection clone.
- `collectFilesFromPaths` and `resolveExtensionEntries` skip missing paths. A manifest that lists only absent `dist/*.mjs` contributes no extensions and does not fall back to `src/`.
- Footer registers with `ctx.ui.setFooter`. Docs say a custom footer replaces the built-in footer entirely. `setExtensionFooter` disposes the previous custom footer and keeps one container child. Last `session_start` writer wins.
- The Atlas Git collection `pi` manifest does not export footer. AGENTS.md names the local footer workspace as the live footer and forbids extra `git:`/`npm:` copies of `@edheltzel/pi-footer` or `@richardgill/pi-footer`.
- Settings use bare strings for both packages. There is no `extensions: []` filter and no disabled-resource override.

### Assumed truths that still needed validation

- "Installing both" means two footer factories run, not merely two package rows.
- "Duplicate" means two visible status lines.
- "Precedence conflict" means undefined or chaotic winner.
- This pairing is the same class of problem as installing a second `@edheltzel/pi-footer` package.

### Atomic claims

1. Live settings currently install both local `extensions/footer` and local `packages/pi-bits`.
2. Those entries are distinct Pi package identities, so package-level dedup does not collapse them.
3. `pi-bits` is a composite that includes a footer (re-export plus declared `./dist/footer.mjs`).
4. Because both packages can contribute a footer factory, installing both loads two footer extensions.
5. Two loaded footer extensions create a real visual duplicate and/or a precedence conflict.
6. Pi has no content-level or re-export-aware dedup that would treat these as the same extension.
7. Dual install of this pair is the same class of problem as installing git/npm footer copies.

### Missing links

- Claim 4 does not follow from claims 1 to 3 unless the declared `pi-bits` footer file exists and is enabled.
- Visual duplicate does not follow from two factories, because `setFooter` is an exclusive replacement slot.
- "Undefined precedence" does not follow from two writers: load order is deterministic, later `session_start` wins.
- Claim 7 does not follow from AGENTS.md, which names git/npm `@edheltzel/pi-footer` / `@richardgill/pi-footer`, not the local composite.

### Constraint classification

| Constraint | Class | Why |
| --- | --- | --- |
| Package identity is path/name, not product | Hard | Pi loader contract |
| File dedup is canonical path only | Hard | `toResolvedPaths` / `addResource` |
| Missing manifest paths are skipped | Hard | `existsSync` continue; no `src/` fallback |
| `setFooter` is one exclusive slot | Hard | `setExtensionFooter` dispose + replace |
| Dual listing in live settings | Soft | Reversible settings choice |
| Building `pi-bits` before use | Soft | Documented, optional on a local path |
| Filtering `pi-bits` to drop footer | Soft | Supported object-form package filter |
| Dual install implies dual load | Assumption | False while `dist/` is absent |
| Duplicate means two visible lines | Assumption | False; replacement, not stack |
| Same ban as git/npm footer copies | Assumption | Different named source class |

---

## Verified live evidence

| Fact | Evidence |
| --- | --- |
| Both packages installed | `~/.pi/agent/settings.json` packages array; `pi list` |
| Distinct identities | `local:/Users/ed/Developer/Atlas/PiExtensions/extensions/footer` vs `.../packages/pi-bits` |
| Footer re-export | `packages/pi-bits/src/footer.ts` |
| Declared load paths | `pi.extensions`: `./dist/footer.mjs`, `./dist/trust-all-projects.mjs` |
| `dist/` absent | Live checkout and `~/.pi/agent/git/github.com/edheltzel/pi-extensions/packages/pi-bits` |
| `dist/` not shipped in git | Root `.gitignore` has `dist/` |
| Missing files skipped | `package-manager.js` `collectFilesFromPaths`: `if (!existsSync(p)) continue` |
| No content dedup | `docs/packages.md` Scope and Deduplication; `getPackageIdentity` |
| Exclusive footer slot | `docs/extensions.md`: "replaces built-in footer entirely"; `setExtensionFooter` |
| Git collection does not export footer | Installed and checkout root `package.json` `pi.extensions` list anti-slop / better-ask-user / better-btw (/ leader-key in checkout only) |
| Live contract | `~/.pi/agent/AGENTS.md` STATUS LINE: live footer is the local workspace; do not also install git/npm footer copies |
| Documented install-all | `PI_SETUP.md` installs `./packages/pi-bits`, not `./extensions/footer` |
| No resource filter | Settings packages are bare strings; no disabled extensions key |

---

## Persona run

Reduced roster, all four families:

| ID | Persona | Strongest for | Strongest against | Verdict |
| --- | --- | --- | --- | --- |
| EN-2 | Evidence Demander | 6 | 4 | Latent path-dedup gap; current dual install does not load two footers |
| EN-3 | Edge Case Hunter | 2 | 5 | Two identities, one loadable footer; build would overwrite the same slot |
| EN-6 | Dependency Tracer | 6 | 4 | Claim 4 depends on a missing artifact |
| AR-2 | Trade-off Illuminator | 6 | 5 | After build, later `pi-bits` would replace the live TypeScript footer |
| AR-3 | Abstraction Questioner | 6 | 5 | Category error: listing is not factories, visible lines, or undefined precedence |
| AR-6 | Integration Pessimist | 6 | 5 | Latent last-writer after build, not a live stacked footer |
| PT-2 | Assumption Breaker | 2 | 4 | Dual listing is real; dual footer load is not |
| PT-5 | Precedent Finder | 7 | 5 | Hygiene smell like the copy-ban; runtime is silent missing artifact |
| PT-6 | Defense Evaluator | 2 | 4 | "Same module" / "Pi dedupes" defenses fail; "dist missing" and "setFooter last-wins" hold |
| IN-1 | Naive Questioner | 3 | 4 | Why assume install loads a footer today, or that duplicate means two lines? |
| IN-4 | Common Sense Checker | 1 | 4 | Dual listing is a later-build hazard; the screen shows one footer now |
| IN-6 | Simplicity Advocate | 3 | 5 | Both listed; only local footer loads; a build adds a silent last-writer |

Convergence is not a vote. Independent specialists repeatedly hit the same two issues: no content-level collapse (claims 2 and 6), and claim 4's false "therefore two factories load."

---

## Steelman

The position, best version: Dual listing is an undeduped second footer source that becomes a last-writer trap the moment `pi-bits` is built.

1. Live settings already list both local footer and local pi-bits as packages.
2. Those two entries have different resolved absolute paths, so Pi never collapses them.
3. pi-bits is a composite that ships the same footer through a re-export.
4. Package-level identity cannot see that both factories implement one status line.
5. Critics treat a missing dist folder as proof the pairing is harmless forever.
6. One documented build would materialize dist/footer.mjs beside the live TypeScript source file.
7. File-path dedup would then load two setFooter factories into one exclusive slot.
8. That last-writer trap is why informed operators treat dual listing as dangerous.

Validity assessment: The legitimate core concern is identity-only dedup plus an exclusive UI slot, not two painted status lines.

---

## Convergent weaknesses

### Critical

**Claim 4 is false on the live machine.** Dual install does not load two footer extensions. `pi-bits` only declares `./dist/footer.mjs`; `dist/` is absent and gitignored; the loader skips missing paths and does not fall back to `src/footer.ts`. Consequence: there is no second factory, so there is no live duplicate and no live footer precedence fight. Convergence: EN-2, EN-6, PT-2, PT-6, IN-1, IN-4 (and the rest as supporting).

### Major

**Claim 5 conflates exclusive last-writer with visual duplicate and undefined precedence.** `setFooter` disposes the previous custom footer and keeps one child. After a build, later `session_start` (settings order: footer, then `pi-bits`) would replace the live TypeScript footer. That is a defined single slot, not two stacked lines and not chaos. Consequence: even the after-build hazard is "silent overwrite of the live workspace," not "two footers." Convergence: EN-3, AR-2, AR-3, AR-6, PT-5, IN-6.

**Claim 7 overextends the AGENTS.md copy-ban.** The live contract forbids extra `git:`/`npm:` `@edheltzel/pi-footer` or `@richardgill/pi-footer` while the local workspace is listed. It does not name `packages/pi-bits`. `pi-bits` is a composite whose current live failure is that `trust-all-projects` also does not load. Consequence: treating the pair as the same documented ban misstates both policy and current damage. Convergence: AR-3, AR-6, PT-5, PT-6.

### Minor

**PI_SETUP.md and live settings disagree.** Documented install-all uses `./packages/pi-bits` without `./extensions/footer`. Live settings include both. That is a hygiene smell and a future last-writer surface, not proof of a current stacked footer. Convergence: AR-2, IN-4, PT-5.

**IN-6's "missing-path error" is overstated.** The loader silently continues; it does not need a diagnostic to skip `dist/*.mjs`. Discarded as wording noise.

---

## Counter-argument

# RED TEAM VERDICT

The position: Dual listing of local footer and pi-bits already produces a real footer duplicate or precedence conflict.

1. The claim treats two package entries as two currently loaded footer factories.
2. Live pi-bits declares only dist artifacts, and that directory does not exist.
3. Pi skips missing manifest paths and never falls back to the TypeScript re-export.
4. Therefore today's dual install loads one footer file, not a competing pair.
5. setFooter replaces the previous custom footer and cannot stack two status lines.
6. Last writer is defined load order, not an undefined or chaotic precedence fight.
7. AGENTS.md bans git and npm footer copies, not this local composite package.
8. The live damage is missing trust-all-projects, not a duplicated or contested footer.

Assessment: Fundamentally overstated. The loader gap is real; the live footer collision is not.

---

## Remediation

Smallest changes that keep the legitimate concern without the false live claim:

1. **State the condition.** Dual listing is a latent last-writer hazard after `pnpm run build` in `packages/pi-bits`, not a current stacked footer.
2. **Reduce likelihood.** Keep the live footer as `extensions/footer`. If `pi-bits` stays installed for `trust-all-projects`, filter it with `"extensions": ["./dist/trust-all-projects.mjs"]` or install `extensions/trust-all-projects` instead. Do not build `pi-bits` while both remain unfiltered.
3. **Reduce consequence.** `setFooter` already prevents two visible lines. The remaining after-build cost is losing `/reload` on the TypeScript workspace if the bundled copy wins.
4. **Do not pretend a hard constraint is optional.** Pi will not content-dedupe these packages. Hygiene has to live in settings, not in hopes the loader notices the re-export.

---

## Verdict

**revise**

The unqualified claim is false on this machine. It becomes a last-writer precedence hazard, not a visual duplicate, only if `packages/pi-bits/dist/footer.mjs` exists and both packages stay enabled.

---

## Sources

- `~/.pi/agent/settings.json`
- `~/.pi/agent/AGENTS.md` (STATUS LINE)
- `/Users/ed/Developer/Atlas/PiExtensions/packages/pi-bits/package.json`
- `/Users/ed/Developer/Atlas/PiExtensions/packages/pi-bits/src/footer.ts`
- `/Users/ed/Developer/Atlas/PiExtensions/packages/pi-bits/README.md`
- `/Users/ed/Developer/Atlas/PiExtensions/extensions/footer/src/index.ts`
- `/Users/ed/Developer/Atlas/PiExtensions/package.json`
- `/Users/ed/Developer/Atlas/PiExtensions/PI_SETUP.md`
- `/Users/ed/.pi/agent/git/github.com/edheltzel/pi-extensions/package.json`
- `/Users/ed/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/docs/packages.md`
- `/Users/ed/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`
- `/Users/ed/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/dist/core/package-manager.js`
- `/Users/ed/.bun/install/global/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js`
