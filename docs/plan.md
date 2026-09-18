# Breach Scan Funnel — Plan

Authoritative plan. `/story-start <id>` reads the story's section; `/story-done <id>` checks it off.
Source brief: Guardio "Fullstack Engineer (growth) - Home Exercise" (Notion; link in project memory).

## Context

Guardio's take-home: a mobile-first Breach Scan funnel (React + Python) on public HIBP data, one
A/B test on the result screen driven by a **feature flag** that product can retune without a
redeploy, funnel events stored per visitor and tagged with variant, simulated traffic, an in-app
dashboard that reads the test with real statistics, and a write-up. Judged in order: product
judgment, full-stack depth, working with AI, polish. Time budget: **one working day core** (E1),
day-two extras as stretch (E2).

The assignment mandates Python on the backend, so the global Express/Drizzle defaults are mapped
onto Python equivalents; the *doctrine* (boundary validation, list contract, optimistic locking,
structured logging, functional core, TDD) carries over unchanged.

## TDD contract (non-negotiable for every commit in this plan)

1. **No production line without a failing test that demands it.** Red → Green → Refactor, one
   case at a time. Watch the test fail before making it pass.
2. **Every commit below is one of three kinds:** `test+impl` (one case red → green, minimal
   code), `refactor` (structure only, tests stay green), or `chore` (tooling/config with no
   behaviour, e.g. compose file, lint config). Nothing else exists.
3. **Commit on every green.** Never commit red. The commit gate runs typecheck + tests + lint.
4. **Coverage is a byproduct, but untested code is a defect.** A `/story-done` case-coverage diff
   with a planned case lacking a test blocks the story from closing.
5. **Pure logic gets bare `expect`/`assert` unit tests; anything with DOM, HTTP or DB goes through
   a driver** (frontend: `*.driver.tsx`, written before the component; backend: an HTTP driver
   over the FastAPI `TestClient` with `given.* / get.* / post.* / assert.*`).
6. **Fakes over mocks.** HIBP and Pwned Passwords are behind adapter ports with in-memory fakes;
   integration tests hit a real Postgres, never a mocked session.
7. **Test names are behaviour sentences**, mirrored from the `Cases:` list so the coverage diff is
   mechanical.

## Decisions (each earns an ADR in `docs/adr/` when implemented)

| Decision | Options weighed | Chosen and why |
|---|---|---|
| Backend framework | FastAPI / Flask / Django | **FastAPI + Pydantic v2**. Pydantic is the Zod analogue: schema first, type derived, validation at the boundary before the handler runs. Django was weighed seriously (its admin UI would give the flag page for free) but drags a monolith into a "small Python backend" and would mean two admin surfaces; not used anywhere. |
| Persistence | SQLAlchemy 2 + Alembic / Django ORM / SQLModel / Tortoise, Peewee, Piccolo / raw psycopg | **SQLAlchemy 2 (typed `Mapped[]` classes) + Alembic**, forward-only migrations. The industry default for FastAPI; Drizzle + drizzle-kit analogue. SQLModel rejected (immature, Pydantic v2 rough edges, hides rather than replaces SQLAlchemy); small ORMs rejected (niche, weak typing/migrations); raw SQL rejected by house rule. Usage kept thin: one session per request, one repository module per entity. |
| Python tooling | none / flake8+black / ruff+mypy | **ruff (lint + format) + mypy `--strict` + pytest**, wired into the same husky commit gate as the frontend. mypy strict is the `tsc --strict` analogue and the reason untyped Python cannot land. |
| Backend shape | Domain Model / Transaction Script | **Transaction Script (Fowler, PoEAA)**, deliberately: simple domain, no invariants that earn a class. Each entity = `schemas.py` (Pydantic boundary), `models.py` (SQLAlchemy), `repository.py` (thin DB functions), `router.py` (thin shell), plus a pure `*.py` when there is logic. No service layer. |
| External APIs | Call HIBP inline / ports & adapters | **Ports & Adapters.** `app/ports/` holds two `typing.Protocol` interfaces: `BreachCatalogPort.fetch_all()` and `PwnedPasswordRangePort.fetch_range(prefix)`. `app/adapters/hibp/` is the only place that knows HIBP URLs, headers or wire shape and translates into our model. `tests/fakes/` implements the same Protocols in memory. The composition root wires real adapters; tests swap fakes via FastAPI `dependency_overrides`. Replacing HIBP = one adapter file + one line in `main.py`. |
| Admin protection | none / env token / full auth | **Env-configured admin token** (`X-Admin-Token`) required on flag PATCH → 401 otherwise. Full auth is out of scope; an open write endpoint is not acceptable for a security company's take-home. **Delivery:** `/admin` has no login screen — the operator pastes the token into a field on the page and it lives in React state for that session only. Never in the Vite build (`VITE_*` ships it to every visitor) and never in `localStorage`. Reads (`GET /api/feature-flags`) stay open; only the write is gated, so an unauthenticated page is a harmless one. |
| Cookies & CORS | defaults / explicit | Visitor cookie `HttpOnly; SameSite=Lax; Secure` outside dev. CORS allow-list = configured frontend origin only. |
| DB / runtime | Postgres in docker-compose / SQLite | **Postgres 16 via docker-compose.** One `docker compose up` runs db + backend + frontend. |
| Breach data | Proxy per request / in-memory cache / persist | **Persist to a `breach` table** with `fetched_at`, synced on startup and refreshed stale-while-revalidate from the request path once it is 24h old (S2b: single-flight per process, 5-minute retry interval, `syncedAt` on the summary). Enables server-side sort/filter/summary and keeps the funnel alive if HIBP is slow. If HIBP fails *and* the table is empty, the scan fails visibly (`503 { error }`), never fake data. |
| Feature flag home | DB + admin page / GrowthBook container / DB only | **DB table + barely-designed `/admin` page.** Fowler taxonomy: an *Experiment* toggle, product-owned, medium lifetime. |
| Variant assignment | Client hash / server hash / random + store | **Server-side, stored.** `POST /api/visitors` creates the visitor, hashes `visitor_id:flag_key` into [0,100) against the flag's live weights, persists the assignment. Stable across refreshes via cookie + DB row; changing weights only affects *new* visitors (documented). |
| Password check | Client → HIBP directly / backend proxy | **Browser hashes with Web Crypto SHA-1, backend proxies the range call** with `Add-Padding`. Full hash never leaves the browser; proxy gives structured logging and a fail-visible seam. |
| Password storage | Reuse SHA-1 / bcrypt / Argon2id | **Argon2id via `argon2-cffi`** (OWASP Password Storage Cheat Sheet's first recommendation; bcrypt is its fallback). Unsalted SHA-1 as a credential is wrong for a security company; the write-up says so. SHA-1 is used only for the k-anonymity check and never stored. |
| Analysis | Dashboard / notebook / both | **In-app dashboard**, parameterised by flag key so it points at the next test. |
| Stats | z-test / chi-square / Bayesian | **Two-proportion z-test + 95% CI on absolute and relative lift + sample-size adequacy vs a stated MDE** (`scipy`). Bayesian is stretch. |
| Charts | Hand SVG / Recharts | **Recharts**, wrapped once in a `charts/` adapter. Load the `dataviz` skill before chart code. |
| Frontend tooling | Ad hoc / `/project-init` | **Vite + React 19 + TS strict, `/project-init` (eslint-config-shalev, husky gate), Vitest + testing-library + drivers.** Root `package.json` with `frontend` workspace; backend is Python outside the workspace. |

## Repository layout

```
/
  docker-compose.yml           db + backend + frontend
  package.json                 workspaces: ["frontend"]  (project-init anchor)
  CLAUDE.md                    project file
  docs/plan.md  docs/adr/  docs/changelog.md  docs/python-primer.md (TS → Python map for the reader)
  backend/
    pyproject.toml             uv-managed; fastapi, sqlalchemy, alembic, psycopg, httpx, argon2-cffi, scipy, structlog; dev: pytest, ruff, mypy
    app/main.py                composition root: config read, adapters built, routers mounted — the only place real adapters are named
    app/config.py              pydantic-settings; env validated at startup
    app/logging.py             structlog JSON, correlation-id middleware
    app/db/                    engine, session dep, alembic/
    app/ports/                 breach_catalog.py, pwned_password_range.py — typing.Protocol interfaces, no I/O
    app/adapters/hibp/         breach_catalog.py, pwned_password_range.py — httpx, HIBP URLs/headers, wire→model translators
    app/breaches/              models.py schemas.py repository.py sync.py (uses the port) summary.py (pure) router.py
    app/feature_flags/         models.py schemas.py repository.py assignment.py (pure) router.py
    app/visitors/              models.py schemas.py repository.py router.py
    app/funnel_events/         models.py schemas.py repository.py router.py
    app/signups/               models.py schemas.py repository.py password_hash.py router.py
    app/pwned_passwords/       router.py (proxies through the port)
    app/experiments/           stats.py (pure) results.py (query + assemble) router.py
    app/shared/                ids.py (generate_unique_id), html.py (strip tags, stdlib)
    scripts/simulate_traffic.py
    tests/unit/  tests/integration/  tests/drivers/  tests/fakes/ (port fakes)  tests/builders/
  frontend/
    src/main.tsx               composition root: providers, router
    src/layout/                Box Row Column FullBox FullRow FullColumn
    src/models/<entity>/       model.ts translator.ts selectors.ts index.ts
    src/api/                   axios client + per-entity hooks (no TanStack)
    src/providers/             VisitorProvider (id + variants), AnalyticsProvider (track())
    src/pages/                 Landing Scan Result Signup Protected Admin Dashboard
    src/components/            BreachList BreachSummary BreachFilters PlanPicker PasswordField FunnelChart LiftChart
    src/testkit/               builders/ drivers/ setup.ts renderWithProviders
```

## Data model (Postgres)

- `breach` — pk `name`; title, domain, breach_date, added_date, modified_date, pwn_count, description (HTML stripped), logo_path, data_classes `text[]`, is_verified, is_fabricated, is_sensitive, is_retired, is_spam_list, is_malware, is_stealer_log, is_subscription_free, attribution, disclosure_url, fetched_at. Indexes on breach_date, pwn_count, GIN on data_classes.
- `feature_flag` — pk `key` (`result_screen_tone`), description, is_enabled, variants `jsonb` `[{key, weight, config:{headline, subheadline, ctaLabel, tone}}]`, created_at, updated_at (lock token).
- `visitor` — pk `id` (`vis_` + sortable base-62), created_at, user_agent.
- `visitor_assignment` — pk (visitor_id, flag_key), variant_key, assigned_at.
- `funnel_event` — pk `id` (client-generated `evt_` id → idempotent `ON CONFLICT DO NOTHING`), visitor_id, name (enum), flag_key, variant_key (denormalised: "tag every step"), occurred_at, metadata jsonb.
- `signup` — pk `id` (`sup_`), visitor_id, email (unique, lower-cased), plan (enum), password_hash, password_was_pwned, created_at.

## API contract (JSON, errors `{ error }`, correct status codes)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/visitors` | `201 { id, assignments: { flagKey: variantKey } }`; sets `visitor_id` cookie |
| GET | `/api/visitors/{id}` | assignments for an existing visitor (refresh path) |
| GET | `/api/breaches` | `page`, `limit`, `sort` (`breachDate\|pwnCount\|name`), `order`, `q`, `dataClass`, `verifiedOnly` → `{ items, total, page, limit }` |
| GET | `/api/breaches/summary` | total breaches, total pwned accounts, breaches last 12 months, largest breach, most recent breach, top data classes, share exposing passwords |
| POST | `/api/funnel-events` | `201 {}`; body `{ id, visitorId, name, occurredAt, metadata }`; server stamps flag/variant from stored assignment |
| GET | `/api/pwned-passwords/range/{prefix5}` | proxies HIBP, `text/plain`; `503 { error }` on upstream failure |
| POST | `/api/signups` | `201 { id, createdAt }`; plan ∈ `basic\|family` |
| GET · PATCH | `/api/feature-flags` · `/api/feature-flags/{key}` | PATCH requires `updatedAt` token → `409` on mismatch, returns `200 { updatedAt }` |
| GET | `/api/experiments/{flagKey}/results` | per-variant step counts, rates, lift, CI, p-value, sample adequacy, recommendation enum |

## Feature flag → result screen

Flag `result_screen_tone`, two variants, 50/50 default:
- `calm`: headline "Known breaches", sub "Here's the public record of data breaches.", CTA "Protect me", neutral tone.
- `urgent`: headline "You're exposed!", sub "17.8B accounts have leaked. Yours could be among them.", CTA "Protect me now", red tone, pwn-count count-up.

Copy, weights and enabled-state are edited on `/admin`. The Result page reads the variant config from `VisitorProvider`; tone maps to a class via a `toneClassMap`, never an if-chain.

## Product decisions on the result screen (README records these as decisions, not gaps)

- **Summary highlights**: breaches in the last 12 months, total accounts exposed, share of breaches that leaked passwords, the single largest breach. Each maps to a reason to buy protection.
- **Default sort**: breach date, newest first. Alternatives: most accounts, name.
- **Filters**: text search on name/domain, data-class chip, verified-only toggle. Hide `IsRetired`/`IsFabricated` by default. A year range was considered and cut: it is the worst of the four on a 390px thumb and the breachDate sort already answers "what is recent". Recorded as a decision, not an omission.
- **Pagination**: 20 per page, "load more" on mobile.

## Responsive contract (the brief says "mobile-web first **and responsive**")

- **Breakpoints named once** in `frontend/src/styles/tokens.scss`: `sm` 390 (primary, the design
  target), `md` 768, `lg` 1280. Every screen is built at 390 and must hold at 768 and 1280 — the
  reviewer opens the repo on a laptop before they ever open it on a phone.
- **Responsiveness is CSS-only.** No width branch in JSX, no `matchMedia` in a component, no
  `isMobile` prop or state. One DOM tree serves every width; the layout primitives (`Row`/`Column`)
  and `.module.scss` media queries do the work. This is load-bearing for the tests: a width branch in
  JS would mean every S5 driver test silently covers one viewport and quietly ignores the other two.
- **What reflows** (decided in D1, implemented in S5): the sticky bottom CTA becomes an inline CTA in
  the header region at `md`+; summary tiles go 2×2 → one row of four; the list gets a max content
  width and centres instead of stretching to 1920px; filter chips stop scrolling horizontally once
  they fit.
- **Verified, not assumed.** jsdom has no layout engine, so no Vitest test can prove any of this. S5
  C11 is a manual Chrome pass at 390 / 768 / 1280 over Landing, Scan, Result (both variants), Signup,
  Protected and the Dashboard, recorded in `docs/changelog.md` with what was wrong and what was fixed.
  "Responsive" with no observed check is a claim, not a result.

## Experiment design

- **Hypothesis**: an urgent framing of the result screen raises the activation rate (visitors who reach `scan_completed` and go on to `activation`) by at least 20% relative (e.g. 8% → 9.6%).
- **Primary metric**: activation / scan_completed per variant. **Secondary**: cta_click / scan_completed. **Guardrail**: activation / cta_click.
- **Events**: `landing_view, scan_started, scan_completed, cta_click, signup_started, activation`.
- **Read**: two-proportion z-test on the primary metric, 95% CI on absolute and relative lift, required sample per arm for the stated MDE at α=0.05, power 0.8, recommendation `SHIP_VARIANT | KEEP_CONTROL | KEEP_RUNNING`.
- **Simulation**: `simulate_traffic.py --visitors 4000 --activation calm=0.08 urgent=0.10` drives the real HTTP API step by step with per-step drop-off. README states plainly that the simulator *encodes* the effect, so the read validates the pipeline and the statistics, not the hypothesis.

---

## How to read a story

- **Cases** — the behavioural spec. Each becomes a test named with the same sentence.
- **Commits** — the ordered TDD loop. `C<n>` is a commit; `[test+impl <case ids>]` means those
  cases go red then green in that commit; `[refactor]` and `[chore]` as defined in the TDD contract.
  A story's commits are executed top to bottom; the outer (integration/driver) test may stay red
  across several inner commits — that is "incomplete", not "broken" — but every commit's own
  tests are green.

---

## E1 — Core funnel, experiment, and read (~9–10h honest estimate; "one working day" stretched by the security and result-screen additions)

Standards checklist this epic is held to (from the global doctrine; N/A items stated so they are
decisions, not omissions):
- Boundary validation: Pydantic models on every route signature (the Zod-in-middleware analogue) — the handler never sees raw input.
- List-endpoint contract on `GET /api/breaches` from the first commit that serves it.
- Optimistic locking on the only user-editable entity (`feature_flag.updated_at`).
- Idempotent consumer: `funnel_event` insert is `ON CONFLICT DO NOTHING` on a client-generated id.
- Outbox / DLQ / stale-update guards: **N/A** — no queue, no event publishing; the only "event" is an HTTP write. Recorded in ADR-0001.
- Structured logging with correlation ids from S1; function-name-prefixed messages with entity ids.
- Prefixed sortable ids via `generate_unique_id(prefix)`.
- Composition root: `main.py` only; ports injected; fakes swapped in tests.
- Functional core: `assignment.py`, `stats.py`, `summary.py`, `strip_html`, `formatCount`, `buildBreachesQuery` are pure and unit-tested with bare asserts.
- Never synthetic data: HIBP outage with an empty table is a visible 503.
- No secrets in code: admin token, DB URL, origins from env; `.env.example` documents them.

### S1 — scaffold (~1h)

Objective: `docker compose up` serves a hello page and `/api/health`; tooling, logging and both
test harnesses in place so every later story starts from a red test.

Cases:
- B1. health endpoint returns 200 `{ "status": "ok" }`
- B2. unknown route returns 404 `{ error }`
- B3. a request failing Pydantic validation returns 400 `{ error }` (probe route, deleted in S2 once a real one exists)
- B4. every response carries `x-correlation-id`; an inbound one is echoed back
- B5. startup raises a clear error when `DATABASE_URL` is missing
- B6. integration harness: a test can open a session against the compose Postgres and roll back
- B7. a request from an origin outside the configured allow-list gets no CORS allow header
- B8. `generate_unique_id('vis')` returns `vis_` + 26 chars; ids created at increasing milliseconds (injected clock) sort lexicographically by creation; 1,000 same-millisecond ids are unique
- F1. `App` renders the landing route at `/` (smoke through `renderWithProviders`)
- F2. layout primitives `Row`/`Column` apply the expected flex direction class (pure render test)
- Pre-mortem (added at /story-start):
  - B4b. a 404 and a 400 response also carry `x-correlation-id`
  - B4c. two overlapping requests with different inbound correlation ids each receive their own back (contextvar, not a module global)
  - B5b. `create_app(settings)` takes settings as a parameter; tests never rely on process env
  - B6b. a row written through the API in one integration test is not visible in the next (savepoint rollback)

Commits:
- C1 `[chore]` root `package.json` (workspace `frontend`), `docker-compose.yml` (postgres:16, backend, frontend), `.env.example`, `.gitignore`
- C2 `[chore]` backend `uv init`, deps, ruff + mypy `--strict` config, `pytest` unit config, HTTP driver skeleton (`tests/drivers/http.py`: `given.* / get.* / post.* / patch.* / assert.status / assert.error`)
- C3 `[test+impl B1]` FastAPI app factory + `/api/health`
- C4 `[test+impl B2, B3]` `{ error }` exception handlers for 404 and validation errors, probe route
- C5 `[test+impl B4]` correlation-id middleware + structlog JSON config
- C6 `[test+impl B5, B7]` pydantic-settings config validated at startup; CORS allow-list; composition root in `main.py`
- C7 `[test+impl B8]` `shared/ids.py` prefixed time-sortable ids (ULID body)
- C8 `[chore]` Alembic wired, empty initial migration, integration pytest config + `conftest` transaction-rollback fixture
- C9 `[test+impl B6]` integration harness proves round-trip against compose Postgres
- C10 `[chore]` Vite + React 19 + TS strict, react-router, axios client, Vitest + testing-library + `setup.ts` + `renderWithProviders`
- C11 `[test+impl F2]` layout primitives with `.module.scss`
- C12 `[test+impl F1]` `App` with router and a placeholder landing route
- C13 `[chore]` `/project-init`: project CLAUDE.md merge, eslint-config-shalev stub, husky commit gate running tsc + vitest + eslint **and** ruff + mypy + pytest
- C14 `[chore]` Dockerfiles (non-root user, pinned base images, `uv.lock` / `package-lock.json` honoured); `docker compose up` verified manually; ADR-0001 stack; `docs/python-primer.md` extended with every construct S1 introduced

### S1 — review triage (Opus, 2026-09-17) — **all closed 2026-09-17**, one commit per item

Review ran on Opus as a separate agent (never a fork; see memory `no-fable-for-code-reviews`).
Findings 1 and 2 (unhandled-exception 500 path; inert `integration` marker) were fixed first.
BF1–BF14 are all fixed and committed (`a8398e5`…`7e6a45a`), one commit each, behaviour changes
red first. Where a fix covered code that already worked (BF5's null seam, BF7's `joinClassNames`),
the tests were written first and proven non-vacuous by mutating the implementation and watching
them fail; BF1's replacement test was proven the same way against a module-global correlation id.

Correctness / robustness (fix before S1 closes):
- [x] BF1 `backend/tests/drivers/http.py` `then.no_bound_log_context` is vacuous (TestClient runs the app on another thread, so the test thread never sees the request's contextvars; the assertion held even with `clear_contextvars` neutered). **Delete it** and write the real B4c test: two overlapping requests through `httpx2.AsyncClient(transport=ASGITransport(app))` + `asyncio.gather` (run via `asyncio.run` inside a sync test), asserting each response echoes its own `x-correlation-id` and each captured log line carries its own id. Driver: `when.two_overlapping_requests(ids)`, `then.each_echoed_its_own_id()`, `then.each_log_line_carried_its_own_id()`.
- [x] BF2 `docker-compose.yml:22` `env_file: .env` fails `docker compose up` on a clean clone (`.env` is gitignored). Make it optional (`env_file: [{ path: .env, required: false }]`), inline non-secret defaults under `environment:`, and add a CLAUDE.md recipe `cp .env.example .env`. Also `package.json` `test:backend` uses `uv run --env-file ../.env`, which fails without `.env`; the recipe covers it.
- [x] BF3 `backend/migrations/versions/` is untracked and there is no initial revision, so a clean clone cannot `alembic revision --autogenerate` and `upgrade head` in the harness is a no-op. Generate the empty initial migration (planned C8) so `versions/` is tracked.
- [x] BF4 `backend/app/config.py` `frontend_origin: str` is unvalidated; `FRONTEND_ORIGIN=http://localhost:5173/` (trailing slash) boots cleanly and blocks every browser request silently, because Starlette's CORS compares `Origin` exactly. Validate as an origin (scheme + host[:port], no path, no trailing slash) in `load_settings` so it fails loudly like the other variables. Red test: `test_frontend_origin_with_a_path_or_trailing_slash_fails_loudly`.
- [x] BF5 `frontend/src/api/http-client.ts` `normaliseNulls` + `isPlainObject` + interceptor is production logic with no test and no caller (committed as a `[chore]`). Extract to `http-client.utils.ts` and add `http-client.utils.test.ts` (bare `expect`): null → undefined at top level, nested object, array, non-null passthrough. Note for S2: DTO optional fields must be declared `field?: T | undefined` (house style) because `exactOptionalPropertyTypes` rejects `{ a: undefined }` for `{ a?: string }`.

YAGNI (delete; fix now, each trivial):
- [x] BF6 `backend/app/config.py` `admin_token` and `hibp_user_agent` are required settings with no consumer until S3 and S6; remove them (and from `.env.example`, `tests/builders/settings.py`) so the app boots with `env`, `database_url`, `frontend_origin` only. S2 C4b re-adds `hibp_user_agent`; S3 C7 re-adds `admin_token`, each red-first. Keep the CORS `X-Admin-Token`/`PATCH` entries (config a planned story depends on; a missing entry surfaces only in a browser).
- [x] BF7 `frontend/src/ui/box.utils.ts` drop `style?: CSSProperties` from `BoxProps` and the six spreads in `box.tsx` (inline styles are banned; the prop invites them). Move the `Primitive` enum into `box.driver.tsx` (its only consumers are the driver and test). Give `joinClassNames` a `box.utils.test.ts` (bare `expect`) covering undefined and empty-string inputs, or drop the `''` branch.
- [x] BF8 delete `frontend/.dockerignore` (no build uses `frontend/` as context; the root one applies), `allowImportingTsExtensions` from `frontend/tsconfig.json` (unused), and `backend/scripts/` plus the `COPY scripts ./scripts` Dockerfile line (S7 re-adds them).

Conventions (fix now, each trivial):
- [x] BF9 test ids follow the access-path invariant: `LandingTestIds.Page = 'LandingTestIds.Page'` (`docs/testing-conventions.md` §test ids); same for any id S5 adds.
- [x] BF10 `when.created()` is always `async` and awaited (`App.driver.tsx`, `box.driver.tsx`, both test files); `renderWithProviders` returns `void`.
- [x] BF11 `backend/app/shared/ids.py` `generate_unique_id_at(prefix, *, timestamp_ms)` → keyword-only `prefix` too. Add to its docstring: python-ulid's `from_timestamp` treats a float as seconds and an int as milliseconds, so `timestamp_ms / 1_000` must stay a float division.
- [x] BF12 `backend/app/config.py` `extra="forbid"` is unreachable (`load_settings` filters to `model_fields` first); remove it.
- [x] BF13 rename overclaiming tests: split `test_dev_logs_to_console_and_every_other_env_logs_json` into one test per env (or name the map under test); rename `'every primitive renders its children'` to `'Row renders its children'`.
- [x] BF14 `docs/python-conventions.md` "Real store only in integration tests" row: enforcement is now the path-based marker hook in `tests/conftest.py`; update the row.

Forwarded cases (not S1 work):
- S2: first case **"a row written through the API in one integration test is not visible in the next"** — the `get_session` dependency and the driver's `dependency_overrides` seam have zero callers in S1; S2 C5 (`GET /api/breaches`) is the first consumer and must prove the seam. Also delete both probe routes in S2 C13.
- S3: nginx must forward `X-Forwarded-For` / `X-Forwarded-Proto` before the `Secure` cookie logic (B14) can be trusted behind the proxy; add as an S3 case.

RF-backlog additions (batched, not now):
- `box.driver.tsx` `TEST_ID = 'primitive-under-test'` is a raw string, not access-path form. The
  invariant is about ids in production markup and this one never reaches it, so it was left —
  decide once whether driver-rendered fixtures are in scope for the rule, and apply the answer
  everywhere at once.
- Pre-mortem case B5b (`create_app(settings)` takes settings; tests never rely on process env) has
  no named test. It is covered structurally — every unit test builds the app from `a_settings()`,
  and `pytest -m "not integration"` is green with no environment at all — but a reader has to infer
  that. Decide whether the structural proof is enough or whether it earns an explicit test.
- Collapse the two order-dependent harness tests (`tests/integration/test_harness.py`) into one that writes through the fixture session and asserts absence over a separate connection from `engine`.
- Consider pure-ASGI middleware over `BaseHTTPMiddleware` for the correlation id (structlog's own FastAPI example); only if a concrete problem appears.
- Commit `9fec898` merged a `[chore]` (Alembic wiring) with a `[test+impl]` (harness); keep kinds pure going forward.

### S2 — breach-catalog (~1.5h) — **closed 2026-09-18**

Objective: HIBP catalog persisted and served through the full list contract plus a summary endpoint.

Cases:
- B1. HIBP adapter translator maps a raw HIBP record to our `Breach` model, stripping description HTML (stdlib `html.parser`) and normalising `null` → `None`; the model has no HIBP-specific field names
- B1b. `strip_html('<a href="x">Hi</a> there')` → `'Hi there'` (pure, stdlib)
- B1c. (added in C2, from the real payload) HIBP writes "no domain" as `""` in 54 of 1,036 records; the translator reads it as absent (`None`), never an empty string
- B1d. (added in C2) a payload that is no longer HIBP's shape raises `BreachCatalogError` naming the offending index and wire field — never a half-populated breach
- B2. sync upserts every record from the fake `BreachCatalogPort` and is idempotent on a second run (same row count, updated `fetched_at`)
- B3. sync is skipped when `fetched_at` is younger than 24h and runs when older (pure `should_sync` + service test)
- B3b. (added in C4b) the adapter asks HIBP for `/breaches` with the configured user agent — HIBP answers 403 to a consumer that does not identify itself
- B3c. (added in C4b) an unreachable HIBP, a non-2xx answer, or a 200 whose body is not JSON each become a `BreachCatalogError` naming the cause
- B3d. (added in C4b) `HIBP_USER_AGENT` is a required setting; missing → `SettingsError` naming the variable
- B4. list defaults: sorted by breachDate desc, 20 per page, `total` reported
- B5. sort by pwnCount desc returns the largest breach first
- B6. `q` matches name, **title** or domain case-insensitively (widened in C7: HIBP's title differs from its name in 461 of 1,036 records — `AcneOrg` is shown as `Acne.org` — so matching only `name` fails the visitor searching for what is on the screen); a breach with no domain is still found by name
- B7. `dataClass` filter returns only breaches containing that class
- B9. retired and fabricated breaches are excluded by default
- B10. `verifiedOnly=true` excludes unverified breaches
- B11. invalid `sort` value → 400 `{ error }`
- B12. summary maths (pure): total, total pwn count, last-12-months count, top 5 data classes, share with `Passwords`, largest, most recent
- B13. `GET /api/breaches/summary` returns the summary over persisted rows
- B14. empty table and HIBP port failing → both endpoints return 503 `{ error }`, never an empty 200
- B15. (forwarded from S1 review) a row written through the API in one integration test is not visible in the next — proves `get_session` and the driver's `dependency_overrides` seam, which had no caller in S1
- F1. `breach.fromDTO` parses dates and maps data classes (pure)
- F1b. (added in C12) a January breach keeps its own year west of Greenwich — `new Date('2013-01-01')` is UTC midnight and reads as 31 December locally, so a breach date is built as a local calendar day. Vitest now pins `TZ='America/New_York'`, because the bug is invisible in UTC and in every zone ahead of it, which is every machine this is developed on.
- F2. `useBreaches` hook builds the query string from `{ page, sort, order, q, dataClass, verifiedOnly }` (pure `buildBreachesQuery`)
- Pre-mortem (added at /story-start):
  - B16. pagination is deterministic when the sort value ties: with several breaches sharing a `breach_date`, page 1 and page 2 are disjoint and together cover every row (secondary sort key on `name`)
  - B17. `total` is computed under the same filters as `items`: a filtered request reports the filtered count, not the table count, and it equals the number of items gathered across all its pages
  - B18. `upsert_many` run twice with a changed record leaves the row count unchanged, advances `fetched_at`, applies the change, and leaves a row absent from the second payload in place (HIBP never deletes; neither do we)
  - B19. HIBP failing while the table already holds rows serves the stored rows with 200 and logs the staleness — 503 is only for "nothing to serve"
  - B20. a sync failure at startup does not stop the app: `/api/health` is still 200 and the catalog endpoints answer 503 `{ error }`
  - B21. two syncs racing the same TTL window do not double-write: the second sees the first's `fetched_at` and skips (checked against the fake port's call count, with both runs inside one window)

Commits:
- C1 `[test+impl B1b]` `shared/html.py` `strip_html`
- C2 `[test+impl B1, B1c, B1d]` `ports/breach_catalog.py` `Breach` domain model + `BreachCatalogError`; `adapters/hibp/breach_catalog.py` wire schema + translator (no I/O yet). The `BreachCatalogPort` Protocol moves to C4, where the fake is its first implementor — a Protocol with no implementor has no failing test to demand it.
- C3 `[chore]` `breach` table migration + SQLAlchemy model
- C4 `[test+impl B2, B18]` `BreachCatalogPort` Protocol (deferred from C2 to its first implementor); `tests/fakes/breach_catalog.py`; repository `upsert_many`; `breaches/sync.py` taking the port as a parameter. All four tests were green on arrival, so each was proved non-vacuous by mutation: excluding `fetched_at`/`title` from the update set failed two, a prune-before-insert failed the third.
- C4b `[test+impl B3, B3b, B3c, B3d, B20, B21]` `staleness.py` `should_sync` pure rule; `sync_breaches_if_stale`; `sync_catalog_at_startup` (swallows `BreachCatalogError` so the boot survives); `HibpBreachCatalog` over httpx2 with an injected transport. **Deviation from the layout above:** `create_app(settings, *, catalog)` now receives the catalog and `app/asgi.py` is the one place a real adapter is named. The startup sync runs in the lifespan, where no `dependency_overrides` seam exists, so the only way a unit test can be sure it never reaches the network is to inject the port. The database stays in `create_app` because it is reached per request through the overridable `get_session`.
- C5 `[test+impl B4, B15]` `GET /api/breaches` with defaults and pagination envelope; first integration test through the API seam
- C6 `[test+impl B5, B11]` `sort`/`order` params as enums via Pydantic query model
- C7 `[test+impl B6, B7, B17]` `q`, `dataClass`; one `_conditions()` builder feeding both the count and the page. The `breach.data_classes` column moved to the postgresql dialect `ARRAY` — the generic one raises `NotImplementedError` on `.contains()`, and `@>` is what the GIN index answers. Same DDL, so no migration (`alembic check` clean).
- C8 `[test+impl B9, B10]` default exclusions and `verifiedOnly`
- C9 `[refactor]` extract `build_breach_query` (pure filter → SQLAlchemy select) so the router is a thin shell
- C10 `[test+impl B12]` `summarise_breaches` pure function
- C11 `[test+impl B13, B14]` summary endpoint; 503 paths on both endpoints
- C12 `[test+impl F1, F1b, F2]` frontend `models/breach` (model, translator, selectors, index), `models/index.ts` namespace barrel, `api/breaches` with `buildBreachesQuery`. **The whole `api/breaches` layer is deferred to S5** — hooks *and* `fetchBreaches`/`fetchBreachSummary`. The hooks were deferred because their behaviour is specified there (F10 load-more, F11 error state, F13 abort-on-unmount, F18 skeleton); the fetch functions were written anyway and the S2 review caught the inconsistency (BF20) — untested production code under a strict-TDD contract. S5 writes them red-first, with a **required** `AbortSignal` so an effect cannot forget to abort. C12 keeps the model layer and `buildBreachesQuery`, which are tested. eslint gains a consumer-declared structurally-pure glob for `frontend/src/models/**/*.test.ts` (the extension point testing-conventions.md → adr-0004 provides for).
- C13 `[chore]` delete both S1 probe routes; the validation case moves to the real `GET /api/breaches?page=0` (verified to reject with a 400 even against an unreachable database, so it stays a unit test) and the unhandled-500 case to a route the driver mounts — a route whose only job is to crash does not belong in the application. ADR-0002 persist-not-proxy.

### S2 — review triage (Opus, 2026-09-18) — **all closed 2026-09-18**, one commit per item

Review ran as a separate agent on Opus. Eight findings, every one reproduced before it was fixed
— two were overstated and one was worse than reported, which is why the reproduction step is not
optional. BF15–BF21 are fixed and committed, behaviour changes red first.

Correctness (fixed):
- [x] BF15 `strip_html` called `feed()` without `close()`, so `HTMLParser`'s trailing buffer was
  discarded. The review's own example was wrong (`&amp;` is complete and flushes); the real case is
  worse than it reported — a description ending in a bare `&` or a half-written entity came back as
  the **empty string**, not a truncated one, because the whole description is one data chunk.
  `description` is NOT NULL, so the blank would have been stored without an error and rendered as
  an empty row.
- [x] BF16 a duplicated `Name` in the HIBP payload raised `CardinalityViolation` (one
  `INSERT … ON CONFLICT DO UPDATE` may not touch a row twice) and, because
  `sync_catalog_at_startup` caught only `BreachCatalogError`, that escaped the lifespan and
  aborted uvicorn — one bad record became the crash loop the function exists to prevent.
  `upsert_many` now keeps the last row per name; the startup hook also catches `SQLAlchemyError`.
- [x] BF17 `_matches_text` did not escape LIKE metacharacters: `?q=%` returned all 1,031 breaches
  while the "Showing X of Y" tile presented it as a search result, and `?q=A_obe` matched `Adobe`.
  Parameterised throughout, so never injection — just a wrong answer stated confidently.

Robustness (fixed):
- [x] BF18 `hibp_user_agent` was required but accepted `""`: the app booted "healthy", HIBP
  answered 403, the sync swallowed it, and both endpoints served 503 forever behind a message
  blaming the sync rather than the config. Now `Field(min_length=1)`.
- [x] BF21 the lifespan body had **zero coverage** — `TestClient` runs a lifespan only when entered
  as a context manager, and the integration tests call the sync functions directly. Swapping its
  committing transaction for a non-committing one left all 103 tests green and the production
  catalog permanently empty. The transaction moved into `sync_catalog_on_boot`, which a test drives
  against a savepoint-bound factory and which now fails under exactly that mutation. (First attempt
  ran the real lifespan through `TestClient`; its threaded commit escaped the savepoint and leaked a
  row into the test database — reverted, row deleted, minimal fix taken instead.)

Hygiene (fixed):
- [x] BF19 `frontend/src/probe-visual-review.scss`, a "delete me" scratch file with no importer,
  rode along inside the commit whose subject was deleting the S1 probe routes.
- [x] BF20 `api/breaches.ts` (`fetchBreaches`, `fetchBreachSummary`), `aBreachPageDTO` and
  `isSensitive` had no test and no caller — untested production code under the strict-TDD contract.
  The hooks were already deferred to S5 for that exact reason; the fetch functions they would call
  were written anyway. All deferred to S5, to be written red-first.

Deferred with its precondition recorded (RF-backlog):
- The boot-time HIBP call happens inside the transaction that reads `fetched_at`, so the connection
  is idle-in-transaction for up to `HIBP_TIMEOUT_SECONDS` — the doctrine's "never hold locks across
  business logic". Harmless while compose runs one worker and this is the only boot-time writer.
  The precondition is recorded in the docstring of `sync_catalog_in_own_transaction` (S2b's name
  for `sync_catalog_on_boot`) so that adding a worker resurfaces it rather than silently voiding
  the dismissal.

Case coverage: every planned case (B1–B21, F1, F2, plus B1c/B1d/B3b–B3d/F1b added mid-story) has a
named test. Two deliberate notes, not gaps: B14's conjunction "empty table **and** HIBP failing" is
behaviourally identical to "empty table", because the endpoints never consult HIBP; and C12's hooks
plus the API layer are explicitly deferred to S5 rather than dropped.

### S2b — catalog-refresh (~45m) — **closed 2026-09-18**

Objective: the stored catalog refreshes itself while the process is up, and the screen can say
how old it is. S2 left the refresh gated only by the boot-time sync, so a container that stays
up for a week serves a week-old copy — the 24h TTL held only across restarts. Fix shape:
**stale-while-revalidate** at the request boundary — every breach request serves the stored
rows immediately and, when the copy has aged past the TTL, schedules one background refresh
after the response. Single-flight per process and a retry interval so a down HIBP is not
re-fetched on every request. `syncedAt` on the summary makes the age visible rather than
silent. A separate periodic job is what production would run; here the request path is the
only trigger that the existing HTTP driver can prove end-to-end (a lifespan loop would be the
zero-coverage wiring BF21 just fixed).

Cases:
- R1. (pure) `should_retry(last_attempt_at, now)`: never attempted → retry; inside the retry
  interval (5 min) → no; at or past it → yes
- R2. (pure) the summary reports `synced_at` as the newest `fetched_at` among its facts
- R3. `GET /api/breaches/summary` reports `syncedAt` on the wire as an ISO instant
- R4. a list or summary request while the stored catalog is older than the TTL fetches the
  catalog once after answering, and `fetched_at` advances
- R5. a request while the stored catalog is younger than the TTL does not fetch
- R6. the request that triggers a refresh answers from the stored rows first: its own
  `syncedAt` is the old one, never the visitor waiting on HIBP
- R7. a refresh already in flight is not started a second time: the second call returns at once
  and the catalog is fetched once (in-process single-flight, proved with a blocking fake)
- R8. a refresh that fails is not retried inside the retry interval and is retried after it
- R9. a failed refresh never reaches the visitor: the triggering request is still 200 over the
  stored rows, and the failure is logged with the reason
- F3. `summaryFromDTO` parses `syncedAt` as an instant (`new Date(iso)`), not a calendar day —
  it is a timestamp, the opposite of F1b's breach date
- Pre-mortem (added at /story-start):
  - R10. a request refused with 503 over an empty catalog still schedules the refresh, so a boot
    that found HIBP down heals without a restart: the 503 is followed by one fetch, and the next
    request answers 200 — FastAPI attaches background tasks only to a response the handler
    returns, so the error handler has to carry them over explicitly
  - (harness) the background refresh commits through `app.state.session_factory`; the HTTP driver
    swaps it for the test's savepoint-bound factory, or a refresh would commit for real and leak
    rows into the test database (BF21's failure, one layer up)
  - (accepted) a boot whose sync failed is followed by one more attempt on the first request,
    because the boot path does not go through the refresher's retry gate — two hits on a down
    HIBP a few seconds apart, not a storm

Commits:
- C1 `[refactor]` `BreachesApiDriver` seeds `fetched_at` relative to the real clock (fresh by
  default) instead of a fixed date — a fixed seed silently crosses the TTL the day after it is
  written and would start triggering refreshes under unrelated tests
- C2 `[refactor]` rename `sync_catalog_on_boot` → `sync_catalog_in_own_transaction` and
  `sync_catalog_at_startup` → `sync_catalog_best_effort`: the refresher becomes their second
  caller and neither is boot-specific any more
- C3 `[test+impl R1]` `should_retry` in `staleness.py` beside `should_sync`
- C4 `[test+impl R2, R3]` `fetched_at` joins `BreachFacts`; `synced_at` on `BreachSummary` and
  `BreachSummaryResponse`; facts builder default
- C5 `[test+impl R4, R5, R6]` `app/breaches/refresh.py` `CatalogRefresher` (a class: the
  in-flight lock and last-attempt time are private state no caller may bypass), built in
  `create_app` onto `app.state`; `revalidate_catalog` dependency on the breaches router using
  FastAPI `BackgroundTasks`; driver `given.breaches_last_synced(hours_ago=…)`,
  `then.the_catalog_source_was_fetched(times)`. ADR-0002 amended in the same commit (the README is
  still the S1 stub; nothing there to keep in step).
- C6 `[test+impl R7]` non-blocking `threading.Lock` single-flight
- C7 `[test+impl R8, R9]` retry interval and the logged failure path
- C7b `[test+impl R10]` (pre-mortem) `carry_background_tasks` in `app/errors.py`: the `HTTPException`
  response runs the tasks the handler scheduled, so a 503 over an empty catalog still refreshes it
- C8 `[test+impl F3]` frontend `syncedAt` in DTO, model, translator and builder
- C9 `[chore]` python-primer section (`threading.Lock(blocking=False)`, `BackgroundTasks`,
  router-level `dependencies=[Depends(…)]`, `threading.Event` in a test); changelog entry

Deliberately not done: a scheduler / periodic job (production shape; recorded in the ADR
amendment as the step to take when the app runs more than one worker or sees no traffic for
days), a cross-process lock (compose runs one worker; the upsert is idempotent so a second
worker's duplicate fetch is waste, not corruption).

### S2b — review triage (Opus, separate agent, 2026-09-18) — **all closed 2026-09-18**

Fourteen findings; each fixed one was reproduced first. Live check before the review: a
25-hour-old dev catalog was served in 16 ms, refreshed after the response under the request's
correlation id (1,036 records, ~1 s), and the next summary reported the new `syncedAt`.

Correctness / robustness / testing (fixed):
- [x] BF22 `CatalogRefresher.refresh` re-checked only the lock, never `should_retry`; a cohort of
  requests that all passed the gate before the first attempt failed each fetched a fast-failing
  HIBP (the reviewer's throwaway test: 5 requests → 5 fetches). The task now re-checks under the
  lock; a refresh a minute after a failure fetches nothing.
- [x] BF23 `the_failed_refresh_was_logged` asserted only the event name — downgrading the line to
  `log.info` stayed green while the reason vanished with `exc_info`. Both best-effort branches bind
  `reason=str(error)` and the driver asserts it.
- [x] hygiene refactor: the fake's `fetch_count` (the single-flight evidence) is lock-guarded; the
  two R10 tests keep GWT phases (a `given.a_request_already_triggered_the_refresh()`);
  `carry_background_tasks` sits next to `add_task`; both shared-connection drivers name the
  never-two-threads invariant the harness rests on.
- [x] comments: `synced_at`'s "partially failed sync" mechanism was impossible (one statement, one
  transaction) — the real one is a breach the source stopped listing; `refresh` runs on a pool
  thread, not "the request's worker thread"; two plan lines still carried the pre-rename name.

Dismissed on a stated precondition, artifact left:
- `latest_fetched_at` reads the whole table while every serving read filters to servable rows, so
  a catalog of only retired/fabricated rows is a 503 the refresher calls fresh. A re-fetch would
  return the same rows, so filtering buys one HIBP call per retry interval and no healing. Recorded
  in the function's docstring; revisit if a sync ever writes a partial payload.

Visual pass: run by the `visual-reviewer` agent on the three matched paths
(`models/breach/model.ts`, `translator.ts`, `testkit/builders/breach.ts`) at 390 / 768 / 1280.
Step 0 could not be satisfied for a real reason: the served bundle contains no trace of the changed
code (tree-shaken; nothing renders `syncedAt` until S5). The landing placeholder measured no
overflow, no interactive elements, no body text, console empty on first load and reload — every
pass vacuous, stated as such. chrome-devtools MCP was held by an orphan Chrome; the reviewer used
the same-origin iframe harness, so DPR/touch emulation at 390 was not exercised.

RF-backlog additions (batched, not now):
- (S2b review) `revalidate_catalog` collapses fresh / in-flight / retry-wait into one silent
  `return` — "log at every branch" wants the reason. Return a `RefreshDecision` enum from
  `wants_refresh` and log the skip (debug for fresh, info for the other two).
- (S2b review) `CatalogRefresher` is half-injected: `catalog` at construction, `session_factory`
  per call, so the router reaches into `app.state` twice. Injecting the factory at construction
  means the HTTP driver rebuilds the refresher instead of swapping `app.state.session_factory`.
- (S2b review) one `SELECT max(fetched_at)` per breach request over an unindexed column, redundant
  on the summary path where `list_breach_facts` already carries it. Trivial at 1,031 rows; if S7's
  simulated traffic shows it, let the refresher remember the `fetched_at` it last wrote.
- (S2b) `docs/python-primer.md` has no S2 section — the "new constructs per story" rule was missed
  in S2 (S2b's section covers threading, BackgroundTasks, request.state).

### S3 — feature-flags (~1.5h)

Objective: DB-backed feature flag with stable server-side assignment and a barely-designed admin page.

Cases:
- B1. `assign_variant({visitor_id, flag_key, variants})` returns the same variant for the same inputs (1,000 ids, called twice)
- B2. bucket distribution over 10,000 ids is within ±3% of the configured weights
- B3. `assign_variant` with a single 100-weight variant always returns it
- B4. flag schema rejects variants whose weights do not sum to 100 (400 at PATCH)
- B5. `POST /api/visitors` → 201 with an `id` prefixed `vis_` and one assignment per enabled flag, `visitor_id` cookie set
- B6. disabled flag → visitor created, no assignment for that flag
- B7. `GET /api/visitors/{id}` returns the stored assignment, not a recomputed one (prove by changing weights between calls)
- B8. `GET /api/visitors/{unknown}` → 404 `{ error }`
- B9. `GET /api/feature-flags` lists the seeded `result_screen_tone` with two variants
- B10. `PATCH /api/feature-flags/{key}` with the current `updatedAt` → 200 `{ updatedAt }` and the change persists
- B11. `PATCH` with a stale `updatedAt` → 409 `{ error }` and nothing changes
- B12. `PATCH` on an unknown key → 404 `{ error }`
- B13. `PATCH` without a valid `X-Admin-Token` → 401 `{ error }` and nothing changes
- B14. visitor cookie is `HttpOnly; SameSite=Lax` and `Secure` when `ENV != dev`
- B15. (forwarded from S1 review) nginx forwards `X-Forwarded-For` and `X-Forwarded-Proto`, and the backend trusts them (uvicorn `--proxy-headers`), so `Secure` cookie logic holds behind the compose proxy
- F1. `featureFlag.fromDTO` / `toUpdatePayload` round-trip (pure)
- F2. `VisitorProvider`: with no stored id it creates a visitor and exposes `variantFor('result_screen_tone')` (driver, API mocked)
- F3. `VisitorProvider`: with a stored id it fetches that visitor and does not create a new one (driver)
- F4. `VisitorProvider`: creation failure surfaces an error state, never a default variant (driver)
- F5. Admin page: editing the urgent CTA label and clicking Save calls PATCH with the flag's current `updatedAt` (driver)
- F6. Admin page: a 409 response shows a "reload and retry" message and keeps the edited value (driver)

Commits:
- C1 `[test+impl B1, B2, B3]` `assignment.py` pure hash → bucket → weighted pick
- C2 `[chore]` migrations for `feature_flag`, `visitor`, `visitor_assignment`; seed migration for `result_screen_tone`
- C3 `[test+impl B4]` `FeatureFlagVariant` / `FeatureFlagUpdate` Pydantic schemas with weight-sum validator
- C4 `[test+impl B5, B6, B14]` `POST /api/visitors` (create, assign per enabled flag, hardened cookie)
- C5 `[test+impl B7, B8]` `GET /api/visitors/{id}`
- C6 `[test+impl B9]` `GET /api/feature-flags`
- C7 `[test+impl B13]` `require_admin_token` dependency (constant-time compare against config)
- C7b `[test+impl B10, B11, B12]` `PATCH` with optimistic lock (single write, `WHERE updated_at = :token`)
- C8 `[refactor]` extract `feature_flags/repository.py`; router is a thin shell
- C9 `[test+impl F1]` frontend `models/featureFlag`, `models/visitor`
- C10 `[test+impl F2, F3, F4]` `VisitorProvider` (driver first) + `api/visitors`
- C11 `[test+impl F5, F6]` Admin page (driver first): table, inline inputs, Save, 409 handling
- C12 `[chore]` ADR-0003 server-side stored assignment

### S4 — funnel-events (~0.5h)

Objective: every funnel step recorded idempotently, tagged with flag and variant.

Cases:
- B1. valid event → 201 and a row carrying the visitor's flag key and variant key
- B2. same event id posted twice → second call is 201 and the row count is unchanged
- B3. unknown visitor id → 404 `{ error }`
- B4. unknown event name → 400 `{ error }`
- B5. `occurredAt` in the future beyond 5 minutes → 400 `{ error }` (clock-skew guard)
- F1. `AnalyticsProvider.track('landing_view')` posts `{ id: evt_…, visitorId, name, occurredAt }` once (driver, API mocked)
- F2. `track` while the visitor is not yet created queues and flushes after creation, in order (driver)
- F3. a failed post logs and does not throw to the caller (driver)
- F4. React StrictMode double-invoking the landing effect produces one network call (driver, same event id)

Commits:
- C1 `[chore]` `funnel_event` migration + model + `FunnelEventName` enum
- C2 `[test+impl B1]` `POST /api/funnel-events` insert with stamped assignment
- C3 `[test+impl B2]` `ON CONFLICT DO NOTHING` idempotency
- C4 `[test+impl B3, B4, B5]` validation and not-found paths
- C5 `[test+impl F1, F3]` `AnalyticsProvider` (driver first) + `api/funnelEvents`
- C6 `[test+impl F2, F4]` pre-creation queue + stable per-step event id (`useTrackOnce`)

### D1 — Claude Design handoff (pause point; no code)

Objective: the funnel screens are designed in Claude Design by Shalev before any UI is built, so
S5 implements a design rather than inventing one. **I stop here and hand over a prompt.**

Tasks:
- [ ] I write the Claude Design prompt: product context (Guardio, breach-scan funnel, mobile-web first at 390px **and responsive up to desktop**), the four screens in order, the result screen as the centrepiece with the calm and urgent variants side by side, the summary tiles, the sortable/filterable list with chips and sticky CTA, the sign-up form with the leaked-password warning state, the "you're protected" confirmation, and the constraints the implementation needs (tokens for colour/spacing/type, component inventory, both variants sharing one layout with only copy/tone changing, states: loading skeleton, empty-filter, error)
- [ ] The same prompt asks for every screen at all three widths, not only 390, and names what reflows at each (see "Responsive contract") — so the desktop layout is designed rather than improvised in S5
- [ ] Shalev runs it in Claude Design and brings back the output (design system tokens, screens, any exported HTML/CSS)
- [ ] I translate the output into `frontend/src/styles/tokens.scss` and a component inventory that S5's drivers and components are named after; deviations from the design are listed, not silent
- [ ] Optional in the same round: the dashboard (S7) read, so the PM-facing page shares the system

Cases:
- none (no code). Exit criterion: tokens file (including the three breakpoints), the desktop reflow
  decisions, and the component inventory agreed in chat.

### S5 — funnel-ui (~2.5h; the result screen is the heart of the exercise and gets the most care; implements D1's design)

Objective: Landing → Scan moment → Result (summary, sortable/filterable list, variant copy) → CTA,
mobile-first at 390px and holding to desktop per the Responsive contract.

Result-screen product bar (load the `frontend-design` skill before building it):
- Summary tiles answer "why should I care": breaches in the last 12 months, accounts exposed
  (humanised: `17.8B`), share that leaked passwords, largest breach by name.
- The list is scannable on a phone: title, year, humanised count, data-class badges with
  `Passwords` highlighted, verified mark; skeleton rows while loading.
- Sort and filter are one thumb away: horizontally scrolling chips, a sort segmented control,
  "Showing X of Y" feedback, one-tap Clear filters, an explicit empty-filter state.
- "Protect me" is always reachable: sticky bottom CTA on mobile, variant-driven copy and tone.
- Nothing is computed in the browser: every sort/filter/summary is a server query.
- The same screen survives a laptop: one DOM tree, CSS-only reflow, checked at 390 / 768 / 1280.

Cases:
- F1. Landing renders the scan button and tracks `landing_view` once on mount (driver)
- F2. tapping "Scan known breaches" tracks `scan_started` and navigates to `/scan` (driver)
- F3. Scan page shows the scanning state for at least 2s, then tracks `scan_completed` and navigates to `/result` once summary and first page have loaded (driver, fake timers)
- F4. Scan page: API failure shows an error state with retry, no navigation (driver)
- F5. Result renders calm headline/sub/CTA for the calm variant and urgent copy for the urgent variant (driver)
- F6. `toneClassMap` covers every `Tone` enum member (pure exhaustiveness test)
- F7. `BreachSummary` renders the four highlight tiles from the summary model (driver)
- F8. `BreachFilters`: changing sort re-queries with the new `sort` (driver, API mocked)
- F9. `BreachFilters`: selecting a data-class chip re-queries with `dataClass`; selecting it again clears it (driver)
- F10. `BreachList`: load-more appends the next page and preserves earlier items (driver)
- F11. `BreachList`: list API error shows an error state, never an empty list (driver)
- F12. tapping the CTA tracks `cta_click` then navigates to `/signup` (driver)
- F13. navigating away mid-fetch does not update state after unmount (driver, abort signal)
- F14. `formatCount(17816217392)` → `17.8B`, `14936670` → `14.9M`, `950` → `950` (pure)
- F15. `BreachFilters` shows "Showing 20 of 1,036" from the list envelope and "Clear filters" only when a filter is active (driver)
- F16. `BreachList` with zero results under an active filter shows the empty-filter state with a Clear action, not the error state (driver)
- F17. `BreachRow` highlights the `Passwords` badge and shows the verified mark only when `isVerified` (driver)
- F18. `BreachList` shows skeleton rows while the first page loads (driver)
- F19. the CTA is rendered inside the sticky footer region on the result page (driver asserts the test id is present; visual sticky behaviour is checked manually at 390px)
- F20. the result page renders exactly one CTA node at any width — the mobile/desktop switch is CSS, never a second element or a width branch (driver: one match for the CTA test id)

Commits:
- C1 `[test+impl F1, F2]` Landing page (driver first)
- C2 `[test+impl F3, F4]` Scan page (driver first) with `useScanMoment` hook
- C3 `[test+impl F6, F14]` `Tone` enum + `toneClassMap` + `formatCount` in `.utils.ts`
- C4 `[test+impl F5]` Result page shell reading variant config from `VisitorProvider` (driver first)
- C5 `[test+impl F7]` `BreachSummary` (driver first)
- C6 `[test+impl F8, F9, F15]` `BreachFilters` (driver first) + `useBreachFilters` state
- C7 `[test+impl F17]` `BreachRow` (driver first)
- C8 `[test+impl F10, F11, F13, F16, F18]` `BreachList` (driver first) with load-more, abortable fetch, skeleton and empty states
- C9 `[test+impl F12, F19, F20]` sticky CTA wiring — one node, position and placement driven by the breakpoint in `.module.scss`
- C10 `[refactor]` extract sub-components / move logic to `.utils.ts` where files accumulated logic
- C11 `[chore]` `frontend-design` pass; **manual Chrome pass at 390 / 768 / 1280 over every funnel screen and both variants**, findings and fixes recorded in `docs/changelog.md`; scss polish; ADR-0004 result-screen product decisions and the CSS-only responsive rule

### S6 — signup (~1h)

Objective: mock sign-up with plan picker, k-anonymity password warning, bcrypt storage, confirmation.

Cases:
- B1. `hash_password` / `verify_password` round-trip; stored hash is `$argon2id$`-prefixed and never equals the input
- B2. valid signup → 201 `{ id, createdAt }`, `id` prefixed `sup_`, row stores the Argon2id hash and lower-cased email
- B3. duplicate email (case-insensitive) → 409 `{ error }`
- B4. invalid email / password under 8 chars / unknown plan → 400 `{ error }`
- B5. `passwordWasPwned=true` is persisted as sent
- B6. range proxy forwards exactly the 5-char prefix with `Add-Padding: true` and returns upstream text (fake port)
- B7. prefix not matching `^[0-9A-F]{5}$` → 400 `{ error }`
- B8. upstream failure → 503 `{ error }`
- F1. `sha1Hex('password')` equals `5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8` (pure, Web Crypto)
- F2. `findSuffixCount(rangeText, suffix)` returns the count or `undefined` (pure)
- F3. `PasswordField` shows the leaked warning for a password whose suffix appears in the mocked range (driver)
- F4. `PasswordField` shows no warning for a clean password (driver)
- F5. `PasswordField`: a stale range response arriving after a newer request is ignored (driver, ordered resolution)
- F6. `PasswordField`: proxy failure shows a soft "couldn't check" note and does not block (driver)
- F7. `PlanPicker` selects exactly one of Basic / Family (driver)
- F8. Signup page tracks `signup_started` on mount and submits `{ email, plan, password, passwordWasPwned }` (driver)
- F9. leaked password still submits and navigates to `/protected` (driver)
- F10. Protected page tracks `activation` once on mount (driver)

Commits:
- C1 `[test+impl B1]` `password_hash.py` (Argon2id via `argon2-cffi`)
- C2 `[chore]` `signup` migration + model + `Plan` enum
- C3 `[test+impl B2, B3, B4, B5]` `POST /api/signups` with Pydantic body schema
- C4 `[test+impl B6, B7, B8]` `ports/pwned_password_range.py` Protocol + `tests/fakes/` + `adapters/hibp/pwned_password_range.py`; `GET /api/pwned-passwords/range/{prefix}` wired through the port
- C5 `[test+impl F1, F2]` `PasswordField.utils.ts` pure helpers
- C6 `[test+impl F3, F4, F5, F6]` `PasswordField` (driver first) with request-ordering guard
- C7 `[test+impl F7]` `PlanPicker` (driver first)
- C8 `[test+impl F8, F9]` Signup page (driver first) + `api/signups`
- C9 `[test+impl F10]` Protected page (driver first)
- C10 `[chore]` ADR-0005 Argon2id over SHA-1 reuse (and over bcrypt)

### S7 — simulation-and-dashboard (~1.5h)

Objective: simulated traffic through the real API and a PM-readable dashboard with a statistical call.

Cases:
- B1. `two_proportion_z_test(80/1000, 100/1000)` gives p ≈ 0.11; `(800/10000, 1000/10000)` gives p < 0.001
- B2. `lift_confidence_interval` contains the true difference for a known input and reports relative lift from rates
- B3. `required_sample_per_arm(8% → 9.6%, α=0.05, power=0.8)` within 5% of the textbook figure
- B4. `recommend`: significant positive → `SHIP_VARIANT`; significant negative → `KEEP_CONTROL`; under-powered or not significant → `KEEP_RUNNING`
- B5. zero-denominator input → `KEEP_RUNNING` with `null` stats, never a division error
- B6. results query counts a visitor once per step even with duplicate events
- B7. `GET /api/experiments/{flagKey}/results` assembles per-variant steps, primary/secondary/guardrail rates, stats, recommendation, hypothesis text
- B8. unknown flag key → 404 `{ error }`
- B9. simulator: 200 visitors through the fake-free real API produce events for both variants within ±15% of the split, and per-step counts monotonically decrease
- F1. `experimentResult.fromDTO` (pure)
- F2. Dashboard renders hypothesis card, one funnel series per variant, lift with CI, and the recommendation banner from a built result (driver)
- F3. Dashboard shows the "keep running" state with required-vs-current sample when under-powered (driver)
- F4. Dashboard API failure shows an error state (driver)

Commits:
- C1 `[test+impl B1]` `stats.py` z-test
- C2 `[test+impl B2]` confidence intervals + relative lift
- C3 `[test+impl B3]` required sample per arm
- C4 `[test+impl B4, B5]` `recommend` rule with guards
- C5 `[test+impl B6]` `results.py` distinct-visitor-per-step query
- C6 `[test+impl B7, B8]` results endpoint assembling the payload
- C7 `[test+impl B9]` `scripts/simulate_traffic.py` (arg-parsed, httpx against the running API)
- C8 `[test+impl F1]` `models/experimentResult`
- C9 `[chore]` load `dataviz` skill; apply D1 tokens; `charts/` adapter over Recharts
- C10 `[test+impl F2, F3, F4]` Dashboard page (driver first): `FunnelChart`, `LiftChart`, recommendation banner
- C11 `[chore]` run the 4,000-visitor simulation; capture the read for the README; ADR-0006 frequentist read

### S8 — docs (~0.5h)

Objective: a cold reader can run it, understand the decisions, and read the result.

Cases:
- D1. README commands run verbatim on a clean clone (manual, recorded in `docs/changelog.md`)

Commits:
- C1 `[chore]` README: run, product decisions, feature-flag how-to for product, hypothesis, simulated result and call, time spent
- C2 `[chore]` write-up: approach, where AI helped, where it was wrong and how it was caught, what I'd do with more time
- C3 `[chore]` `docs/changelog.md`, final ADR index, clean-clone verification

---

## E2 — Stretch (day two, priority order)

Each stretch story gets its own Cases/Commits block when opened; the TDD contract applies unchanged.

- [ ] S9 — Bayesian read (P(urgent > calm), expected loss) beside the frequentist one
- [ ] S10 — Guardrail metric on the dashboard with its own CI
- [ ] S11 — Cypress e2e for the critical funnel path against the real stack
- [ ] S12 — Deployed demo (Fly.io/Railway backend + Postgres, Vercel frontend)
- [ ] S13 — Richer breach UX: data-class chips with counts, per-breach detail sheet, logos
- [ ] S14 — Peeking warning on the dashboard when read before the required sample
- [ ] S15 — Admin flag history via an append-only `feature_flag_change` table

## Assumptions (confirm at review, not blocking)

- Two plans, `Basic` and `Family`, mock prices, no payment step.
- Visitor identity: first-party cookie plus localStorage mirror; no fingerprinting.
- `/admin` is unlisted and has no login; the write behind it needs the admin token, pasted per session (see Decisions → Admin protection). README records this as the deliberate stopping point short of real auth.
- Breach descriptions carry HTML from HIBP; stripped server-side, rendered as text.

## RF-backlog

- (S2 review) `sync_catalog_in_own_transaction` (S2b rename of `sync_catalog_on_boot`) holds its
  transaction across the HIBP HTTP call. Split the staleness read and the write into two
  transactions when a second worker appears; the precondition is recorded in the function's
  docstring. S2b's refresher is single-flight per process, so it does not trip it.
- (S2) `app/adapters/hibp/breach_catalog.py` reads fetch-first, wire-model-second. Consider
  reordering to wire model → translator → adapter if a reader trips on it.

- (S1 review) collapse `tests/integration/test_harness.py` into one order-independent test asserting over a separate connection.
- (S1 review) pure-ASGI correlation middleware instead of `BaseHTTPMiddleware`, only on a concrete problem.
