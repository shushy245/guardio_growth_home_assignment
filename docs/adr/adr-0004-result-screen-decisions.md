# ADR-0004 — The result screen: fail open to the control experience, reflow by CSS alone

Date: 2026-09-19 · Status: accepted · Story: S5

## Context

The result screen is the page the whole exercise is judged on and the page the A/B test runs on.
Its header — headline, subheadline, the button's label and the colour tone — comes from the
variant the server assigned the visitor (ADR-0003), read through the visitor session the funnel
loads on arrival. Two things can leave a visitor with no variant to read:

1. **The flag is disabled.** Product stopped the test on `/admin`; new visitors are created with
   no assignment for it, by design.
2. **The visitor session failed.** `POST /api/visitors` or `GET /api/feature-flags` did not answer.
   The visitor is unknown, and so is every flag.

The screen also has to hold at 390, 768 and 1280 (the responsive contract), and the design's own
live mocks switch layout in JavaScript at two widths and render the CTA twice, once per width.

## Decision

**Fail open to the control experience.** A visitor with no variant to read sees the calm framing:
`Known breaches` · `Here's the public record of data breaches.` · `Protect me` · calm tone. The
copy lives in one frontend constant, `CONTROL_COPY` in `Result.utils.ts`, and `resolveResultCopy`
is the only rule that chooses between it and a variant. The funnel never depends on the flag
service being up: a scan that found the record must be able to show it.

This **deliberately duplicates the seeded calm copy** in the `feature_flag` row. The two are not
one piece of knowledge: the database copy is product's to retune from `/admin` and is what the
experiment measures; the constant is what renders when product's copy cannot be read at all. If
product changes the calm headline, the control fallback does not follow — and should not, because
a visitor outside the experiment is not in the calm arm. Their events carry no variant (S4 stamps
`variant_key` from the stored assignment, which they lack), so they never enter the read.

The alternatives weighed:

- **Show an error state.** Rejected: the visitor already waited through the scan for a record the
  backend served; blanking it because an unrelated service failed punishes them for our outage and
  costs the funnel every visitor for the duration.
- **Render the header blank while unknown.** Rejected: a headline that appears a beat after the
  tiles is a layout jump on the screen the design says must not flicker, and a visitor whose
  session failed would never get one.
- **Default to the flag's first variant.** Rejected: that is inventing an assignment the server
  never made, and S3's `VisitorProvider` rule ("never a default variant") exists to stop exactly
  that from contaminating the read.

**One DOM tree, reflow by CSS alone.** The result root carries `toneClassMap[tone]`, which sets
the `--tone-*` custom properties; every button and chip beneath reads them. The CTA is a single
node in the sticky bar; the stylesheet moves it inline into the header at 768+. No component reads
the viewport width. This is load-bearing for the tests: jsdom has no layout engine, so a width
branch in JavaScript would let every driver test cover one viewport and silently miss the others.
Both are recorded deviations from the design's mocks (`component-inventory.md`, deviations 1 and 2).

## Consequences

**Easier.** The screen renders under any backend state short of the catalog itself being down,
which has its own error state on the scan page. The urgent variant's colour is one class on one
ancestor, so a third tone is a token set and a map entry, never a branch. Every driver test proves
the whole tree regardless of width, and the visual pass is what proves the reflow.

**Harder.** The control copy has two homes and the second must be remembered when the first is
rewritten — the comment on `CONTROL_COPY` and this record are the reminders. A visitor who fell
out of the experiment through a session failure is invisible to the dashboard, which is correct
for the read but means an outage shows up as fewer visitors, not as a labelled arm. Sticky
positioning and the inline move are unprovable in jsdom; F19 and F20 pin the single node and its
container, and the 390 sticky behaviour is a visual-pass item, stated as such in the plan.
