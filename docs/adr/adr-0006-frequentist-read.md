# ADR-0006 — The experiment is read with a fixed-sample frequentist test, and significance alone does not earn a call

Date: 2026-09-19 · Status: accepted · Story: S7

## Context

The dashboard has to turn two counted arms into a call a product manager can act on: ship the
variant, keep the control, or keep running. The take-home is judged on that screen, and the
judge is a growth team that reads A/B results for a living, so the read has to be one they can
check by hand and disagree with on its merits — not a black box that says "97% probability
of being better".

The hypothesis is fixed before the experiment runs (`docs/plan.md`, "Experiment design"): an
urgent framing raises activation over scan completions by at least 20% relative, from a
baseline of 8%. That statement is what the sample size is powered for, and it is the reason
the hypothesis lives in code (`app/experiments/hypothesis.py`) rather than on the flag row an
operator can edit.

## Decision

**A pooled two-proportion z-test on the primary metric, two-sided at alpha 0.05, with the
95% interval on the absolute and the relative lift computed at the same alpha.** The p-value
and the interval come from one critical value, so the dashboard can never show a result that
is significant by one and not by the other (`stats.py`, B11). The relative interval is the
delta method on the log ratio, because a ratio's sampling distribution is skewed and the
symmetric form can print a lower bound below −100%.

**The required sample per arm is computed from the hypothesis, not from the data**, at power
0.8: 4,921 scan completions per arm for 8% → 9.6%. Computing it from the observed rates would
move the finish line every time somebody refreshed the page.

**Significance alone does not earn a call.** `recommend` answers `SHIP_VARIANT` or
`KEEP_CONTROL` only when the test is significant *and* the smaller arm has reached the required
sample; everything else is `KEEP_RUNNING`. Shipping asks for one thing more — a statable
relative lift — because a variant that beat an arm nobody converted in is an infinite ratio and
a funnel to look into, not a result to roll out. Keeping the control does not: it is the status
quo, and a fully powered significant loss is a finished result whether or not the losing arm's
zero conversions leave a ratio to print (BF61; requiring the lift in both directions left such a
variant live and reading "keep running"). This is the peeking guard: a dashboard that is
refreshed daily is a sequential look at the data, and a null experiment will cross p < 0.05 at
some look if the reader is allowed to stop there. Waiting for the powered sample is the cheapest
honest answer to that; it does not make the read a proper sequential test, and the ADR says so.

The alternatives weighed:

- **A Bayesian read (posterior probability that the variant is better, expected loss).**
  Rejected for this exercise: it is the better tool for a dashboard that is looked at every
  day, but its prior is a decision the reader cannot inspect on the screen, and the judge is
  more likely to check a z-test by hand. Recorded as the natural next step if the dashboard
  outlives the exercise.
- **A sequential test (mSPRT, always-valid p-values).** The right answer to peeking, and more
  than the exercise needs; the fixed-sample gate gives most of the protection in one guard
  clause.
- **Calling on significance alone.** Rejected: it is what the peeking problem is made of.
- **Unpooled standard error in the test.** Rejected: the null hypothesis is that both arms share
  one rate, so the test estimates one; the interval asks how far apart they are, so it
  estimates two. The two standard errors differ on purpose and are not a duplication.

## Consequences

**Easier.** Every figure on the dashboard is one formula a reader can recompute from the counts
beside it, and the two degenerate inputs the dashboard meets first — nobody through yet, nobody
converted in an arm — are `null` on the wire rather than `NaN` (B10), so the page renders calmly
instead of failing to parse.

**Harder.** The simulated read shows the cost of the guard plainly. 4,000 simulated visitors
(4,764 in the table with the crashed first run and the manual ones) at 8% against 10% gave
control 144/1,940 (7.4%) and variant 185/1,885 (9.8%): z = 2.64, p = 0.008, relative lift +32%
with a 95% interval of +7% to +63% — and the call is `KEEP_RUNNING`, because 1,885 scan
completions per arm is short of the 4,921 the hypothesis asks for. That is the intended
behaviour, and it is the line the README has to explain: the effect is significant at this
look, and the dashboard still declines to call it until the sample it was powered for is in.
A reader who wants the call sooner needs a sequential test, not a smaller number.

**Stated plainly.** The simulator *encodes* the effect it is asked for. The read validates the
pipeline — cookie identity, stored assignment, distinct-visitor counts, the statistics — and
says nothing about whether urgency actually moves activation.
