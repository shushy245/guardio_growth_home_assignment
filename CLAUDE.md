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
- **First run on a clone:** `docker compose up -d --build` works with no `.env` (compose inlines the non-secret defaults). `cp .env.example .env` is still the first step for local work: `pnpm test` needs it (`test:backend` passes `--env-file ../.env`) plus the db on host port 5433 for the integration tests.

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
`/story-start S3` (feature-flags). Carry into it: the forwarded S1 case that nginx must pass
`X-Forwarded-For`/`X-Forwarded-Proto` before the `Secure` cookie logic (B14) can be trusted behind
the proxy, and the S2 note that the `/admin` token is pasted into the page and held in React state
only — never `VITE_*`, never localStorage.

Before S5, two carried items: the urgent variant's copy says "17.8B accounts have leaked" but the
servable total the API reports is **17.7B** (17,713,315,945) — match the copy to the number the
summary actually returns; and `api/breaches` (hooks *and* `fetchBreaches`/`fetchBreachSummary`) is
deferred there to be written red-first.
