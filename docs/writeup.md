# Write-up

The product, the experiment and the numbers are in the README. This is about the work.

## Approach

- **Plan first.** `docs/plan.md` was written before any code: the decisions with their
  alternatives, the data model, the API, and one story per slice with its test cases.
- **A read that says no to a lucky look.** A z-test a growth team can check by hand, and it
  refuses to call a result before the powered sample is in. The simulated run is significant at
  p = 0.008 and still reads "keep running". That is on purpose.
- **Strict test-first.** No production line without a failing test; every commit is one case
  red-to-green, a fix with its own red test, a refactor or a chore. The pre-commit hook runs
  typecheck, lint and both suites. Over 200 commits.
- **Python was new to me.** My conventions are written for TypeScript, so I translated them
  (`docs/python-conventions.md`) and kept a primer of every construct that landed
  (`docs/python-primer.md`). I can explain all of it.

## Where AI helped

I worked with Claude Code throughout, held to a written set of house rules.

- **The plan** was drafted against the brief, then argued over and cut. Decisions worth
  relitigating became ADRs.
- **The design** was done in Claude Design, then translated into one token file and a component
  inventory the build reads as its spec.
- **The build loop** — driver, red test, least code, refactor, commit — was mechanical enough
  that my attention went to what the case should be.
- **Review:** every story closed with a code review by a separate model, and every UI change
  went to a visual reviewer given only file paths and a URL, which measured font sizes, tap
  targets and contrast at 390, 768 and 1280 rather than eyeballing a screenshot.

## With more time

1. A sequential or Bayesian read beside the frequentist one, so a daily-refreshed dashboard has
   an honest early answer, with the guardrail's own interval next to it.
2. Real traffic. The simulator encodes the effect; only people answer the hypothesis.
3. An identity and audit trail behind `/admin`.
4. The stated exposures: sign-up costs 64 MiB per password hash and is not rate-limited, event
   metadata is unbounded, and the catalogue refresh belongs in a scheduled job once there is
   more than one worker.
5. One end-to-end test against the real stack, landing to activation.
