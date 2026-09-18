# Changelog

The product diary: one entry per story, newest first, in the words of someone who never saw the
code. Commit-level detail lives in `git log`; the plan holds what is still ahead.

## S3 — feature-flags (closed 2026-09-18)

- **Pain** — The A/B test on the result screen existed only on paper. There was no way to say
  which visitor should see which framing, no way for a product person to change the split or the
  wording without a developer and a deploy, and nothing that would let the funnel numbers be
  broken down by variant later.
- **Fix** — A visitor now gets an identity on their first visit and is assigned a variant once,
  on the server, which is written down and never recalculated *(instead of the browser deciding
  for itself, or the server re-deciding on every request)*. A small admin console at `/admin`
  lets product retune the traffic split, reword the headline, subheadline and button, or stop the
  test — live, with no redeploy.
- **Trade-off** — A change to the weights moves **new visitors only**; everyone already in the
  test keeps what they were shown, which is what keeps the eventual result honest but means a
  retune is not instant across the whole audience. The console is protected by a single pasted
  token rather than real accounts, and reads are open — a deliberate stopping point, recorded in
  the README, not an oversight.
- **Result** — Verified on the running stack through the proxy: a visitor is created, assigned,
  and returns the same variant when asked again; editing the button text with a valid token
  succeeds and the change is live immediately; saving without a token is refused; and saving
  against a version someone else has already changed is refused with an explanation instead of
  quietly overwriting their work.

## S2b — catalog-refresh (closed 2026-09-18)

- **Pain** — "Refreshed once a day" was only true across restarts: the copy of the public record
  was re-checked at boot and never again, so a backend that stayed up for a week quietly served a
  week-old catalog, and nothing on the screen could say how old it was.
- **Fix** — Every breach request now answers from the stored copy at once and, if that copy is
  more than a day old, refreshes it in the background right after replying *(instead of a
  scheduler, which would be the shape at scale, but whose only wiring is the one place our tests
  cannot reach)*. One refresh at a time per process, and a source that is down is tried again
  five minutes later, not on every visit. The summary now reports when the copy was last synced.
- **Trade-off** — The copy is refreshed only while there is traffic (a cold start still fills
  it at boot), and the refresh holds a database connection for the length of the HIBP call.
  Both are the accepted cost of one worker in compose; the ADR names the point at which a
  separate periodic job takes over.
- **Result** — Watched live against HIBP: a request over a 25-hour-old copy was answered in
  16 ms from the old rows, the refresh ran after it under the same correlation id, pulled all
  1,036 records in about a second, and the next summary reported the new sync time. A backend
  whose boot found HIBP down now heals itself on the first visit instead of answering 503 until
  someone restarts it.

## S2 — breach-catalog (closed 2026-09-18)

- **Pain** — The funnel had nothing to show a visitor: the breach data lived at HIBP, a third
  party that can be slow or unreachable, and searching or sorting it would have meant pulling all
  1,036 records into the browser and hoping the phone coped.
- **Fix** — We keep our own copy of the public breach record, refreshed once a day, and answer
  every search, sort and page from it in a single query *(instead of calling HIBP on each request
  and sorting the answer in memory)*.
- **Trade-off** — The copy can be up to a day old and there is now a schema to keep in step with
  HIBP's payload; calling through on every request would have stayed current to the minute but
  made the result screen exactly as fast and as available as someone else's API.
- **Result** — The screen's numbers are real and live: 1,031 breaches, 17.7 billion exposed
  accounts, and 65% of those breaches leaked passwords — and when HIBP is down the funnel keeps
  serving, while an empty catalog returns a visible error rather than a reassuring empty list.

## S1 — scaffold (closed 2026-09-17)

- **Pain** — A take-home is judged first on whether it runs, and this scaffold only looked
  finished: a clean clone could not start it (the compose file demanded a file that is deliberately
  never committed, and the database had no migration to apply), while the one test guarding request
  tracing turned out to assert nothing at all.
- **Fix** — Worked the review's fourteen findings one commit at a time: the stack now starts from a
  fresh clone with no setup step, request tracing is proven by two genuinely concurrent requests
  rather than a no-op assertion, and a malformed browser-origin setting now fails loudly at startup
  instead of silently blocking every request the browser makes.
- **Trade-off** — Two settings the later stories will need (the admin token and the HIBP user
  agent) were deleted rather than left sitting ready, so S3 and S6 each re-add one when its first
  real consumer arrives — the price of never shipping configuration that nothing reads.
- **Result** — `docker compose up -d --build` with no `.env` present serves the landing page and
  answers `/api/health` with 200 (verified live, not inferred); 45 tests green (28 backend, 17
  frontend) with type-checking and linting clean; 4 unused files deleted; the fix pass itself is
  +343 / −124 lines across 32 files (`git diff --stat`).
