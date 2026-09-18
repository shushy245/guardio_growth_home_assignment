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

- **D1 — design handoff (closed 2026-09-19).** The funnel screens had no design, and the admin
  page carried three measured defects that no page-local fix could answer without answering them
  twice. Shalev ran the prompt in Claude Design and brought back the project verbatim; it is now
  translated into a token scale the app reads everywhere, and an inventory that names every
  component S5–S7 will build. The three carried findings are closed by a token each and confirmed
  by measurement: the disabled Save passes contrast with zero items, no text renders under 16px,
  and no line exceeds 75 characters at any viewport. Accessibility 100 on both screens.
  Technically: `tokens.scss` translates the design's `oklch()` to sRGB hex with the source value in
  a comment beside each (Chrome gamut-maps by reducing chroma, and the review tooling measures from
  computed `rgb()`); `$text-100` 16px is the floor, `$prose-measure: 65ch` caps every `p`,
  `$content-max` 1120px caps the landing `main` (per-page, not on `MainColumn` — RF4), and `button-primary:disabled` reads its pair from
  `$color-disabled-fill`/`-text`. Source Sans 3 is self-hosted via `@fontsource-variable`, imported
  once in `main.tsx` — a security product's page should not call a third-party origin to draw text.
  `/admin` and the landing route are re-tokened; every `@media` is `min-width` over a breakpoint
  token and no component branches on width. **Eight deviations** are recorded, not silent — the
  mock's JS width branch becomes CSS-only reflow, two CTA nodes become one, sort segments grow to
  44px. Inventory: `docs/design/component-inventory.md`; review:
  `docs/reviews/d1-visual-review.md`; export: `docs/design/claude-design-export/`.

- **S4 — funnel-events (closed 2026-09-18).** The funnel could not say what a visitor did: no
  step was recorded anywhere, so the experiment had numbers on paper and none in a table. Every
  step a page reports is now written once, tagged with the variant the visitor was in, under the
  identity the server's own cookie names. The review round found that the first version trusted
  a `visitorId` in the body (one curl filed an `activation` for a stranger) and minted ids with a
  browser function absent off localhost on plain http; 11 findings, 8 fixed red-first, 3 recorded
  with their preconditions. 170 backend + 95 frontend tests.
  Technically: `funnel_event` table (client-minted `evt_` pk, `ON CONFLICT DO NOTHING` +
  `RETURNING id`, `name` as text under a CHECK carrying wire values via `values_callable`,
  nullable `flag_key`/`variant_key` copied from the stored assignment); pure `experiment_tag`
  that refuses two assignments (a logged 500, never a guess); `AwareDatetime` + a 5-minute
  forward skew guard, no backward bound (precondition in `clock_skew.py`). Frontend:
  `AnalyticsProvider` inside `VisitorProvider` on the funnel routes — `record({ id, name })` is
  idempotent on the caller's id, `track(name)` mints one; a queue that flushes in order when the
  session turns ready and drains with a log when it fails; the `visitorRef` is updated in the
  provider's *effect*, so a child mounting in the same commit queues behind what is waiting.
  `useTrackOnce(name)` holds one id per mount in `useState`. `shared/ids.utils.ts` is the id
  seam with the `getRandomValues` fallback. Reviews: `docs/plan.md` → "S4 — review triage".

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

## What's next
**S5 — funnel-ui. Unblocked and next.** D1 closed: the design is translated, so S5 implements a
design rather than inventing one. **Component names, states and screens come from
`docs/design/component-inventory.md`** and every value comes from `frontend/src/styles/tokens.scss`
— a one-off literal in a `.module.scss` is a finding. The eight recorded deviations are the only
places the code may differ from the export.

S5 carries into it: `api/breaches` (the hooks *and* `fetchBreaches`/`fetchBreachSummary`) deferred
from S2 to be written red-first; **F0** (the provider mount proved through the App driver, BF50);
and **F21** (BreachRow expanded reveals the description), added at D1 because the design gives the
description its only home on the screen. S7's simulator holds one cookie jar per simulated visitor
(BF47).

Open, deliberately: the `/admin` status `<p>` and Save do not share a right edge at 768/1280 (DV3,
a nit — the 65ch cap is the token answering the measure criterion), and every authenticated
`/admin` state is still visually unmeasured (no `ADMIN_TOKEN` given to the reviewer).

Review records: `docs/reviews/s3-review.md`, `docs/reviews/s3-fixes-visual-review.md`,
`docs/reviews/d1-visual-review.md`, and the S4 triage in `docs/plan.md`. **BF36 and BF42 are
closed** — measured in the D1 pass.
