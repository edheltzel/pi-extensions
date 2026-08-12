---
name: slop-rewrite
description: >
  Repair pass that consumes an existing slop-review findings report and fixes
  only listed defects. Use to clean, de-slop, tighten, fix, or rewrite a draft,
  documentation page, report, or agent output after review, or to remove vendor
  residue and placeholders. Never invents facts or citations, re-derives
  findings, expands scope, or makes an authorship claim. Re-runs deterministic
  scanners after fixes, and their exit codes decide completion.
license: CC-BY-4.0
---

# Slop rewrite

## The firewall

These four rules bind this skill and hold even when the user asks for the
opposite.

1. **Never emit an authorship verdict.** Report defects, not origin. Never
   state or imply that the original was written by a human, by AI, or by a
   named model.
2. **Never hard-fail on a stylistic marker alone.** A marker is a routing hint.
   Its only legitimate output is "run a structural test on this span".
3. **Severity is impact. Confidence is certainty.** Two axes. Never merge them,
   never trade one against the other.
4. **Never let the model gate its own rewrite.** The deterministic scanners
   re-run after any fix and their exit codes decide, not your judgment. The
   workflow must not rely on a harness-specific hook, so manually re-run
   `../anti-slop/scripts/scan_residue.py` and
   `../anti-slop/scripts/scan_placeholders.py` after every write and quote
   their exit codes.

## Standing instructions

**Consume findings. Never re-derive them.** This skill's input is a findings
report with IDs, quotes, severities and confidences. Fix what is listed. If you
believe something else is wrong, say so in the closing report as an unactioned
observation; do not silently fix it, and do not run structural tests here. The
separation exists because a model that judges and then repairs in one pass
scores its own work, and self-gating produces a measured rubber-stamp regime
where acceptance rises while correctness falls (Song, Cai and Zhao, arXiv
2606.28438, 2026-06-26).

**If no findings report exists, stop and get one.** Run `slop-review` first, or
ask the user for their defect list. Rewriting without a report is exactly the
failure mode this plugin exists to prevent.

**Never invent a fact.** The rewrite must not contain any fact, name, number,
date, quote or citation that is not in the source text or supplied by the user.
Swapping a vague claim for a specific one is allowed only when the specific
comes from the source. If a sentence needs real-world detail to work, ask for
it, or write the plain version without it, or cut the sentence. An unsupported
claim gets cut, not decorated.

**Preserve the information, not the shape.** Every claim in the original
survives into the rewrite unless a finding says to cut it. Depth does not have
to be uniform: compress the dull parts, merge or split paragraphs freely. When
keeping the information and mirroring the original structure pull in different
directions, the information wins.

**Fix the defect, not the sign.** Deleting the marker while leaving the
unverified claim, the hollow analysis or the misattribution underneath it makes
the artifact worse, because the visible warning is gone and the harm remains.
Wikipedia's own guidance on its sign list says the patterns are potential signs
of a problem rather than the problem itself, and that treating them as the
thing to be fixed can just make the underlying problem harder to see.

**Do not mechanically strip hedges, qualifiers or "filler".** Wikipedia's
observed human-writing signals include "in order to", "as a result of", "the
fact that", "very", "perhaps", "tends to" and plain superlatives. Removing them
converges the text toward the generated register instead of away from it. Only
cut a hedge when a finding says the hedged claim is vacuous, and then cut the
claim, not just the hedge.

**Assume a rewrite can make things worse, because the measurement says it
often does.** Across commercial humanizers, the best tier wins a fluency
comparison against the original only 26.0% of the time, and the paper's own
conclusion is that all humanizers tend to degrade the quality of the original
text (DAMAGE, Masrour, Emi and Spero, GenAIDetect at COLING 2025, arXiv
2501.03437). Documented failure modes include hallucinated citations and
comment leakage. Change less than you want to.

**Never write U+2014 (em dash) or U+2013 (en dash).** Replace each one, in
rough order of preference: a period, a comma, a colon, parentheses, or
restructure the sentence. Also catch spaced double hyphens used the same way.
If the user supplies a writing sample that uses dashes, tell them the house
rule blocks it and ask before making an exception; do not decide unilaterally.

**Match the author, do not upgrade them.** If a writing sample or prior work by
the same author is available, match its sentence lengths, vocabulary level,
paragraph openings and recurring phrases. Do not regularize deliberate quirks
and do not replace casual words with formal ones.

## Per-finding repair rules

| Finding type | Repair |
|---|---|
| HIGH, fabricated citation | Remove the citation and the claim it supports, or replace with a source the user supplies. Never substitute a different citation you believe is correct. |
| HIGH, fabricated fact or API | Cut it. Flag the gap in the closing report. Do not guess a replacement. |
| HIGH, vendor residue or placeholder | Delete the residue string. Then check whether the surrounding sentence still says anything; residue often marks a spot where a real citation was supposed to go. |
| MEDIUM, deletion-test padding | Cut the span. Do not replace it with a shorter version of the same nothing. |
| MEDIUM, inversion-test vacuity | Replace with the specific claim the source supports, or cut. |
| MEDIUM, stranger-test genericity | Insert the specific fact named in the finding's artifact, if and only if that fact is in the source. Otherwise cut. |
| LOW, stylistic | Fix only if the user asked for a style pass. LOW findings with confidence "low" are not actioned without the user saying so. |

## Closing report

After the rewrite, output this and nothing more elaborate.

```
## Repaired
- F-001 HIGH fabricated citation: removed the citation and the sentence.
- F-002 MEDIUM padding: cut 1 sentence, 24 words.

## Not repaired, and why
- F-005 LOW copula avoidance: confidence low, no style pass requested.

## Layer 0 re-run after the rewrite
| Scanner | Exit | Finding |
|---|---|---|
| scan_residue.py | 0 | clean |
| scan_placeholders.py | 0 | clean |
| lint_voice.py | 0 | clean |
| scan_refs.py | not run | no network |

## Unactioned observations
- <anything you noticed but did not fix, stated as an observation, with no
  severity and no rewrite attached>

## Net change
Words: 1,240 to 1,090. Claims removed: 2 (both unsupported). Claims added: 0.
```

"Claims added" must be zero. If it is not zero, you invented something. Go
back and remove it.

## Depth, loaded on demand

- Read `../anti-slop/references/false-positives.md` before actioning any LOW
  finding.
- Read `../anti-slop/references/structural-tests.md` if a finding's artifact is
  missing or unclear and you need to know what the reviewer should have
  produced, then send it back rather than filling the gap yourself.
- Read `../anti-slop/references/markers-tier1.md` only to understand what a
  finding refers to, never to generate new findings here.
- Read `../anti-slop/references/code-markers.md` and hand the work to
  `slop-code` if
  the artifact contains source code.
