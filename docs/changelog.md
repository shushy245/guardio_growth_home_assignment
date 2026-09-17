# Changelog

The product diary: one entry per story, newest first, in the words of someone who never saw the
code. Commit-level detail lives in `git log`; the plan holds what is still ahead.

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
