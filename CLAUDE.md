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
- Web Crypto's `digest` resolves on Node's thread pool, a later event-loop turn `act` cannot flush: a driver chain that starts with a hash is order-dependent unless it drains `settleNativeAsyncWork()` (S6, F5 flaked once in three runs).
- The fake network matches a route's path exactly (or a bare path against the request's pathname): a route registered on `/x` never answers `/x/segment`, and the miss is a silent 599, not a loud failure — register per segment (S6 review, R-2).

## What's done
Full history: `docs/changelog.md`; commit-level record: `git log`.

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

- **S5 — funnel-ui (closed 2026-09-19).** The funnel had a design and a data layer and no
  screens between them. Landing, Scan and Result are built to the D1 design — tiles, search,
  chips, verified toggle, sort, results line, expandable rows, one CTA node that is a fixed bar at
  390 and inline in the header at 768+ by CSS alone — and every sort and filter is a server query.
  A visitor outside the experiment gets the calm control framing from a frontend constant
  (ADR-0004, a deliberate second home for the copy). 34 cases, 155 frontend tests, 28 commits (21 test+impl, 3 refactor, 4 chore — two of the chores carried presentation fixes into components after the visual pass, recorded in the triage);
  every green-on-arrival case mutation-proved. Three independent visual passes (urgent, calm, confirmation,
  the split retuned between them): accessibility 100 on all three screens, V1–V7 fixed the same
  day, V8–V13 recorded with their preconditions in `docs/reviews/s5-visual-review.md`.
  **D1 finding 1 is fully closed:** the CTA computes `#003b3e` under `toneCalm` and `#681500`
  under `toneUrgent`, measured. Unmeasured, stated: every interactive and error state
  (`visual-review-deep` on request), the real reduced-motion feature, `/result` below the fold.
  Technically: `FunnelProviders` (visitor → analytics → `BreachCatalogProvider`) on the funnel
  layout route, reused verbatim by every page driver; the catalog provider owns summary + list
  state on one request descriptor (`isEnabled`/`attempt`/`filters`/`page`) answered by two
  effects whose cleanups abort the fetch in flight, so a filter change, a retry or an unmount can
  never let an older answer land over a newer one; `fetchBreaches`/`fetchBreachSummary` take a
  required `AbortSignal`; `resolveResultCopy` + `toneClassMap` on the result root re-point every
  `var(--tone-*)` reader; `useScanMoment` (timer cleared on unmount, pinned by a timer-count
  assertion), `useCountUp` (frame-driven, cancels on unmount, collapses under reduced motion),
  `SearchField` tells its own echo from an outside change by the last query it sent. The fake
  network answers a bare path under any query, records the parsed query and whether the request
  was aborted. The Scan and SearchField drivers fake only `setTimeout` and BreachSummary's only
  rAF/`performance`/`Date`, and each asserts synchronously after `act`, because testing-library's
  `waitFor` drains through a faked `setTimeout`. The review: 16 findings, 0 correctness, 10 fixed
  (3 as new cases F31–F33), 4 batched, BF58 filed against `/admin`; triage in `docs/plan.md`.

- **D1 — design handoff (closed 2026-09-19).** The screen the whole exercise is judged on was
  about to be invented while it was built, and the admin page carried three measured defects that
  no page-local fix could answer without answering them twice. Shalev ran the prompt in Claude Design and brought back the project verbatim; it is now
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
  44px.
  **The review round is the other half of the story.** Two independent reviews found one defect
  five times: the documents described the system that had been *designed*, not the one built. The
  tone seam — the mechanism that switches the result screen between calm and urgent — was written
  down, named in the inventory, and wired to nothing, so S5's urgent variant would have rendered
  calm and the only fix would have been editing the shared button (Open/Closed). It now reads
  `var(--tone-accent-strong, #{$tone-calm-accent-strong})` with calm as the fallback, confirmed
  unchanged on screen by a third visual pass. 11 findings: 5 fixed, BF51–53 filed, RF4–8 batched,
  1 dismissed with its precondition recorded. Inventory: `docs/design/component-inventory.md`;
  reviews: `docs/reviews/d1-visual-review.md` and `docs/plan.md` → "D1 — review triage"; export:
  `docs/design/claude-design-export/`.

## What's next
**S7 — simulation-and-dashboard. Next.** Simulated traffic through the real API (one cookie jar
per simulated visitor — BF47), the two-proportion z-test, the lift CI, the sample-size
adequacy and the `SHIP_VARIANT` / `KEEP_CONTROL` / `KEEP_RUNNING` call, and the in-app dashboard
(`HypothesisCard`, `FunnelChart`, `LiftCard`, `RecommendationBanner` in
`docs/design/component-inventory.md`; load the `dataviz` skill before chart code; Recharts
wrapped once in a `charts/` adapter per the plan's decisions). `signup` rows carry
`password_was_pwned` for the "chose a leaked password anyway" read.

Carried, deliberately: the design's `Button` ghost variant has no consumer and is not built; the
`/admin` variant cards are not tinted by tone (deviation 6); BF58 (admin flag-list effect under
StrictMode) and BF59 (Argon2 memory × concurrency on an unauthenticated route) stand; DV3 and the
unmeasured authenticated `/admin` states from D1 stand. Unmeasured in S6: spinners in motion,
hover/active, interaction states at 768/1280, the Basic-plan `/protected`, real reduced motion.

Review records: `docs/reviews/s6-visual-review.md`, `docs/reviews/s5-visual-review.md`,
`docs/reviews/s3-review.md`, `docs/reviews/s3-fixes-visual-review.md`,
`docs/reviews/d1-visual-review.md`, and the S4–S6 triages in `docs/plan.md`.
