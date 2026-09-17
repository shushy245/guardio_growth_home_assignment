# Breach Scan Funnel — Project Instructions

## HARD RULES — read before every response that involves code
**Never begin implementing a story unless explicitly asked in this session.**
**Read `docs/plan.md` in full before touching any code — it is the authoritative plan.**
**Backend is Python (FastAPI); map the global TS doctrine onto it via `docs/python-conventions.md`, never swap the stack.**
**Strict TDD, no exceptions: no production line without a failing test first; every commit is
`test+impl`, `refactor`, or `chore` as defined in `docs/plan.md` → TDD contract. Untested code is a
defect, not a shortcut.**
**Stop at plan stage D1 (before S5) and hand Shalev a Claude Design prompt; never build funnel UI without it.**

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

- **S1 — scaffold (closed 2026-09-17).** The stack starts from a clean clone with no setup step and
  serves a landing page plus `/api/health`; request tracing, the error contract and both test
  harnesses are proven rather than assumed. Technically: FastAPI app factory with `create_app(settings)`,
  `{ error }` on every non-2xx including unhandled exceptions, correlation id per request in
  structlog contextvars (proved with two concurrent requests), settings validated at startup
  (including the CORS origin), prefixed time-sortable ids, Alembic baseline migration, savepoint
  integration harness, Vite/React/Vitest with drivers and layout primitives, husky gate over
  tsc + eslint + vitest + ruff + mypy + pytest. 45 tests green.

## What's next
`/story-start S2` (breach-catalog). Carry into it: the forwarded S1 cases in `docs/plan.md` →
"S1 — review triage" (prove the `get_session` override seam in an integration test; delete both
probe routes in C13) and the note that DTO optional fields must be `field?: T | undefined` under
`exactOptionalPropertyTypes`.
