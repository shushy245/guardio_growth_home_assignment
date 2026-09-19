# Breach Scan Funnel — Project Instructions

## HARD RULES — read before every response that involves code
**Never begin implementing a story unless explicitly asked in this session.**
**Read `docs/plan.md` in full before touching any code — it is the authoritative plan.**
**Backend is Python (FastAPI); map the global TS doctrine onto it via `docs/python-conventions.md`, never swap the stack.**
**Strict TDD, no exceptions: no production line without a failing test first; every commit is
`test+impl`, `refactor`, or `chore` as defined in `docs/plan.md` → TDD contract. Untested code is a
defect, not a shortcut.**
**D1 is closed (2026-09-19): the design exists and is translated. Never build funnel UI that is not the design — `docs/design/component-inventory.md` names the components and `frontend/src/styles/tokens.scss` holds every value; a deviation is recorded in the inventory or it is a defect.**
**VISUAL PASS — HARD RULE 5 in the global CLAUDE.md governs this; it is not restated here.**
Project-specific trigger only: run `git diff --name-only HEAD` and `git ls-files -o
--exclude-standard`; any path under `frontend/` that is not `*.test.*` / `*.driver.*` is a
rendered surface. The path check is mechanical on purpose — don't judge for yourself whether
something "counts as UI". The app serves at `http://localhost:5173`; `docker compose up -d`
alone serves a STALE baked image, so the reviewer must rebuild with `--build` before measuring.

## Recipes
- **First run on a clone:** `cp .env.example .env` first, then set `ADMIN_TOKEN` in it (`openssl rand -hex 24`) — compose has no default for it and refuses to start without one, naming the variable. Everything else non-secret still defaults. Then `docker compose up -d --build`. `pnpm test` needs the same `.env` (`test:backend` passes `--env-file ../.env`) plus the db on host port 5433 for the integration tests. Every published port binds to `127.0.0.1`, so the stack is reachable from this machine only — a phone on the LAN cannot reach it without deliberately rebinding.

## Project overview
Guardio take-home: mobile-first Breach Scan funnel on public HIBP data, a DB-backed **feature
flag** driving one A/B test on the result screen, stored funnel events, simulated traffic, and an
in-app statistical dashboard.
- `frontend/` — Vite + React 19 + TS strict; Vitest drivers; layout primitives in `src/ui/box.tsx`; axios seam `src/api/http-client.ts`.
- `backend/` — FastAPI + SQLAlchemy 2 + Alembic on Postgres; uv, ruff, mypy strict, pytest; sync throughout.
- `docker-compose.yml` — db (host port 5433), backend, frontend.

## Architecture
- Composition roots: `backend/app/main.py` (`create_app(settings)`) and `frontend/src/main.tsx`; `backend/app/asgi.py` is the only reader of `os.environ`.
- Ports & Adapters for HIBP: `backend/app/ports/*` Protocols, `backend/app/adapters/hibp/*` the only HIBP-aware code, `backend/tests/fakes/*` in-memory fakes swapped via `dependency_overrides`.
- Transaction Script backend: per entity `schemas.py` (Pydantic boundary) · `models.py` · `repository.py` · `router.py` · pure logic file. No service layer.
- One DB transaction per request (`app/db/session.py`), taken as `session: SessionDep`, committed **before** the response is sent (`scope="function"`); handlers never commit.
- Correlation id per request in structlog contextvars; `{ error }` on every non-2xx.
- Feature flag = Experiment toggle (Fowler): `feature_flag` table, optimistic lock on `updated_at`, server-side stored assignment.

## Key conventions (project-specific)
- Python forms of every house rule: `docs/python-conventions.md`. Backend test driver namespaces are `given / get / post / patch / then` (`then` = house `assert`).
- Migrations live in `backend/migrations/` (not `alembic/`, which shadows the library).
- `pnpm typecheck|lint|test` at the root run frontend **and** backend checks; `test:backend` includes integration tests and needs `docker compose up -d db`.
- New Python constructs get a section in `docs/python-primer.md` in the same story.

## Landmines — read before touching the named areas
- `structlog.testing.capture_logs` replaces the processor chain: pass `merge_contextvars` or bound fields vanish; and build the app **before** entering capture, since `create_app` reconfigures logging.
- Starlette ≥1.6 test client requires `httpx2`; the runtime HTTP client is `httpx2` too. Never add `httpx`.
- Writing a red test file in the same command as a commit trips the commit gate's typecheck; commit first, then write the red test.
- Web Crypto's `digest` resolves on Node's thread pool, a later event-loop turn `act` cannot flush: a driver chain that starts with a hash is order-dependent unless it drains `settleNativeAsyncWork()` (S6, F5 flaked once in three runs).
- FastAPI's default dependency scope runs a yield dependency's exit code *after* the response is sent; `TestClient` cannot show it. A new yield dependency whose exit must land before the client's next request takes `scope="function"` (S7: the commit did not, and the simulator's second request found no visitor).
- The fake network matches a route's path exactly (or a bare path against the request's pathname): a route registered on `/x` never answers `/x/segment`, and the miss is a silent 599, not a loud failure — register per segment (S6 review, R-2).

## What's done
Full history: `docs/changelog.md`; commit-level record: `git log`.

- **S8 — docs (closed 2026-09-19).** The repo could be run but not read: the README held a
  run recipe and the admin note, nothing answered the brief's first question, and the ADRs
  had no index. Now: a README a reviewer reads in minutes (run, product calls, experiment and
  flag how-to, the read and the call, stack, time spent), `docs/writeup.md` (approach, where
  AI helped, where it was wrong and how it was caught, more time), `docs/adr/README.md`. Both
  reader files cut by half on Shalev's note that the interviewer has seen dozens of these —
  **keep them short**. D1 verified on a clean clone: two commands, catalogue pulled, simulator
  run, 208 + 225 green. Claims audit: 14 findings, 6 correctness in the prose, 0 in the
  numbers, all fixed; `.env.example` now ships `ADMIN_TOKEN=` empty (BF65). 5 commits, no code.
  Technically: the docs quote the build, not the plan — the plan still says Recharts and
  17.8B; `/dashboard` renders counts, lift, CI, p, sample and the call, the three rates are
  API-only; the time figure is commit gaps ≤ 90 min summed (~16 h), method stated.

- **S7 — simulation-and-dashboard (closed 2026-09-19).** The experiment had a flag, stored
  assignments and a table of events, and no way to read them. Now: a simulator that walks
  visitors through the real API one browser each, `GET /api/experiments/{flagKey}/results`
  (two funnels, the three rates, the pooled z-test, the lift on both scales, the required
  sample and the call), and `/dashboard` with the hypothesis, the funnel by variant, the lift
  card and the banner. The call needs significance *and* the powered sample *and* a statable
  lift; the 4,000-visitor run reads `KEEP_RUNNING` at p = 0.008 (ADR-0006). 18 planned cases +
  B14 + R-1/R-2, 57 tests (225 backend, 208 frontend), 17 commits.
  Technically: the arm is the stored `visitor_assignment`, never the event tag; the hypothesis
  is `hypothesis_map` in code; `SessionDep = Depends(get_session, scope="function")` commits
  before the response is sent — B14, found live: FastAPI's default scope commits *after* the
  response and the simulator's next request found no visitor; the chart is native `meter` bars
  behind `charts/` with a library-agnostic series contract, the sample bar a native `progress`,
  no inline style anywhere; `$series-1/2` alias the tone accents against the dataviz validator
  (deviation 14). Review: 11 findings, 1 correctness (a ship call beside an unstatable lift),
  all closed; visual: V1–V10 across three runs, V9 the raw-class defect only a capture can see.
  Triage in `docs/plan.md`; record `docs/reviews/s7-visual-review.md`.

- **S6 — signup (closed 2026-09-19).** A visitor who tapped "Protect me" landed on a
  placeholder heading; the funnel's last two steps could never be recorded, so the A/B test had
  a conversion on paper and none in a table. Now: a plan picker, an email, a password checked
  against known leaks as it is typed (five characters of its hash leave the browser, through our
  proxy), stored as Argon2id, and a confirmation that records the activation. A visitor whose
  session failed still gets an account with no visitor attached (ADR-0004 amendment); the
  64 MiB-per-hash exposure on an unauthenticated endpoint is stated as BF59, not rate-limited.
  27 planned cases + F17, 51 tests added (192 backend, 184 frontend), 14 commits; accessibility
  100 on both screens; driven end to end in a real browser against the real leak API.
  Technically: `PwnedPasswordRangePort` is a second port with its own client and host
  (`api.pwnedpasswords.com`, `Add-Padding: true`); `PasswordHasher` wraps argon2 once, built in
  `create_app`; `SignupCreate` takes the password as `SecretStr` and lower-cases the email in a
  validator; `insert_signup` is `ON CONFLICT (email) DO NOTHING … RETURNING` (a 409 is the index's
  answer) over a `NewSignup` parameter object; `signup.visitor_id` is nullable. Frontend:
  `usePasswordLeakCheck` debounces, hashes with Web Crypto, aborts what it superseded, and keys
  the `PasswordCheck` union to the password it checked, so `wasPwned` is derived at submit for
  the password actually sent; `PlanPicker` is a radio group whose input is a 44px box with the
  20px ring painted inside; `Protected` reads the plan from router state behind a type predicate
  and tracks `activation` in a child the guard sits above. Testkit: `pwned-passwords.ts` answers
  a range per password, `native-async.ts` drains the thread-pool turn a native digest needs (the
  first F5 run was order-dependent without it), `web-crypto.ts` removes `subtle`,
  `renderWithProviders` takes router `state`, and `IS_REACT_ACT_ENVIRONMENT` is declared. Review:
  15 findings, 0 happy-path defects, 2 tests that passed for the wrong reason (fixed,
  mutation-proved), BF59 filed; visual: V1–V8, two fixed (44px radio, error association as F17),
  the spinner-on-disabled contrast fixed from the code review. Triage in `docs/plan.md`.

## What's next
**Full-codebase audit fix pass. Next.** Four Opus reviews (2026-09-19) are triaged in
`docs/plan.md` → "Full-codebase audit (four agents on Opus, 2026-09-19)": BF60–BF87 plus a
docs-drift list. **BF60 first**: the experiment read counts numerator and denominator steps
independently, so a rate can exceed 100% and the endpoint then answers a permanent 500. Record:
`docs/reviews/full-audit-2026-09-19.md`. S8 (docs) closed; E2 stretch stories (S9–S14) stand
behind the fix pass. Reader-facing docs stay short — a change to behaviour updates the README in
the same commit, in as few words as the fact needs.

Carried, deliberately: the design's `Button` ghost variant has no consumer and is not built; the
`/admin` variant cards are not tinted by tone (deviation 6); BF58 (admin flag-list effect under
StrictMode) and BF59 (Argon2 memory × concurrency on an unauthenticated route) stand; DV3 and the
unmeasured authenticated `/admin` states from D1 stand. Unmeasured in S7: the `ship` and `stop`
banners, the loading and error states, non-text contrast of the bar fills, real reduced motion.
RF-backlog (S7): R-8, V5, V9's precondition — see the S7 triage in `docs/plan.md`.

Review records: `docs/reviews/full-audit-2026-09-19.md`, `docs/reviews/s7-visual-review.md`, `docs/reviews/s6-visual-review.md`,
`docs/reviews/s5-visual-review.md`, `docs/reviews/s3-review.md`,
`docs/reviews/s3-fixes-visual-review.md`, `docs/reviews/d1-visual-review.md`, and the S4–S7
triages in `docs/plan.md`.
