# Write-up

How I approached this, where AI helped, where it was wrong and how I caught it, and what I would
do with more time. The result itself — the numbers and the call — is in the README under "The
read, and the call"; this is about the work.

## How I approached it

**Plan first, then stories, then tests, then code.** Before the first line of application code
I wrote `docs/plan.md`: the decisions with the alternatives I weighed (framework, persistence,
where the flag lives, how assignment works, which statistics), the data model, the API contract,
and a story per slice of the funnel. Each story has a list of behaviour cases written as
sentences, and the commit sequence that turns them green one at a time. The plan was the
contract every session worked to, and it is checked in as it stood, with each story's review
triage appended, so the history of what changed and why is in one file.

**The product calls were made deliberately, not by default.** The brief says the summary, the
sort and the filters are product decisions. I treated the result screen as the one screen the
exercise is judged on and designed it before building it: the four tiles are the four reasons to
buy protection, the default sort answers the question a visitor brings, and a year-range filter
was considered and cut because it is the worst control of the four on a phone. The calls are
recorded in the README and in ADR-0004 so a reader can disagree with them on their merits.

**The experiment is the thing product would actually inherit.** The flag is a row product edits
on `/admin`; assignment is server-side and stored so a visitor is never re-bucketed; every funnel
step is tagged with the stored assignment, not with whatever the browser claims. The hypothesis
is fixed in code on purpose, so the finish line cannot be moved after a slow week. The read is a
z-test a growth team can check by hand, and it refuses to call a result before the sample it
was powered for is in — which is exactly what the simulated run exercises: significant at
p = 0.008, and still "keep running". I would rather ship a dashboard that says no to a lucky
look than one that says yes.

**Strict test-first, with a gate that enforces it.** No production line without a failing test
that demands it, one case at a time; every commit is one red-to-green case, a pure refactor, or
a chore, and the pre-commit hook runs typecheck, lint and both suites, so nothing in the history
was committed red. Tests that were already green on arrival were each proved by a mutation that
fails only them. There are 211 commits over three days; the count is the loop, not a metric.

**Python was new to me.** The brief mandates it, and my working conventions are written for
TypeScript, so I translated them (`docs/python-conventions.md`) rather than dropping them, and
kept a primer (`docs/python-primer.md`) of every Python construct that landed, story by story,
in terms of the TypeScript I know. Everything in the backend is something I can explain.

## Where AI helped

I worked with Claude Code throughout, as a partner with a set of house rules it is held to, not
as an autocomplete. It is in the commit trailers. Concretely:

- **The plan.** The decisions table, the story breakdown, the case lists and the commit
  sequences were drafted with AI against the brief and my conventions, then argued over and
  cut. Each decision that could be relitigated later is an ADR with the alternatives it beat.
- **The design.** The three funnel screens were designed in Claude Design, then translated into
  one token file and a component inventory the build reads as its specification, with every
  deviation from the design recorded rather than left silent.
- **The build loop.** Driver first, then the red test, then the least code that passes, then a
  refactor, then a commit — the loop is mechanical enough that most of my attention went to
  what the case should be, not to typing it out.
- **Review.** Every story closed with an independent code review run as a separate model with
  no memory of writing the code, and every change that touched the screen went to a separate
  visual reviewer that was given only the changed file paths and a URL — no description of what
  the screen was meant to look like — and measured font sizes, tap targets, contrast and line
  length at 390, 768 and 1280 rather than judging a screenshot by eye. Those reviews found most
  of what is in the next section.
- **A second language.** For the Python side, AI was the colleague who knew the language; the
  primer is my notes from that, written so that I can defend the code, which is the brief's one
  rule.

## Where it was wrong, and how I caught it

The pattern across three days: the AI's mistakes were almost never in the happy path, and almost
always in what it *claimed* — a test that asserted nothing, a document that described the plan
rather than the build, a "done" with no capture behind it. The defences that caught them were
independent review, running the real thing, and refusing to accept a claim without the evidence
attached. The ones worth listing:

- **The commit that landed after the response.** FastAPI runs a `yield` dependency's exit code
  *after* the response is sent, so the request-scoped session committed after the client had
  already moved on. Every test passed, because the test client cannot show the ordering. The
  first live simulation run crashed at 750 visitors when the second request for a visitor found
  no row. Fixed with `scope="function"` on the dependency, pinned by a test, and recorded as a
  landmine in the project instructions. Those 750 visitors are still in the table, and the
  README says so.
- **The scaffold that only looked finished.** The first review of the first story found the
  compose file demanding a file that is deliberately never committed, no migration to apply, and
  a request-tracing test whose assertion could not fail. A clean clone could not start. Caught
  by an independent review with the instruction to run it, not read it.
- **The admin console that shipped a credential.** The stack published a default admin token
  from the repository on every network interface. The reviewer reproduced the write from another
  machine on the same network. The token is now required with no default, and every port binds
  to loopback.
- **The recorder that trusted the browser.** The first funnel-event endpoint took a visitor id
  in the body, so anyone who knew an id could file a sign-up for someone else. Review caught it;
  the cookie the server set is now the only identity. The same review found the event ids
  minted with a browser API that does not exist on plain HTTP off localhost — a throw
  mid-render on any phone on the LAN.
- **Docs that described the design, not the build.** At the design handoff, two independent
  reviews found the same defect five times: the inventory named a tone-switching mechanism that
  was wired to nothing, so the urgent variant would have rendered in the calm colours. Caught
  because the reviewer was told to check every claim against the code. I caught the same kind
  of drift myself while writing the README: the plan still says Recharts and
  "17.8B" where the build has native bars and "17.7B". The README quotes the build.
- **Tests that passed for the wrong reason.** A test guarding the colour switch that could not
  fail; a "tagged with its visitor's arm" test that only checked *a* flag was stamped; a
  smaller-arm check that survived being changed to `max` because every test used equal arms.
  Each found by a reviewer asked to prove coverage by mutation, and each pinned by a test that
  now fails on the mutation.
- **The defect only a capture can see.** The dashboard's warning banner used the raw class
  string beside the hashed CSS-module class, so the tint never painted. Every jsdom test passed,
  because the test build compiles CSS modules non-scoped and cannot tell the two apart. The
  visual reviewer measured a grey banner. This is why the visual pass is a hard rule and not a
  courtesy.
- **A call beside a lift it could not state.** The recommendation could answer "ship" when the
  control had zero conversions and the relative lift was undefined, so the banner would have
  read "with high confidence" next to "not enough data". Review found it; a call now needs a
  statable lift as well as a significant test.

What did not go wrong is also worth a line: the test and interval formulas survived review
unchanged (the one defect was in the call built on them, above), the two hashing decisions
(Argon2id for the credential, SHA-1 only as the k-anonymity key, through a proxy) held up, and
no correctness defect was found in the three funnel screens.

## What I would do with more time

In the order I would do it:

1. **A sequential or Bayesian read beside the frequentist one.** The fixed-sample gate is the
   cheapest honest answer to peeking; a dashboard that is looked at daily deserves an
   always-valid p-value, or a posterior probability and expected loss a PM can act on before
   the full sample is in. ADR-0006 names this as the natural next step.
2. **The guardrail with its own interval on the dashboard,** and a peeking warning when the
   read is opened before the required sample.
3. **Real traffic.** The simulator encodes the effect it is asked for, so the read validates the
   pipeline and nothing about people. The hypothesis is only answered by real visitors.
4. **An identity and an audit trail behind `/admin`.** The shared token is a stated stopping
   point short of authentication; a real deployment wants to know who changed the split and
   when.
5. **A second experiment.** Today a visitor with two enabled flags is a loud failure of the
   event recorder rather than a silent misfiling; the event row would grow a per-flag tag
   before the second flag is enabled.
6. **The stated exposures:** the unauthenticated sign-up endpoint costs 64 MiB of memory per
   password hash and is not rate-limited (fine behind loopback, not fine on the internet);
   the event metadata field is unbounded on a public write; the catalogue refresh holds a
   database connection for the length of the HIBP call and belongs in a scheduled job once
   there is more than one worker.
7. **An end-to-end test against the real stack** for the one path that matters — landing to
   activation — so the commit-after-response class of bug is caught by a test and not by a run.
