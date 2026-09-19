# Write-up

The product, the experiment and the numbers are in the README. This is about the work.

## Approach

- **Plan first.** `docs/plan.md` was written before any code: decisions with the alternatives
  weighed, data model, API, and one story per slice with its test cases and commit sequence.
  It is checked in with each story's review triage appended.
- **A read that says no to a lucky look.** A z-test a growth team can check by hand, and it
  refuses to call a result before the powered sample is in. The simulated run is significant at
  p = 0.008 and still reads "keep running". That is on purpose.
- **Strict test-first.** No production line without a failing test. Every commit is one case
  red-to-green, a fix with its own red test, a refactor or a chore, with two exceptions recorded
  in the S5 triage; the pre-commit hook runs typecheck, lint and both suites. Over 200 commits
  in three days.
- **Python was new to me.** My conventions are written for TypeScript. I translated them
  (`docs/python-conventions.md`) and kept a primer of every construct that landed
  (`docs/python-primer.md`). I can explain all of it.

## Where AI helped

I worked with Claude Code throughout, held to a written set of house rules. It is in the commit
trailers.

- **The plan:** drafted with AI against the brief, then argued over and cut. Relitigable
  decisions became ADRs.
- **The design:** the funnel screens were designed in Claude Design, then translated into one
  token file and a component inventory the build reads as its spec.
- **The build loop:** driver, red test, least code, refactor, commit. Mechanical enough that
  my attention went to what the case should be.
- **Review:** each story closed with an independent code review by a separate model, and every
  UI change went to a separate visual reviewer given only file paths and a URL. It measured
  font sizes, tap targets and contrast at 390, 768 and 1280 instead of eyeballing a screenshot.
  Those reviews found most of the next section.
- **A second language:** for Python, AI was the colleague who knew it.

## Where it was wrong, and how I caught it

The mistakes were rarely in the happy path. They were in what was *claimed*: a test that
asserted nothing, a doc describing the plan instead of the build, a "done" with no capture.
Independent review and running the real thing caught them.

- **The server answered before it had saved.** FastAPI runs a request's cleanup after the
  response is sent, so the database commit landed after the client had moved on. Every test
  passed; the test client cannot show it. The first live simulation crashed at 750 visitors.
  Fixed with `scope="function"` on the dependency, pinned by a test.
- **A scaffold that only looked finished.** Compose demanded a file that is never committed,
  no migration existed, and a tracing test could not fail. A clean clone could not start. Found
  by a review told to run it, not read it.
- **A shipped credential.** A default admin token from the repo, published on every interface.
  The reviewer reproduced the write from another machine. Now required, no default, loopback only.
- **A recorder that trusted the browser.** The first event endpoint took a visitor id in the
  body, so anyone could file steps for anyone. Review caught it; the server's cookie is now the
  only identity.
- **Docs describing the design, not the build.** At the design handoff, a code review found the
  same defect five times: prose describing what was designed, not what was built. A tone switch
  named in the inventory and wired to nothing was one. I caught the same drift myself writing
  the README: the plan still says Recharts and "17.8B"; the build has native bars and "17.7B".
- **Tests that passed for the wrong reason.** A colour-switch test that could not fail; a
  smaller-arm check that survived being changed to `max`. Each found by asking the reviewer to
  prove coverage by mutation.
- **A defect only a capture can see.** The dashboard's warning banner never got its colour:
  the class name was a plain string beside the hashed one, and the test build cannot tell the
  two apart. The visual reviewer measured a grey banner.
- **A call beside a lift it could not state.** "Ship" was possible next to "not enough data"
  when the control had zero conversions. Review caught it.

The statistics themselves, the hashing decisions, and the three funnel screens came through
review without a correctness defect.

## With more time

1. A sequential or Bayesian read beside the frequentist one, so a daily-refreshed dashboard has
   an honest early answer; the guardrail with its own interval beside it.
2. Real traffic. The simulator encodes the effect; only people answer the hypothesis.
3. An identity and audit trail behind `/admin`.
4. The stated exposures: the unauthenticated sign-up costs 64 MiB per password hash and is not
   rate-limited; event metadata is unbounded; the catalogue refresh belongs in a scheduled job
   once there is more than one worker.
5. One end-to-end test against the real stack for landing to activation, so the
   commit-after-response class of bug is caught by a test, not a run.
