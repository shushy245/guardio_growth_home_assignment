# ADR-0001 — Stack: FastAPI + SQLAlchemy 2 on Postgres, sync throughout; Vite + React 19

Date: 2026-09-17 · Status: accepted · Story: S1

## Context

The brief mandates React on the front end and Python on the back end, mobile-web first, with a
database for sign-ups and funnel events. The house doctrine is written for TypeScript (Express,
Drizzle, Zod) and must be honoured in Python without inventing a bespoke framework. The reader
who owns this repo is new to Python and cannot validate backend choices by inspection, so every
choice should be the one a Python engineer would recognise as the default.

## Decision

- **FastAPI + Pydantic v2** for HTTP and boundary validation. Pydantic models on the route
  signature are the Zod-in-middleware analogue: invalid input never reaches the handler.
  Django was weighed (its admin would give the feature-flag page for free) and rejected: it
  drags a monolith into a "small Python backend" and would mean two admin surfaces.
- **SQLAlchemy 2 (typed `Mapped[]` classes) + Alembic**, forward-only. The FastAPI default;
  the Drizzle + drizzle-kit analogue. SQLModel, Tortoise, Peewee, Piccolo and raw psycopg rejected
  (immaturity, weak typing or migrations, or house rule against raw SQL).
- **Sync throughout**: `def` routes, sync sessions, sync `httpx2.Client`. FastAPI threadpools
  sync routes; the sync SQLAlchemy path is the mature one; it removes async-session mistakes the
  reader could not spot. Middleware is async because ASGI requires it.
- **Postgres 16 via docker-compose**, host port 5433 to avoid a local 5432.
- **Transaction Script** shape (Fowler, PoEAA): per entity `schemas.py`, `models.py`,
  `repository.py`, `router.py`, plus a pure logic module when logic exists. No service layer;
  no domain classes until an invariant demands one.
- **Ports & Adapters** only where the outside world enters: HIBP behind two `typing.Protocol`
  ports with in-memory fakes; the composition root is the only place real adapters are named.
- **Tooling**: uv, ruff (lint + format), mypy `--strict`, pytest; ESLint via
  `eslint-config-shalev`, Vitest, TypeScript 6 strict; one root gate runs both stacks.
- **Not applicable, stated so they are decisions**: outbox, DLQ and stale-update guards. There
  is no queue and no event publishing; the only "event" is an idempotent HTTP write.
- **Settings loader** is a fifteen-line explicit-mapping loader over a frozen Pydantic model
  rather than pydantic-settings, because pydantic-settings still reads the real environment when
  values are passed explicitly, which makes "missing variable fails loudly" untestable in a shell
  that happens to define the variable.

## Consequences

- Easier: everything maps to a page in the FastAPI or SQLAlchemy docs; mypy strict is the
  safety net a non-Python reader can trust; swapping HIBP is one adapter file.
- Harder: no free admin UI (a small React page is built instead); sync routes cap concurrency
  at the threadpool size, irrelevant at this scale; SQLAlchemy's session lifecycle must be
  learned once (`docs/python-primer.md`).
