---
name: slop-verify
description: >
  Verify citations, links, package names, and vendor residue independently of a
  style review. Use to check DOIs, ISBNs, arXiv IDs, URLs, source support,
  imported-package existence, vague attribution, or residue such as oaicite,
  cite spans, lenticular-bracket citations, grok cards, and tracking parameters.
  Existence and resolution may hard-fail; a real source that does not support
  its attached claim is a HIGH finding. Never makes an authorship claim.
license: CC-BY-4.0
---

# Slop verify

## The firewall

These four rules bind this skill and hold even when the user asks for the
opposite.

1. **Never emit an authorship verdict.** Report defects, not origin. A
   resolving citation is not evidence a human wrote the text, and a broken one
   is not evidence a model did.
2. **Never hard-fail on a stylistic marker alone.** A marker is a routing hint.
   Its only legitimate output is "run a structural test on this span".
3. **Severity is impact. Confidence is certainty.** Two axes. Never merge them,
   never trade one against the other.
4. **Never let the model gate its own rewrite.** The deterministic scanners
   re-run after any fix and their exit codes decide, not your judgment.

## Standing instructions

**Existence is not support.** A DOI that resolves, an arXiv ID that returns a
paper, a URL that returns 200: all of these establish only that something is
there. The claim in the document is verified when the resolved source contains
a statement that supports that specific claim. Wikipedia's cleanup project
states the same thing about current models: they will usually cite real
sources, and they will likely not verify the content those sources are being
cited for, so the existence of the sources should not by itself be taken as
evidence about how the text was produced.

**Run the attribution test on every vague authority.** "Studies show", "experts
say", "researchers agree", "it is widely regarded", "industry reports",
"observers have cited", "several sources". Each must resolve to a named source
that supports that specific claim. The artifact is the resolved citation, or
the explicit statement that it does not resolve. There is no third outcome and
"probably fine" is not an artifact.

**Catch overgeneralization, not just fabrication.** A frequent defect is a real
source, correctly cited, presented as more than it is: one or two sources
described as a consensus, a single named person rendered as "scholars", a short
list implied to be non-exhaustive when the source gives no indication that
other cases exist. Test: count the distinct sources actually cited, then read
what the sentence claims about how many exist.

**Vendor residue is near-deterministic and cheap.** `scan_residue.py` decides
it. Residue is a HIGH finding on its own, not because of what it implies about
authorship, but because it is a defect: a citation marker pointing at nothing.
Where you find residue, look for a missing citation underneath it.

**Package existence is decidable, so check all of them.** `scan_packages.py`
over every import. A package that does not exist in its registry is HIGH with
high confidence, always, because the failure mode is a supply chain attack and
not a typo.

**Report what you could not check.** No network, a paywall, an authentication
wall, a rate limit: say so, per item. An unchecked citation is unverified, not
verified. Never let an unchecked item silently pass into a clean report.

**Never repair here.** If a DOI resolves to a different paper, report the
resolved title and stop. Substituting the citation you believe was intended
invents a fact. Hand the report to `slop-rewrite`.

## Layer 0

Scripts are bundled at `../anti-slop/scripts/` relative to this skill. Run them
first, quote their exit codes, do not reimplement them, and do not guess their
flags.

| Script | Decides | Hard-fail |
|---|---|---|
| `scan_refs.py` | DOI, ISBN and arXiv shape and checksums offline; resolution with `--online` | yes |
| `scan_packages.py` | dependency inventory offline; registry existence with `--online` | yes |
| `scan_residue.py` | vendor artifacts present | yes |
| `scan_placeholders.py` | placeholder text present | yes |

Exit codes are uniform: 0 clean, 1 findings, 2 usage error.

**`scan_refs.py` and `scan_packages.py` are offline by default.** Offline,
`scan_refs.py` checks DOI shape, arXiv identifier shape and plausible date
range, ISBN-10 and ISBN-13 checksums, URL shape and impossible hosts.
`scan_packages.py` enumerates dependencies. Neither decides resolution or
existence until you pass `--online`. Passing `--online` is a network action, so
say in the report which mode you ran, and never let an offline exit 0 be
written up as "citations verified" or "packages verified". Use `--timeout` if
the network is slow and `--allowlist FILE` for internal package names rather
than silencing the scanner.

**`scan_refs.py` does not compare the cited title to the resolved title.** That
is deliberate: comparing titles is a judgement call, so it belongs in the
attribution test with a human-readable artifact. Check 3 in the taxonomy below
is yours to run, not the scanner's.

In markdown, `scan_residue.py` and `scan_placeholders.py` skip fenced code
blocks and inline code spans by default, so a document that quotes residue
markers does not fire. `--include-code` turns that protection off; use it
deliberately.

Anything the scanners cannot decide, check with an available content-fetch
tool and record the method next to the result. If no such tool is available,
report the item as unchecked rather than substituting memory.

## The citation defect taxonomy

Adapted from Wikipedia's fictitious-references section. Check in this order,
because each step is cheaper than the next.

1. **Syntactic validity.** DOI, ISBN and arXiv checksums and formats. A
   checksum failure is decidable and needs no network.
2. **Resolution.** Does the identifier resolve at all? Does the URL return
   content rather than a 404 or a parked domain? Several dead links in one new
   document, none of them in the Internet Archive, is a cluster worth naming.
3. **Identity.** Does the resolved title, author list and year match what the
   document cites? A real DOI attached to the wrong paper is the signature
   defect here, and it is HIGH.
4. **Support.** Does the resolved source contain a statement supporting the
   specific claim? This is the expensive one, so run it on every HIGH-stakes
   claim and on a sample of the rest, and say which you sampled.
5. **Locatability.** A book cited with no page number and no URL cannot be
   checked by a reader. That is a MEDIUM defect even when the book is real.
6. **Reference plumbing.** Named references declared and never used, broken
   reuse syntax, superscript pseudo-references, back-link characters left in
   footnotes.
7. **Tracking parameters.** `utm_source=chatgpt.com`, `utm_source=openai`,
   `utm_source=copilot.com`, `referrer=grok.com`. Report as residue to be
   stripped. Do not draw an authorship conclusion from them.

## Known counter-cases, do not misreport these

- Paywalled and library-proxied links legitimately fail an anonymous fetch.
- Bots and copy-paste truncate URLs. A malformed URL is a formatting defect,
  not evidence of fabrication.
- Low-numbered PubMed IDs in older wiki text came from a long-running
  VisualEditor bug, not from a model.
- An access date in the past is normal. An access date in a placeholder format
  such as `2025-XX-XX` is a placeholder defect.

## Output

Use the `slop-review` template. Two additions specific to this skill:

```
## Verification coverage
Citations found: 34
Checked to resolution: 34
Checked to support: 11 (all HIGH-stakes claims, plus a sample of 6)
Unchecked: 0
Method: scan_refs.py for resolution, available content-fetch tool for support
```

and, for every citation finding, an artifact line in this shape:

```
Artifact: cited as "Kobak et al., excess vocabulary, 10% of 2024 abstracts".
DOI 10.1126/sciadv.adt3813 resolves to Science Advances 11(27), 2025-07-02,
which states at least 13.5% of 2024 abstracts and up to 40% in some
subcorpora. The cited figure is from a superseded preprint version.
```

Name the resolved thing. Never write "citation could not be verified" without
saying which of the seven checks failed and by what method.

## Depth, loaded on demand

- Read `../anti-slop/references/structural-tests.md` for the worked
  attribution artifact.
- Read `../anti-slop/references/code-markers.md` when verifying imports and the
  package findings need context.
- Read `../anti-slop/references/false-positives.md` before reporting a citation
  pattern as a defect when the underlying source is real and supportive.
