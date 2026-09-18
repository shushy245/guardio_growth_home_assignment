# Breach Scan Funnel — Project Instructions

## HARD RULES — read before every response that involves code
**Never begin implementing a story unless explicitly asked in this session.**
**Read `docs/plan.md` in full before touching any code — it is the authoritative plan.**
**Backend is Python (FastAPI); map the global TS doctrine onto it via `docs/python-conventions.md`, never swap the stack.**
**Strict TDD, no exceptions: no production line without a failing test first; every commit is
`test+impl`, `refactor`, or `chore` as defined in `docs/plan.md` → TDD contract. Untested code is a
defect, not a shortcut.**
**Stop at plan stage D1 (before S5) and hand Shalev a Claude Design prompt; never build funnel UI without it.**
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
- One DB transaction per request (`app/db/session.py`); handlers never commit.
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

## What's done
Full history: `docs/changelog.md`; commit-level record: `git log`.

- **S3 — feature-flags (closed 2026-09-18).** The A/B test on the result screen had no machinery
  behind it: nothing decided which visitor saw which framing, and no product person could change
  the split or the wording without a developer and a deploy. A visitor now gets an identity on
  their first visit and is assigned a variant once, on the server, written down and never
  recalculated; `/admin` retunes the split, the headline, the subheadline and the button, or stops
  the test, live. A weight change moves new visitors only — what keeps the eventual read honest.
  **The review round is a third of the story.** What shipped first discarded every edit typed
  during a save and then displayed "Saved." over the reverted values; two tabs opened together made
  one person into two visitors under two different variants; and compose published a repo-committed
  admin token on every interface, reproduced from another machine on the LAN. 21 of the 23 findings
  are fixed over 25 commits, 2 carried to D1. 153 backend + 82 frontend tests.
  Technically: pure `assign_variant` on a `sha256` bucket (never `hash()`, salted per process);
  `feature_flag` / `visitor` / `visitor_assignment` with a seeded flag; PATCH as one
  `UPDATE … WHERE updated_at = :token RETURNING updated_at` stamped `clock_timestamp()`; the lock
  token a string end to end. From the review: `POST /api/visitors` reads its own cookie and answers
  200 with the stored assignments; `list_enabled_splits` refuses a stored split that does not cover
  the buckets; a rename that would orphan an assignment is a 400 naming it; nginx overwrites
  `X-Forwarded-For` with `$remote_addr`; every published port binds to loopback and `ADMIN_TOKEN`
  has no default. `FlagEditor` is its own unit with its own driver — the extraction that made
  BF24/25/39/43/44 reachable at all; `onSaved` applies only the token, inside the functional
  update. Two mutation proofs, four visual passes (`docs/reviews/s3-fixes-visual-review.md`).

- **S2b — catalog-refresh (closed 2026-09-18).** "Refreshed once a day" was only true across
  restarts: the copy was re-checked at boot and never again, so a backend that stayed up served an
  ageing catalog with no bound and nothing on the screen could say how old it was. Now every breach
  request answers from the stored copy at once and, past 24h, refreshes it in the background after
  replying; one refresh at a time per process, a down source retried five minutes later, and the
  summary reports `syncedAt`. Watched live: a 25h-old copy served in 16 ms, refreshed after the
  response under the same correlation id, next summary current; a boot that found HIBP down now
  heals on the first visit instead of answering 503 until a restart.
  Technically: `CatalogRefresher` (single-flight `threading.Lock`, retry gate re-checked under the
  lock) on `app.state`; `revalidate_catalog` called at the top of each handler (a router-level
  dependency would run before parameter validation) scheduling `BackgroundTasks`;
  `carry_background_tasks` so an `HTTPException` response still runs them; `synced_at` on the pure
  summary via `fetched_at` in `BreachFacts`; HTTP driver rebinds `app.state.session_factory` to the
  savepoint so background commits cannot leak; API-driver seeds are clock-relative. ADR-0002
  amended with the periodic-job trigger. Review: 14 findings, BF22–23 + hygiene fixed, one
  dismissed on a recorded precondition, three batched to RF-backlog. 121 backend + 33 frontend
  tests green.

- **S2 — breach-catalog (closed 2026-09-18).** The funnel had nothing to show: the breach data
  lived at HIBP, which can be slow or down, and sorting or filtering it would have meant pulling
  all 1,036 records into the browser. We now keep our own copy of the public record, refreshed
  daily, and answer every search, sort and page from it in one query — 1,031 servable breaches,
  17.7B exposed accounts, 65% of them leaking passwords. It keeps serving while HIBP is down, and
  an empty catalog is a visible error rather than a reassuring empty list.
  Technically: `breach` table + Alembic migration; `BreachCatalogPort` with an httpx2 HIBP adapter
  and an in-memory fake; idempotent `upsert_many` (last row per name, update set derived from the
  table); 24h TTL in a pure `should_sync`; boot-time sync that cannot fail the boot;
  `GET /api/breaches` with the full list contract (page/limit/sort/order/q/dataClass/verifiedOnly),
  `name` closing every sort so LIMIT/OFFSET is total, and one filter builder feeding both the count
  and the page; `GET /api/breaches/summary` over pure maths; 503 on an empty catalog, 200 on an
  empty filter result; frontend model layer with a calendar-day date parse. 136 tests green.

- **S1 — scaffold (closed 2026-09-17).** The stack starts from a clean clone with no setup step and
  serves a landing page plus `/api/health`; request tracing, the error contract and both test
  harnesses are proven rather than assumed. Technically: FastAPI app factory with `create_app(settings)`,
  `{ error }` on every non-2xx including unhandled exceptions, correlation id per request in
  structlog contextvars (proved with two concurrent requests), settings validated at startup
  (including the CORS origin), prefixed time-sortable ids, Alembic baseline migration, savepoint
  integration harness, Vite/React/Vitest with drivers and layout primitives, husky gate over
  tsc + eslint + vitest + ruff + mypy + pytest. 45 tests green.

## What's next
**S4 (funnel-events) — nothing started.** `docs/plan.md` → "S4 — funnel-events": every funnel step
recorded idempotently and tagged with the visitor's flag and variant. Five backend cases, four
frontend. Open it with `/story-start S4`.

**D1 is the pause point after S4 and before S5** — I stop and hand over a Claude Design prompt;
never build funnel UI without it. Its exit criteria now carry three measured findings from the S3
visual passes, to be answered by a token rather than a one-off override: the disabled Save at
2.58:1 (shown for the whole of every save, so it is the element carrying the in-progress signal),
14px body text against the 16px floor, and a 96–101 character measure at 768 and 1280.

Also carried: `api/breaches` (the hooks *and* `fetchBreaches`/`fetchBreachSummary`) is deferred to
S5 to be written red-first; and the landing placeholder has no `max-width`, so its content box runs
the full viewport — fine for one heading, not for the real screen S5 replaces it with.

The S3 review record: findings verbatim in `docs/reviews/s3-review.md` (827 lines, four independent
reviewers), the four visual passes over the fixes in `docs/reviews/s3-fixes-visual-review.md`,
triage and the six-phase execution order in `docs/plan.md`. **BF36 and BF42 are the only two items
left open, both deliberately, both now D1 exit criteria.**
