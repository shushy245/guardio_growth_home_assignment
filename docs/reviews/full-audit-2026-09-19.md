# Full-codebase audit — four independent agents on Opus, 2026-09-19

Run after S8 closed, on `main` at `8b4f215`, read-only, whole tree (not a diff). Four angles, each
agent given only the docs for its angle per the `/story-done` finder-context table: backend
(`backend-conventions.md`, `lint-index.md`, `python-conventions.md`, plan), frontend
(`frontend-conventions.md`, `lint-index.md`, component inventory, plan), testing
(`testing-conventions.md`, `python-conventions.md`, the plan's TDD contract and every `Cases:` list),
conventions + docs drift (`intellectual-references.md`, `lint-index.md`, every document in `docs/`).
Every mutation was reverted and every probe deleted; the triage is in `docs/plan.md` → "Full-codebase
audit". Reports follow verbatim.

---

# Backend audit — whole backend on `main` (read-only)

Scope: `backend/app`, `backend/scripts`, `backend/migrations`, `backend/tests`, `backend/pyproject.toml`,
`backend/Dockerfile`, `docker-compose.yml`, `frontend/nginx.conf`, `infra/`, `.env.example`.
Checklist derived from `~/.claude/docs/backend-conventions.md`, `~/.claude/docs/lint-index.md` (prose
strength, untooled-repo override), `docs/python-conventions.md`, `docs/plan.md` (Decisions, Data model,
API contract, Experiment design, S1–S7 Cases).

Baseline verified before reviewing: `pytest` 225 passed (~38s, stable over 3 runs), `mypy` clean on 147
files, `ruff check` and `ruff format --check` clean. Branch coverage measured at **98%** (`--cov=app
--cov-branch`); the uncovered lines are cited below.

Items already recorded in `docs/plan.md`/`CLAUDE.md` (BF58, BF59, the RF-backlogs, the
`sync_catalog_in_own_transaction` idle-in-transaction precondition, the boot-time double HIBP hit, the
`.env.example` ADMIN_TOKEN placeholder) are not repeated.

Working tree: every mutation was reverted and every probe file deleted immediately after it ran. The
tree contains none of my work.

---

## Correctness

### BE-1 — a funnel step recorded out of order makes the dashboard 500 forever — CONFIRMED
`backend/app/experiments/stats.py:66-68` (with `backend/app/experiments/results.py:150-160`)

**Claim.** `_read_metric` counts the numerator step and the denominator step independently, so
`successes > trials` is representable. The pooled rate then exceeds 1, `pooled_rate * (1 - pooled_rate)`
goes negative and `math.sqrt` raises `ValueError: math domain error`, which nothing catches:
`GET /api/experiments/{flagKey}/results` answers **500 `{"error":"internal error"}`**. The rows are
permanent, so the dashboard stays down until somebody deletes them by hand.

**Evidence (reproduced against the compose Postgres through the real endpoint).** Seeded through the
existing `experiments` driver: three `calm` visitors with `activation` (one of them also
`scan_completed`) and one `urgent` visitor with `scan_completed`; then `when.the_results_are_read()`:

```
AssertionError: expected HTTP 200, got 500: {"error":"internal error"}
```

The input is reachable from an ordinary browser — a second throwaway test proved the write endpoint
accepts it:

```python
funnel_events.given.a_visitor_exists()
funnel_events.when.the_visitor_records(a_funnel_event().with_name(FunnelEventName.ACTIVATION))
funnel_events.then.the_event_was_recorded()   # passes: 201
```

`create_funnel_event` (`backend/app/funnel_events/router.py:29-77`) enforces no ordering at all, and
`/signup` → `/protected` is reachable without `/scan` (a shared link, a bookmark, or any client at all
— the endpoint is open to every browser holding a visitor cookie). The pure form fails the same way:
`two_proportion_z_test(control=Proportion(3, 1), variant=Proportion(0, 1))` → `ValueError: math domain
error`.

**Principle.** *Make illegal states unrepresentable* / *validate at the boundary before any
processing* — `Proportion` and `MetricRead` carry an invariant (`successes <= trials`) that nothing
states or enforces.

**Fix (one line of intent).** Count the numerator as visitors who reached **both** steps (a self-join
or a `HAVING` on the step set) — which is also what the hypothesis says — and keep a guard in
`two_proportion_z_test`/`measure_lift` returning `None` when `successes > trials`.

### BE-2 — the primary metric can report a conversion rate above 100% — CONFIRMED
`backend/app/experiments/results.py:150-160`

**Claim.** Short of the crash in BE-1, the same independence bug makes the reported rate wrong: a
visitor who activated without completing a scan is counted in the numerator and not in the
denominator. The hypothesis is stated as "visitors who complete a scan **and go on to** activate"
(`docs/plan.md`, Experiment design; `app/experiments/hypothesis.py:17-18` repeats it), which is an
intersection; the code is two independent counts.

**Evidence.** `_read_metric(PRIMARY_METRIC, {ACTIVATION: 3, SCAN_COMPLETED: 1})` →
`MetricRead(successes=3, trials=1, rate=3.0)`. `rate: 3.0` is what reaches the wire and the lift card.
The same applies to the guardrail (`activation / cta_click`), which is the easiest of the three to
invert in practice.

**Principle.** DRY as knowledge — the hypothesis's definition of the metric has two homes (the prose
and the counting query) and they disagree.

**Fix.** Same as BE-1: count the numerator over visitors who reached the denominator.

### BE-3 — a significant *loss* with an unconverted variant reads as "keep running", not "keep control" — CONFIRMED
`backend/app/experiments/recommendation.py:90-91`

**Claim.** R-1's fix (`test is None or lift is None → KEEP_RUNNING`) is one-directional. A variant
nobody converted in makes `measure_lift` return `None` (`stats.py:127-128`), so a crushing,
fully-powered *loss* is reported as "not enough data" instead of `KEEP_CONTROL` — the dashboard keeps
a losing variant live and tells the reader to wait.

**Evidence.**
```
analyse(control=Proportion(400, 5000), variant=Proportion(0, 5000), required_per_arm=4921)
→ KEEP_RUNNING | p = 0.0 | lift = None
```
The symmetric case (`control=0/5000, variant=100/5000`) is the one R-1 covered and has a test;
this one has none.

**Principle.** Open/Closed is fine here; the miss is that the guard is stated as "no lift ⇒ no call"
when the real rule is "no lift ⇒ no *ship*".

**Fix.** Split the guard: refuse `SHIP_VARIANT` without a statable lift, but let a significant
negative z with a full sample answer `KEEP_CONTROL`.

### BE-4 — the orphaned-variant guard is a read-then-write with nothing serialising it — PLAUSIBLE
`backend/app/feature_flags/router.py:57-76`

**Claim.** `list_assigned_variant_keys` is read and the `UPDATE` is written in the same READ COMMITTED
transaction, but `visitor_assignment` rows are inserted by a *different* transaction
(`create_visitor`). A visitor created between the read and the commit can be assigned a key the PATCH
is removing, which is exactly the orphan BF31 exists to prevent, silently.

**Evidence.** By reading: no `SELECT … FOR UPDATE`, no advisory lock, no FK from
`visitor_assignment.variant_key` to the JSONB variant list (`app/visitors/models.py:24-32`); the
window is the duration of the PATCH.

**Fix.** Either accept and record it (a one-visitor race on an operator action), or serialise with a
`SELECT … FOR UPDATE` on the `feature_flag` row before the orphan read — the assignment path reads the
same row.

---

## Robustness

### BE-5 — `/api/health` reports "ok" with no database at all — CONFIRMED
`backend/app/health/router.py:11-13`, `backend/app/config.py:39`, `backend/app/breaches/sync.py:67-74`

**Claim.** `database_url` is the one setting with no validation (`str`, no scheme check), the boot sync
swallows `SQLAlchemyError`, and health checks nothing. An app pointed at a dead database boots
"healthy" and answers 500 on every data endpoint — BF18's lesson (an empty `HIBP_USER_AGENT` booted
healthy and served 503 forever behind a misleading message) in another guise.

**Evidence.** `create_app` with `database_url=postgresql+psycopg://nobody@127.0.0.1:59999/does_not_exist`,
lifespan entered:
```
{"event": "sync_catalog_best_effort: could not store the catalog, serving what is held", "level": "error", ...}
HEALTH:   200 {"status":"ok"}
BREACHES: 500 {"error":"internal error"}
```
One boot log line is the entire signal, and `/api/health` — the only endpoint an orchestrator or a
reviewer would poll — actively contradicts it.

**Principle.** *Never synthetic/optimistic data; if a dependency is down, fail visibly.*

**Fix.** Have `get_health` execute `SELECT 1` on the request session and answer 503 `{ error }` when it
fails (and give `database_url` a scheme validator beside `frontend_origin`'s).

### BE-6 — one failed step aborts the whole simulation run and leaves its rows behind — CONFIRMED (by the project's own record)
`backend/app/experiments/simulation.py:112-121,173-181`

**Claim.** `_expect` raises `SimulationError` out of `simulate_traffic`, so any single non-201 kills a
4,000-visitor run; everything already written stays in the table and silently joins the next read.

**Evidence.** It happened: `docs/plan.md` S7 records that the published read is over 4,764 visitors
because "the crashed first run's 750 visitors" are in the table (B14). There is no `--dry-run`, no
per-visitor `try/except`, and no marker distinguishing one run's rows from another's.

**Fix.** Catch per visitor, count failures, fail the run only past a threshold — and stamp a run id in
the event `metadata` (`{"simulated": true}` is already there) so a read can exclude a bad run.

### BE-7 — any unexpected query parameter is a 400 on the catalog endpoints — CONFIRMED
`backend/app/breaches/schemas.py:45`

**Claim.** `extra="forbid"` on `BreachListQuery` applies to the whole query string, so a link carrying
a tracking parameter breaks the call rather than being ignored.

**Evidence.** `GET /api/breaches?utm_source=news` →
`400 {"error":"query.utm_source: Extra inputs are not permitted"}`.

The class docstring justifies only the *missing* `populate_by_name`, not this; strict bodies are the
house rule (a `visitorId` in a funnel-event body must be refused, BF47) but a query string is not a
body, and nothing on the read path can be forged by an extra key.

**Fix.** Keep `forbid` and record the decision in the schema docstring, or drop to `ignore` for query
models; either way, state which.

### BE-8 — the HIBP translator treats `Domain` as non-nullable while the model says it is optional — PLAUSIBLE
`backend/app/adapters/hibp/breach_catalog.py:81`

**Claim.** `domain: str = Field(alias="Domain")` is required and non-null, and `_none_if_empty` only
maps `""` → `None`. `Breach.domain` and the column are `str | None`, and plan case B1 says the
translator "normalis[es] `null` → `None`" — but a JSON `null` from HIBP fails validation and, by B1d's
all-or-nothing rule, takes down the whole 1,036-record sync. The same holds for `Title` and
`LogoPath`; only `Attribution`/`DisclosureUrl` are declared nullable.

**Evidence.** By reading the model and `to_breaches`; today's payload uses `""`, so it does not
reproduce against live HIBP.

**Fix.** Declare `domain: str | None` and let `_none_if_empty` handle both spellings of absent.

---

## Testing

### BE-9 — the lifespan's catalog sync has zero coverage; deleting it leaves the suite green — CONFIRMED (mutation)
`backend/app/main.py:43-50` (uncovered lines 47-50)

**Claim.** BF21 moved the transaction *into* `sync_catalog_in_own_transaction` so it could be tested,
but the lifespan's **call** to it is still untested wiring — exactly the shape BF21 was about, one
level up. Removing the boot sync ships an app that never fills its catalog, and nothing fails.

**Evidence.** Mutation: the body of `lifespan` reduced to `yield`. Full suite: **226/226 green**
(225 + one probe). Reverted with `git checkout -- app/main.py` immediately.

**Fix.** One test that enters `TestClient(app)` as a context manager with a fake catalog and a
savepoint-bound factory and asserts the catalog was fetched once (the S2b drivers already have both
halves).

### BE-10 — every failure path of the simulator is untested — CONFIRMED (coverage)
`backend/app/experiments/simulation.py` — uncovered: 63-67, 119, 133-137, 150-154, 177-181

**Claim.** `plan_transitions`' range guard, the "server assigned an arm with no rate" error, the "not
assigned to the flag — is it enabled?" error and `_expect` itself all have no test. `_expect` is the
one thing standing between a silently half-walked funnel and a loud failure, and its message ("Loud,
with the response" — `SimulationError`'s docstring) is never exercised.

**Evidence.** `pytest --cov=app --cov-branch --cov-report=term-missing`: `app/experiments/simulation.py
69 statements, 9 missed, 18 branches, 5 partial — 84%`, the lowest file in the backend.

**Fix.** Four bare-assert unit tests (the functions are pure or take the browser factory as a
parameter, so no HTTP is needed).

### BE-11 — `backend/scripts/simulate_traffic.py` has no test at all — CONFIRMED
`backend/scripts/simulate_traffic.py:30-84`

**Claim.** `parse_arm_rate`, `build_parser` and `main` are production code with zero tests under a
"untested code is a defect" contract — the same finding as BF20 (`fetchBreaches` written without a
test), in the file the README tells a reviewer to run.

**Evidence.** `grep -rn "parse_arm_rate\|build_parser" tests` → no matches. mypy covers `scripts`
(`pyproject.toml:73`), pytest does not (`testpaths = ["tests"]`).

**Fix.** `parse_arm_rate` is pure and is three bare-assert cases (`calm=0.08`, `calm`, `calm=2`).

### BE-12 — no test covers a funnel read where a step is skipped — CONFIRMED
`backend/tests/integration/test_experiment_results.py`, `.../test_experiment_results_endpoint.py`

**Claim.** The planned cases cover duplicate events (B6), two-tag visitors (B12), an unassigned visitor
and degenerate zero counts (B5/B10), but never a visitor who reached a *later* step without the
earlier one — which is BE-1's crash and BE-2's wrong rate. The `simulation` driver's
`every_funnel_narrows_step_by_step` asserts monotonicity only over data the simulator generates, which
is monotonic by construction.

**Evidence.** My probe (BE-1) is the missing case and fails against `main`.

### BE-13 — `assign_variant`'s corrupt-split backstop is never exercised — CONFIRMED (coverage)
`backend/app/feature_flags/assignment.py:60-64` (uncovered)

**Claim.** The `ValueError` that names a flag whose weights do not cover the buckets — the message an
on-call reader would get from an intermittent 500 on the funnel's entry point (BF30's scenario) — has
no test. Its docstring argues it is unreachable; unreachable code that raises is still code, and the
message is the artefact.

**Fix.** One bare-assert case, or delete the branch if `list_enabled_splits` is genuinely the only
door.

---

## Docs / plan drift

### BE-14 — `POST /api/visitors` answers 200 on the recognised-cookie path; the contract says 201 — CONFIRMED
`backend/app/visitors/router.py:49`, `docs/plan.md` "API contract"

The contract table says `POST /api/visitors` → `201 { id, assignments }`. BF26's idempotency fix added
`response.status_code = status.HTTP_200_OK` for a known cookie, which is defensible (nothing was
created) but is recorded nowhere: not in the contract table, not in BF26's entry, not in ADR-0003.
`app/experiments/simulation.py:146` hard-codes `_expect(response, status=201)`, so the two documents of
record disagree with each other. Fix: state the two-status contract in the table and in the router
docstring.

### BE-15 — no migration uses `IF NOT EXISTS`/`IF EXISTS` — PLAUSIBLE
`backend/migrations/versions/*.py`

`~/.claude/docs/backend-conventions.md` ("Migrations — forward only"): each migration "uses
`IF EXISTS`/`IF NOT EXISTS` for idempotency". All six use bare `op.create_table` / `op.create_index`;
only the seed is idempotent (`ON CONFLICT DO NOTHING`). Alembic's version table makes this harmless in
practice, which is the argument for recording the deviation rather than the argument for not having
one. Fix: one line in the plan or `docs/python-conventions.md` saying the version table is the
idempotency mechanism here.

### BE-16 — `.env.example`'s header claims every value is validated at startup; `TEST_DATABASE_URL` is not — CONFIRMED
`.env.example:1,9`

"Every value is read and validated at backend startup; a missing one fails loudly." `TEST_DATABASE_URL`
is not a `Settings` field (`app/config.py:38-45`); it is read only by `tests/integration/conftest.py:37`.
A reader copying the file for a deployment carries a variable the app never reads. Docs-stay-in-sync is
a HARD-RULE-adjacent house rule. Fix: move it under a "tests only" heading.

### BE-17 — the seeded urgent copy says 17.7B; the plan says 17.8B — CONFIRMED
`backend/migrations/versions/9b3f1c2d4e5a_seed_result_screen_tone.py:46` vs `docs/plan.md`
"Feature flag → result screen"

The migration's docstring explains the number ("the total the summary endpoint actually reports at the
time of seeding"), the plan was never updated, and S7's closing note quotes 17.8B again. Trivial, but
it is the one string a reviewer reads on the urgent screen. Fix: correct the plan line.

---

## Dead or duplicate code

### BE-18 — "the sample reached is the smaller arm" has two homes — PLAUSIBLE
`backend/app/experiments/results.py:122` and `backend/app/experiments/recommendation.py:114`

`SampleRead.reached_per_arm = min(control.primary.trials, variant.primary.trials)` and
`_has_enough_traffic` = `min(control.trials, variant.trials) >= required_per_arm` encode the same rule
in two modules. Diagnostic: change the rule to "the total" and two places must change, or the banner
("keep running") and the number beside it ("4,200 of 6,500") disagree — which is precisely the class of
defect R-1 was. Fix: one predicate/accessor read by both.

### BE-19 — `FUNNEL_IN_ORDER` is redeclared in a driver instead of imported — CONFIRMED
`backend/tests/drivers/experiments_api.py:21` (`FUNNEL_IN_ORDER = tuple(FunnelEventName)`) while
`app/experiments/results.py:25` exports it and `tests/drivers/simulation.py:20` imports it from there.
The assertion "the funnel lists every step in order" therefore compares the response against a local
copy, so a reordering of the production tuple that both files make would pass. Fix: import it.

### BE-20 — the simulator's rate bound is enforced in two places — PLAUSIBLE
`backend/app/experiments/simulation.py:62` and `backend/scripts/simulate_traffic.py:41`

Both check `0 < rate <= MAX_ACTIVATION_RATE` with their own message. The constant is shared, the rule
is not. DRY-as-knowledge; and the script's copy is the untested one (BE-11). Fix: let the CLI call
the pure guard.

### BE-21 — four public functions with exactly one caller, all inside their own module — PLAUSIBLE
`app/config.py:64 is_bare_origin`, `app/feature_flags/admin.py:38 is_the_admin_token`,
`app/errors.py:42 format_validation_errors`, `app/middleware/correlation_id.py:69 client_ip`.
`grep` shows no importer outside the defining module (`client_ip` and `is_the_admin_token` are named by
one test each). Beck rule 4 / smallest public surface: either they are the module's API (then something
should import them) or they are `_`-prefixed. Low value; listed once so the answer is given once.

---

## Style / structure

### BE-22 — three routers re-spread `**ctx` per call instead of binding it once — CONFIRMED
`app/experiments/router.py:28-47`, `app/funnel_events/router.py:35-71`, `app/signups/router.py:40-65`

`docs/backend-conventions.md` ("Logging"): *context established once, reused* — `bind_contextvars`, not
a dict re-spread into every call. The S3 RF-backlog names only `update_feature_flag`; three more
handlers have since been written the same way, so the batched item is now a pattern. The practical
cost: `get_experiment_results`'s `log.info(..., **ctx, **_summary_of(read))` would raise `TypeError` on
a duplicated key, and a handler that adds a field has to remember every call site.

### BE-23 — `revalidate_catalog` is called inside two handlers rather than declared once — PLAUSIBLE
`app/breaches/router.py:44-98`

Both catalog handlers open with the same call and the docstring explains why it is not a router-level
dependency (dependencies resolve before parameter validation, and an invalid request must be a 400
before any SQL). That reasoning is sound, but it leaves the stale-while-revalidate contract as a line a
third handler can forget. Fix: make it a `Depends` on a *validated* dependency (take `BreachListQuery`
as a parameter of the dependency), which preserves the 400-first ordering and makes the wiring
declarative.

### BE-24 — `list_breaches` names two different things one directory apart — PLAUSIBLE
`app/breaches/router.py:71` (handler) and `app/breaches/repository.py:38` (SQL). Only the
module-qualified import keeps them apart. `docs/python-conventions.md` gives routes `get_*/list_*` and
repositories the same verbs, so the collision is structural; a `repository.fetch_page` would read
better at the call site. Cosmetic.

### BE-25 — every story driver reaches into `HttpDriver._last` / `._app()` — CONFIRMED
`tests/drivers/breaches_api.py:62,225`, `experiments_api.py:38`, `feature_flags_api.py:35,74,75,217,250`,
`simulation.py:66`. The S3 RF-backlog raised this for `feature_flags_api.py` alone ("give `HttpDriver`
a public accessor"); it is now the standard way drivers compose, so the batched decision is overdue. A
public `HttpDriver.last_response`/`app` would close it in one commit.

---

## Not covered

- **Frontend** — out of scope by the brief; `frontend/nginx.conf` was read and is consistent with
  BF27 (`X-Forwarded-For $remote_addr`, overwrite at the edge).
- **`uv.lock` / dependency provenance** — versions in `pyproject.toml` were read, the lockfile was not
  audited and no CVE check was run.
- **Load/concurrency behaviour** — no test ran two requests through one app concurrently, so the
  `CatalogRefresher` single-flight and the `SessionDep` `scope="function"` claims rest on the existing
  tests plus reading, not on my own concurrent execution. The harness itself documents that it cannot
  support it (`tests/drivers/http.py:116-119`).
- **Argon2 parameters vs. current OWASP guidance** — taken as `argon2-cffi`'s defaults, not
  independently checked against the cheat sheet's present numbers.
- **The boot-time sync against live HIBP** — never exercised; all catalog evidence is through the fake
  port and the compose Postgres.
- **`docker compose up --build` end to end** — not run (another session was committing in this
  checkout); compose/Dockerfile/nginx findings are by reading, except where an in-process app proved
  them.
- **`alembic upgrade head` from an empty database** — run implicitly by the integration session
  fixture against `breachscan_test`; not run against a freshly created database, and `alembic check`
  was not re-run (the brief states it is clean).


---

# Frontend audit — whole of `frontend/src` on `main` (read-only)

Baseline: `pnpm test` 208/208 green, `pnpm exec eslint frontend/src --max-warnings 0` clean,
`pnpm typecheck` clean. Every mutation below was reverted with `git checkout -- frontend/src`
immediately after it was measured; the working tree at the end of this audit carries only
`docs/changelog.md` and `docs/adr/README.md` (another session's files).

Doctrine read first and used as the checklist: `~/.claude/docs/frontend-conventions.md`,
`~/.claude/docs/lint-index.md`, `docs/design/component-inventory.md`, `docs/plan.md`
(Responsive contract · Feature flag → result screen · Product decisions · S3–S7 F-cases).

Not re-reported: BF58, the RF-backlog items named in the brief, the ghost `Button`, deviation 6,
and the dead-code candidates supplied — except where my measurement contradicts them (FE-26).

---

## Correctness

### FE-1 — `frontend/src/components/PasswordField.tsx:40-58` — the leak notice becomes part of the password input's accessible name. **CONFIRMED by execution.**
The `<label>` wraps the caption span, the input **and** the check notices, so the accessible-name
computation walks the whole label subtree.

```
Expected element to have accessible name:  Password
Received:  Password This password appeared in 3 leaks. You can still continue, but change it where you use it.
```
(throwaway test rendering `PasswordField` with `{status: Leaked, count: 3}`; deleted after the run)

A screen-reader user tabbing to the field hears the entire warning as the field's *name*, every
time focus lands on it, and the name changes while they type (`Password Checking against known
leaks…`). Principle: the inventory's `TextField`/`PasswordField` states assume a stable name; this
is a WCAG 2.4.6 / 4.1.2 defect, not a style point.
**Fix:** close the `<label>` after the input and render the notices as siblings outside it, pointing
at them with `aria-describedby` instead.

### FE-2 — `frontend/src/pages/Signup.tsx:94-118` — the email error is both the input's name and its description, so it is announced twice. **CONFIRMED by execution.**
Same wrapping-label shape, plus `aria-describedby={emailErrorId}` on the same node:

```
Expected element to have accessible name:  Email
Received:  Email Enter a valid email address
```

S6 F17 ("error association") is satisfied by the `aria-describedby`; the label wrapping then adds a
second, contradictory association. Principle: one authoritative home for a piece of knowledge
(Hunt & Thomas — DRY), applied to the accessibility tree.
**Fix:** move the `<span role="alert">` out of the `<label>`; keep only `aria-describedby`.

### FE-3 — `frontend/src/components/FlagEditor.tsx:75-105` with `frontend/src/pages/Admin.tsx:67-71` — "Saved." can stand beside fields that were never saved. **PLAUSIBLE by reading.**
Sequence: click Save (`save=Saving`, the request carries the flag captured in the closure at click
time) → operator edits a copy field → `handleFlagEdited` deliberately *keeps* `Saving`
(`isSaving(current) ? current : SaveStatus.Idle`, line 76) and `onChange` puts the edited flag in
the page's state → the response lands → `setSave(SaveStatus.Saved)`. The screen now shows the
edited value under the message "Saved.", and the lock token has advanced, so nothing later
complains. The `handleFlagEdited` comment states the invariant this breaks: *"'Saved.' standing
beside a field the operator has since changed claims the value on screen is the value stored."*
**Fix:** record the flag snapshot sent with the save and set `Saved` only if the current flag still
equals it; otherwise fall back to `Idle`.

### FE-4 — `frontend/src/hooks/useCountUp.ts:21-44` — the hook renders the *previous* value for one commit after `target` changes, so the calm (control) result screen paints `0` in the "Accounts exposed" tile before the real figure. **CONFIRMED by execution.**
`useState(target)` seeds once; every later change of `target` is reconciled in an **effect**, which
runs after paint. A probe recording `shown` per render across a `0 → 17_800_000_000` change gives
`[0, …, 17800000000]` — the first entry is the render that already has the new target.
`BreachSummary.tsx:28-32` calls it with `target: isSummaryReady ? … : 0` and guards the skeleton
*after* the hook (line 32), so the first commit that shows real tiles carries `formatCount(0)` →
`"0"`. Under `CountMode.Still` (the calm tone, `countModeMap`) nothing animates over it, so the
browser paints `0` and then the figure. Principle: derived display state should be computed, not
synchronised through an effect (React's own "you might not need an effect").
**Fix:** `const shown = isStill(mode) || prefersReducedMotion() ? target : animated;` — return the
target directly in the still path and let the effect own only the animated one.

---

## Robustness

### FE-5 — `frontend/src/App.tsx:19-29` — no catch-all route: any unknown URL renders an empty document. **PLAUSIBLE by reading.**
`<Routes>` lists six paths and no `<Route path="*">`. React Router matches nothing and renders
nothing — not an error page, a blank `<div id="root">`. This is the exact failure S5's review found
for `/signup` before F31 ("a blank document, not an empty outlet"); the fix then mounted one route
rather than closing the class.
**Fix:** add `<Route path="*" element={<NotFound />} />` (or a `<Navigate to="/" replace />`).

### FE-6 — no error boundary anywhere in `frontend/src` — a render-time throw white-screens the app. **CONFIRMED by absence** (`grep -rn "ErrorBoundary|componentDidCatch|errorElement" src/` → no match).
Three reachable render-time throws exist: `FunnelBars.tsx:26-28` (`>2` series),
`VisitorProvider.tsx:29` / `AnalyticsProvider.tsx:112` / `BreachCatalogProvider.tsx:144` (hook used
outside its provider). `main.tsx` wraps only `StrictMode` + `BrowserRouter`. Principle: fail
visibly, never silently — a blank page is the least visible failure there is.
**Fix:** one boundary in the composition root rendering the existing `ErrorState`.

### FE-7 — `frontend/src/providers/VisitorProvider.tsx:17-21` — a visitor session that fails once is terminal for the whole visit, with no retry and nothing on screen. **PLAUSIBLE by reading.**
`loadVisitorSession` catches internally and resolves to `{status: Failed}`; `inFlight.current` then
holds that resolved promise forever and the effect never runs again (`[]` deps). From that moment
`AnalyticsProvider.record` logs and **drops every funnel step** (`AnalyticsProvider.tsx:60-67`) and
`Result` silently serves `CONTROL_COPY`. The funnel keeps working (ADR-0004, deliberate) but the
experiment under-counts that visitor's entire journey with no signal to the operator and no way for
the visitor to recover short of a reload. Nothing in the S3–S7 cases covers recovery.
**Fix:** expose a `retry` from the provider (the `attempt`-bump shape `Admin`/`Dashboard` already
use) and clear `inFlight.current` on a failed load.

### FE-8 — `frontend/src/providers/VisitorProvider.tsx:17-21` — the only effect in the app with no cleanup: `void load.then(setState)` updates state after unmount, and the three requests behind it take no `AbortSignal`. **PLAUSIBLE by reading.**
`api/breaches.ts:4-6` and `api/experiments.ts:3-5` both state the house rule in a comment — *"The
signal is required, not optional: a fetch an effect can forget to abort is a state update after
unmount waiting to happen"* — and `createVisitor` / `fetchVisitor` / `fetchFeatureFlags`
(`api/visitors.ts`, `api/feature-flags.ts:9`) take none, although they are called from exactly such
an effect. `Admin.tsx:33-50` reaches for a `cancelled` flag instead, and comments that an
AbortSignal was not needed; `VisitorProvider` has neither. React 19 no longer warns, so this is
silent.
**Fix:** thread an `AbortSignal` through `loadVisitorSession` the way `fetchBreaches` does, or at
minimum add the `cancelled` flag `Admin` uses.

### FE-9 — `frontend/src/providers/BreachCatalogProvider.utils.ts:137` — `FILTER_KEYS` is hand-maintained and its type does not enforce completeness, so a new filter would silently never re-query. **CONFIRMED by mutation.**
```ts
const FILTER_KEYS: readonly (keyof CatalogFilters)[] = ['sort', 'order', 'q', 'dataClass', 'verifiedOnly'];
```
`readonly (keyof T)[]` accepts *any subset*. Dropping `'verifiedOnly'` compiles and typechecks;
only then does a test catch it (F29 fails). Adding a seventh key to `BreachFilters` and forgetting
this line gives a filter control whose every change is swallowed by
`withFilters`'s `areSameFilters` short-circuit — a UI that does nothing, with no error.
Principle: Trust the Type System — make the illegal state unrepresentable.
**Fix:** derive it — `const FILTER_KEY_MAP: Record<keyof CatalogFilters, true> = {...}` and
`Object.keys(FILTER_KEY_MAP)`; a missing key becomes a compile error.

### FE-10 — `frontend/src/pages/Signup.tsx:78-81` and `frontend/src/components/FlagEditor.tsx:94-105` — `setSubmission` / `setSave` in a `.catch` with no unmount guard. **PLAUSIBLE by reading.**
Both promises are started from an event handler and can outlive the component (back button during
submit; `/admin` closed during a 39-second save — the case `SAVING_MESSAGE`'s own comment
describes). Neither request is abortable. Same class as FE-8, lower blast radius.
**Fix:** a mounted ref, or carry the submit through an effect keyed on an `attempt` so the existing
cleanup pattern applies.

### FE-11 — `frontend/src/components/BreachList.tsx:59` — rows are keyed by `breach.name` across appended pages. **PLAUSIBLE by reading.**
Load-more concatenates (`receivePage`, `BreachCatalogProvider.utils.ts:97`). If the catalog is
refreshed between page 1 and page 2 (S2b makes that a real event — `syncedAt` is on the wire and
rendered), a record can appear on both pages and React gets a duplicate key: a dropped row and a
console error, not a crash.
**Fix:** key on `${page}:${breach.name}` when appending, or de-duplicate by name in `receivePage`.

### FE-12 — `frontend/src/pages/Dashboard.tsx` / `frontend/src/App.tsx:28` — `/dashboard` is public. **CONFIRMED by reading.**
`/admin` at least gates the *write* behind a pasted token; `/dashboard` reads
`GET /api/experiments/{flagKey}/results` with no credential and renders the hypothesis, the arm
counts, the p-value and the ship/stop call. Within the take-home's loopback-only posture this is a
deliberate-looking gap, but it is not recorded as a decision in `docs/plan.md` or the inventory.
**Fix:** either state it as a decision beside the `/admin` token note, or gate the read the same way.

---

## Testing

### FE-13 — `frontend/src/components/SearchField.tsx:36-40` — the echo guard that stops the box being rewritten under the visitor's fingers is proved by nothing. **CONFIRMED by mutation.**
Deleting `if (query === lastSent.current) return;` (the whole point of the `lastSent` ref, which the
file's header comment devotes three lines to) leaves
`SearchField.test.tsx + BreachFilters.test.tsx + Result.test.tsx` at **20 passed, 0 failed**.
The behaviour it protects — an outside change (Clear filters) is adopted, our own echo is not — is
the BF24-shaped case S5's C6 claims to have "pinned before it could ship".
**Fix:** a case that types a query, lets it fly, and asserts the box keeps the visitor's text when
the same `q` comes back down as a prop; plus one that clears it from outside.

### FE-14 — `frontend/src/providers/BreachCatalogProvider.tsx:60-82` — "a filter change must not refetch the tiles" is untested. **CONFIRMED by mutation.**
Widening the summary effect's deps from `[request.isEnabled, request.attempt]` to `[request]` —
which makes every sort, chip, search and toggle refetch `/breaches/summary` and flash the skeleton
tiles — leaves `BreachCatalogProvider.test.tsx + Result.test.tsx + BreachFilters.test.tsx` at
**20 passed, 0 failed**. The narrowing is stated as a design intent in the comment above the effect
and defended by no case.
**Fix:** assert the count of `GET /breaches/summary` requests recorded by the fake network is 1 after
a filter change.

### FE-15 — `frontend/src/testkit/renderWithProviders.tsx:25` — `RenderMode.Plain` is the default, so most drivers never exercise what production always does. **CONFIRMED by reading.**
`grep -rn "RenderMode.Strict"` finds six call sites (Dashboard, Protected, Scan, the three
providers). `Landing`, `Result`, `Signup`, `BreachList`, `BreachFilters`, `SearchField`,
`PasswordField`, `BreachRow`, `BreachSummary`, `FlagEditor`, `Admin` and `App` drivers all render
outside `StrictMode`, although `main.tsx` wraps the whole app in it. BF58 is exactly the defect
this hides, and it is still open.
**Fix:** make `RenderMode.Strict` the default and let a driver opt out, not in.

### FE-16 — `frontend/src/components/FlagEditor.driver.tsx:247,287` — the driver asserts message substrings instead of the exported constants. **CONFIRMED by reading.**
`expect(messageOf()).toHaveTextContent('Saved')` / `'Saving'`, while
`FlagEditor.utils.ts:83-91` exports `SAVED_MESSAGE`, `SAVING_MESSAGE`, `CONFLICT_MESSAGE`,
`FAILED_MESSAGE`, `MISSING_TOKEN_MESSAGE` — none of which has a single consumer anywhere
(measured: 0 references outside their own file). The utils header claims they exist as "the
operator copy a message assertion pins". Principle: Hunt & Thomas — DRY (one authoritative home).
**Fix:** import the constants in the driver, or delete them and read the copy from the map.

### FE-17 — the accessible-name assertion exists in this codebase and is applied only where the name is *built*, never where it is *inherited from a wrapping label*. **CONFIRMED by reading.**
`toHaveAccessibleName` appears in three drivers — `BreachRow.driver.tsx:85` (the toggle's
`aria-label`), `FlagEditor.driver.tsx:263,266` (the `aria-labelledby` pair) and
`Dashboard.driver.tsx:135` (the `meter`'s `aria-label`). All three cover names assembled from
explicit attributes. Neither text field with a wrapping `<label>` is covered, which is exactly
where FE-1 and FE-2 live. Worse, the two drivers that *do* query by name use an anchored regex —
`PlanPicker.driver.tsx:68` and `Signup.driver.tsx:173`,
`getByLabelText(new RegExp(\`^${planCardMap[plan].name}\`))` — which matches a name with anything
appended, so a polluted label passes by construction. The visual pass cannot see it either:
Lighthouse reports 100 for a name that is present but wrong.
**Fix:** one `assert.fieldIsNamed()` per form driver asserting the *exact* name, and drop the `^`
anchor from the two `getByLabelText` regexes.

---

## Design / plan drift

### FE-18 — `backend/migrations/versions/9b3f1c2d4e5a_seed_result_screen_tone.py:45` — the seeded urgent subheadline reads `17.7B`, the plan writes `17.8B`. **CONFIRMED by reading.**
`docs/plan.md` "Feature flag → result screen": *"17.8B accounts have leaked."* The migration seeds
`"17.7B accounts have leaked. Yours could be among them."`. Frontend-visible (it is the rendered
variant copy) though the file is backend. Everything else in that block matches, and the calm copy
is **byte-identical** to `Result.utils.ts:37-42`'s `CONTROL_COPY`, as ADR-0004 requires.
**Fix:** align the plan or the seed, whichever is now the intended number.

### FE-19 — `frontend/src/pages/Protected.tsx:40` — the only page that renders a raw `<main>` instead of `MainColumn`. **CONFIRMED by reading.**
`ui/box.tsx:40` exists for exactly this (*"A page with no landmark offers a screen-reader user no
way to skip to its content; rendering it as an element rather than a prop on Column keeps the
layout vocabulary a closed set"*), and `Protected.module.scss:5-11` then re-declares
`display:flex; justify-content:center` by hand. Principle: layout primitives, never raw layout
elements (frontend-conventions §Layout primitives).
**Fix:** `<MainColumn className={styles.page} …>` and drop the hand-rolled `display:flex`.

### FE-20 — `frontend/src/components/BreachFilters.tsx:142-184` — the design's `SegmentedControl` is built as a `<fieldset>` of `aria-pressed` buttons, not a radio group, and no deviation records it. **PLAUSIBLE by reading.**
`PlanPicker` — the same single-select shape, the same designer — is built as a real radio group and
the inventory records *why* (`PlanCard`: "two cards as one radio group… the ring drawn on the real
radio"). The sort control gives a screen reader three independent toggle buttons in a group whose
only name is the `<legend>`, with no "1 of 3" position and no arrow-key navigation. The inventory's
`SegmentedControl` row records deviation 3 (44px height) and nothing about semantics.
**Fix:** `role="radiogroup"` + `role="radio" aria-checked`, or record it as a deviation with the
reasoning.

### FE-21 — `frontend/src/pages/Scan.tsx` has no heading, and the Result body's three regions have none either. **CONFIRMED by reading** (`grep -rn "<h[1-6]"`).
`Scan` renders `Wordmark` (a `<span>`) and a `<p role="status">` inside `<main>` — a page with no
`h1`. On `Result`, `BreachSummary`, `BreachFilters` and `BreachList` contribute no heading, so the
document outline for the funnel's most important screen is a single `h1` over an unlabelled `<ul>`.
The design's screens (`S-2`, `S-3`) are not the authority on the accessibility tree, so this is not
a recorded deviation either way.
**Fix:** a visually-hidden `h1` on `Scan` and an `h2` above the list.

### FE-22 — `frontend/src/pages/Protected.module.scss:18` — `max-width: 480px`, an unrecorded literal. **CONFIRMED by reading.**
The inventory records the other two per-page caps by name (deviation 6, Admin's 720px; deviation 13,
Signup's 400px) and the plan's S5 brief says *"a one-off literal in a `.module.scss` is a finding"*.
This third one is in neither list. (The generic literal sweep is RF-backlog F-10; this one is
specifically a *page cap*, which the other two were thought worth recording.)
**Fix:** record it as a deviation or promote it to a token beside `$content-max`.

### FE-23 — `frontend/src/components/RecommendationBanner.module.scss:42,45` — `rgba(255, 255, 255, 0.5)` written twice, no token. **CONFIRMED by reading.**
The only raw colour literal left in any `.module.scss` (every other file reads `tokens.$…`). It
paints the `progress` track that sits on a tone fill, so it is also the one non-text contrast pair
D1 never measured — and S7's carried list already names "non-text contrast of the bar fills" as
unmeasured.
**Fix:** a `$color-on-accent-track` token beside the existing `$color-on-accent-faint`.

---

## Dead or duplicate code

### FE-24 — exports with no consumer outside their own file. **CONFIRMED by measurement** (every `export const|function|enum|class` cross-referenced against all non-test, non-driver, non-testkit files).
Beyond the list supplied:

| file | symbol | test refs |
|---|---|---|
| `charts/FunnelBars.utils.ts` | `describeBar` | 0 |
| `components/LiftCard.utils.ts` | `LiftReadKind` | 0 |
| `components/FlagEditor.utils.ts` | `SAVED_MESSAGE`, `SAVING_MESSAGE`, `CONFLICT_MESSAGE`, `FAILED_MESSAGE`, `MISSING_TOKEN_MESSAGE` | 0 (see FE-16) |
| `models/breach/translator.ts` | `highlightFromDTO`, `dataClassCountFromDTO` | 0 |
| `models/featureFlag/translator.ts` | `variantFromDTO` | 0 |
| `pages/Signup.utils.ts` | `isValidEmail` | 0 |
| `pages/Result.utils.ts` | `CONTROL_COPY` | 0 |
| `providers/BreachCatalogProvider.utils.ts` | `isFirstPage`, `hasSummaryFailed`, `NO_FILTERS`, `FIRST_PAGE`, `areSameFilters` | 0 |

None is *dead* (each is used inside its own module); each is an **unnecessary widening of a public
surface** — Beck rule 4, fewest elements, and the reason `.utils.ts` files exist is to make that
surface deliberate. The three translator entries are re-exported through `models/*/index.ts`
`export *` barrels, so they are part of each model's published API by accident rather than by
choice.
**Fix:** drop `export` from the in-file-only ones; keep only what a caller or a test imports.

### FE-25 — two corrections to the supplied dead-code list. **CONFIRMED by measurement.**
- `MIN_PASSWORD_LENGTH` (`components/PasswordField.utils.ts:19`) is **not** unreferenced — lines 20
  and 58 of the same file use it (`PASSWORD_TOO_SHORT_MESSAGE`, `isTooShort`). It is an
  unnecessary `export`, not dead code.
- `stepLabelMap` (`shared/funnel-steps.utils.ts:6`) is likewise used by `labelOfStep` on line 15 of
  the same file. Deleting either would break the build.

### FE-26 — `frontend/src/pages/Result.utils.ts:37-42` vs the seed migration — the deliberate copy duplication has no mechanical link. **CONFIRMED by reading** (the two are byte-identical today; I diffed them).
ADR-0004 records the duplication as intentional and the values currently agree. Nothing enforces
that: a product edit to the seeded `calm` variant on `/admin` leaves `CONTROL_COPY` behind, and
F25's test asserts the *literal* `'Known breaches'` rather than a shared constant, so the drift
would be invisible until someone compared two screens. Diagnostic (DRY): "if this changes, how many
places update?" — two, in two languages.
**Fix:** nothing in code; add the check to whatever runbook covers editing the flag copy, or assert
the pair in the backend seed test.

### FE-27 — `frontend/src/components/RecommendationBanner.tsx:22-26` + `RecommendationBanner.utils.ts:16-26` — two hops to get from a `Recommendation` to a CSS class. **CONFIRMED by reading.**
`bannerClassMap: Record<Recommendation, BannerClass>` then `toneClassMap: Record<BannerClass,
string|undefined>`, with `BannerClass` existing only to join them. `Result.utils.ts` does the same
job in one map. The local map is also named `toneClassMap`, colliding by name with
`Result.utils.ts`'s `toneClassMap` (a different concept — tone vs recommendation), which the
tokens file already has to disambiguate in prose.
**Fix:** one `Record<Recommendation, string | undefined>` in `RecommendationBanner.utils.ts`;
rename or delete `BannerClass`.

### FE-28 — `frontend/src/components/LiftCard.tsx:32-53` — both branches render the identical two-span structure. **CONFIRMED by reading.**
The `isMeasured` ternary duplicates `<span className={…value…} data-testid={Value}>` and
`<span className={styles.interval} data-testid={Interval}>` verbatim; only the class modifier and
the two strings differ. `readLift` already returns a discriminated union that could carry
`{value, line, direction}` for the unmeasured case too.
**Fix:** widen `LiftRead` so both variants carry `value`/`line`/`direction`, then render one tree.

---

## Style / structure

### FE-29 — model and provider helpers take a positional first argument plus an options object, against the named-options rule. **CONFIRMED by reading.**
`setVariantCopy(flag, {variantKey, field, value})`, `setVariantWeight(flag, {…})`,
`setLockTokenIn(flags, {…})`, `mapVariant(flag, variantKey, change)`, `findVariant(flag, key)`,
`findFlag(flags, key)`, `replaceFlag(flags, updated)`, `setLockToken(flag, token)`,
`areSameFilters(left, right)`, `withFilters(request, filters)`, `nextPage(request)`. The global rule
is "any function with 2+ params takes one named object", exempting universal ordered pairs. The
codebase is otherwise strict about this (`toPendingEvent({event, now})`, `formatResultsLine({shown,
total})`, `flagFieldTestId({flagKey, field})`), so the model layer reads as the one holdout.
**Fix:** either normalise the model layer to one options object, or record the
`(subject, options)` shape as a deliberate house form so it stops reading as drift.

### FE-30 — `frontend/src/components/FlagEditor.tsx:109-113` — `saveToneClassMap` is rebuilt inside the render body. **CONFIRMED by reading.**
Every other class lookup table in the project is a module constant in the adjacent `.utils.ts`
(`Result.utils.ts:27`, `BreachSummary.tsx:49`, `FunnelBars.tsx:23`, `RecommendationBanner.tsx:22`
— the last two are at least module scope). This one is re-allocated on every keystroke in the
editor and sits in the `.tsx`, which the component/file boundary reserves for the component.
**Fix:** move it to module scope, and preferably to `FlagEditor.utils.ts` (it may import the scss
module, as `Result.utils.ts` does).

### FE-31 — `frontend/src/pages/Dashboard.tsx:103,107` — class names joined with a template literal instead of `joinClassNames`. **CONFIRMED by reading** (the only two such sites in `src`).
`joinClassNames` exists precisely to survive a `styles.x` that resolves to `undefined` — the
template form would write the string `"undefined"` into `class`, which is the shape of S7 visual
finding V9 (a raw class name matching no rule, invisible to every jsdom test because Vitest
compiles CSS modules non-scoped).
**Fix:** `joinClassNames(styles.card, styles.funnel)`.

### FE-32 — `eslint.config.mjs:43-46` — `no-restricted-syntax` is switched **off entirely** for the boundary files, which is the thing the block eighteen lines above warns against. **CONFIRMED by reading.**
The models-test override is composed deliberately and explains why:
> *"Composed, not switched off: … `off` would also have retired the inline-factory and raw-testid
> selectors in these files, silently."*

The very next block then does exactly that for `**/api/http-client.utils.ts`,
`**/api/http-client.utils.test.ts` and `**/main.tsx`, retiring `noOptionalChaining`,
`noInlineJsxLambda`, `noBooleanParam`, `jsxTextBackticks`, `noRawTestId` and `noRawExpect` in those
files to buy one exemption (`noNullLiteral`). `main.tsx` is JSX, so the JSX selectors are live
surface there. Nothing currently violates them — this is a guard that is off, not a violation.
Principle: lint rules are deliberate law; an exemption should be the narrowest that works.
**Fix:** compose the boundary override the same way — re-list every selector except
`noNullLiteral`.

### FE-33 — four value-imports of types. **CONFIRMED by reading.**
`App.tsx:1`, `pages/Landing.tsx:3`, `ui/box.tsx:1` (`import { ReactElement } from 'react'`) and
`ui/box.utils.ts:1` (`import { ReactNode }`) against `import type { … }` in every other file.
Harmless under `verbatimModuleSyntax`-less bundling, inconsistent with the
`consistent-type-exports` reasoning the lint index gives for the mirror rule.
**Fix:** `import type`.

---

## Not covered

- **Anything requiring a browser.** No app was booted; no viewport was rendered or measured. Every
  responsive, contrast, tap-target, focus-order and reduced-motion claim in this report is from
  reading CSS, never from a capture — the `.module.scss` media-query survey confirms the queries are
  `min-width` over the three named tokens and that no component branches on width in JSX, and that
  is all it confirms.
- **The backend**, except the one seed migration read to check FE-18 and FE-26.
- **`frontend/dist/`** (build output) and `node_modules`.
- **Bundle size, performance, and the axios response interceptor's cost** (`normaliseNulls`
  rebuilds every response body recursively — correct, unmeasured).
- **Cross-browser behaviour of `<meter>` / `<progress>` styling**, which is the mechanism behind
  FE-23 and V5.
- **Exhaustive mutation testing.** Thirteen mutations were run against the highest-risk seams
  (abort/cleanup/idempotency/state-machine); the suite killed eleven. The two survivors are FE-13
  and FE-14. Pure formatters, the `receivePage`/`failPage`/`awaitPage` table and the Dashboard's
  copy helpers were not mutated.
- **`docs/design/claude-design-export/`** — the design's own HTML was not re-derived; the
  component inventory was taken as the authority for what the design says, per the project rule.


---

# Full-suite test-quality audit — `main`, 2026-09-19

Read-only. Baseline re-verified at start and end: **225 backend / 208 frontend, all green**;
`git status` clean at finish (the other session's `docs/changelog.md` and `docs/adr/README.md`
were committed by it during the run). 50 mutations applied and reverted; no file left modified.

Checklist derived from `~/.claude/docs/testing-conventions.md`, `docs/python-conventions.md`
(Tests table) and `docs/plan.md` (TDD contract + every `Cases:` list).

Items already listed as known in the brief (RF-backlog entries in plan.md, BF58, the dead
test-only frontend exports) are **not** repeated as findings.

---

## 1. Case-coverage table

Legend: ✓ covered · **PARTIAL** (part of the case's sentence is unasserted) · **MISSING**.
Confidence is CONFIRMED for every row (test names read from the files; contested rows proved by
mutation).

### S1 — scaffold

| Case | Test | State |
|---|---|---|
| B1 health 200 `{status:ok}` | `test_health_endpoint_returns_200_status_ok` | ✓ |
| B2 unknown route 404 `{error}` | `test_unknown_route_returns_404_with_error_body` | ✓ |
| B3 validation 400 `{error}` | `test_request_failing_validation_returns_400_with_error_body` | ✓ |
| B4 `x-correlation-id` generated + echoed | `test_every_response_carries_a_generated_correlation_id`, `test_an_inbound_correlation_id_is_echoed_back` | ✓ |
| B5 missing `DATABASE_URL` fails at startup | `test_missing_database_url_fails_loudly_naming_the_variable` | ✓ |
| B6 integration harness session + rollback | `test_a_session_against_the_compose_database_answers` | ✓ |
| B7 origin outside allow-list gets no CORS header | `test_any_other_origin_gets_no_allow_header` | ✓ |
| B8 `generate_unique_id` shape / sort / uniqueness | `test_ids.py` (3) | ✓ |
| F1 `App` renders landing at `/` | `shows the landing page at the root route` | ✓ |
| F2 `Row`/`Column` flex class | `box.test.tsx` (9) | ✓ |
| B4b 404 and 400 carry the id | `test_a_404_response_also_carries_the_correlation_id`, `…a_400…` | ✓ |
| B4c two overlapping requests keep their own id | `test_two_overlapping_requests_each_get_their_own_correlation_id` | ✓ |
| B5b `create_app(settings)` takes settings | — | **MISSING** — structural proof only; already recorded in the S1 RF-backlog, not re-reported below |
| B6b write not visible in the next test | `test_the_previous_tests_write_is_not_visible_here` | ✓ |

### S2 — breach-catalog

B1 ✓ `test_the_hibp_translator_maps_every_wire_field_onto_our_breach_model` · B1b ✓ `test_html.py` (6)
· B1c ✓ `…reads_an_empty_domain_as_absent` · **B1d PARTIAL** (`…rejects_a_payload_that_is_not_hibps_shape`
asserts the wire field `Title` and the function name, never the *index* the case and the
implementation's own docstring promise — `tests/unit/test_hibp_breach_translator.py:60`) · B2 ✓
(`…stores_every_breach…`, `…does_not_duplicate_rows`) · B3 ✓ `test_breach_staleness.py` · B3b ✓ ·
B3c ✓ (3) · B3d ✓ · B4 ✓ (2) · B5 ✓ (2) · B6 ✓ (5) · B7 ✓ · B9 ✓ (3) · B10 ✓ (2) · B11 ✓ (2) ·
B12 ✓ `test_breach_summary.py` (11) · B13 ✓ · B14 ✓ (2) · B15 ✓ `test_rows_written_by_the_previous_test_are_not_visible_here`
· F1 ✓ · F1b ✓ (TZ pin proved live, see M-F24) · F2 ✓ `breaches.utils.test.ts` (7) ·
B16 ✓ `…does_not_make_paging_repeat_or_skip_breaches` · **B17 PARTIAL** — the filtered-total half
is asserted (`test_a_filtered_list_reports_the_filtered_total_not_the_table_count`), the case's
second clause ("it equals the number of items gathered across all its pages") is not: the fixture
returns one item on one page, so multi-page gathering is never exercised
(`tests/integration/test_breaches_filters.py:80`) · B18 ✓ (2) · B19 ✓ · B20 ✓ (2) · B21 ✓.

### S2b — catalog-refresh

R1 ✓ (4 staleness tests) · R2 ✓ · R3 ✓ · R4 ✓ · R5 ✓ · R6 ✓ · R7 ✓ (2) · R8 ✓ (2) · R9 ✓ ·
R10 ✓ `test_a_request_refused_over_an_empty_catalog_still_schedules_the_refresh` · F3 ✓.
All ✓.

### S3 — feature-flags

B1 ✓ · B2 ✓ · B3 ✓ · B4 ✓ (unit + HTTP) · B5 ✓ · B6 ✓ · B7 ✓ · B8 ✓ · B9 ✓ · B10 ✓ · B11 ✓ ·
B12 ✓ · B13 ✓ (2) · B14 ✓ (2) · **B15 PARTIAL** — `test_the_request_log_names_the_client_and_the_scheme`
covers the log side only; the nginx `X-Forwarded-*` forwarding itself is a manual check, which the
plan's own "(recorded)" note states · B16 ✓ · B17 ✓ · B18 ✓ · B19 ✓ · B20 ✓ (2) ·
F1 ✓ · F2 ✓ · F3 ✓ · F4 ✓ · F5 ✓ · F6 ✓ · F7 ✓ · F8 ✓ · F9 ✓.
Review-fix cases BF43, BF44, BF24, BF25, BF39, BF38 each have a named test ✓ (mutation-proved as
non-vacuous below: F-M5, F-M6, F-M7).

### S4 — funnel-events

B1 ✓ · B2 ✓ · B3 ✓ · B4 ✓ · B5 ✓ (threshold unpinned — M1/M2) · B6 ✓ · B7 ✓ · B8 ✓ · B9 ✓ ·
B10 ✓ · F1 ✓ · F2 ✓ · F3 ✓ · F4 ✓ · F5 ✓ · F6 ✓ · F7 ✓. Review cases BF47 ✓, BF49 ✓, BF50 ✓.
All ✓.

### S5 — funnel-ui

F0 ✓ (2 App tests) · F1 ✓ · F2 ✓ · F3 ✓ (2, both assert `ScanCompleted` posted once) · F4 ✓ ·
F5 ✓ (2) · F6 ✓ · F7 ✓ · F8 ✓ · F9 ✓ · F10 ✓ · F11 ✓ · F12 ✓ · F13 ✓ · F14 ✓ · F15 ✓ (2) ·
F16 ✓ · F17 ✓ (2) · F18 ✓ · F19 ✓ · F20 ✓ · F21 ✓ · F22 ✓ · F23 ✓ · F24 ✓ · F25 ✓ (2) · F26 ✓ (2) ·
F27 ✓ (4) · F28 ✓ (interval value unpinned — F-M26) · F29 ✓ · F30 ✓ (2) · F31 ✓ · F32 ✓ · F33 ✓.
All ✓.

### S6 — signup

B1 ✓ (4) · B2 ✓ · B3 ✓ · B4 ✓ (3) · B5 ✓ · B6 ✓ · B7 ✓ (2) · B8 ✓ · B9 ✓ (2) · B10 ✓ · B11 ✓ ·
F1 ✓ · F2 ✓ (3) · F3 ✓ · F4 ✓ · F5 ✓ (but see T-4: passes on either of two guards) · F6 ✓ ·
F7 ✓ (3) · F8 ✓ (2) · F9 ✓ · F10 ✓ · F11 ✓ · F12 ✓ · F13 ✓ · F14 ✓ (3) · F15 ✓ · F16 ✓ ·
F17 ✓ (`errorsAreAnnouncedByTheirFields`).
All ✓.

### S7 — simulation-and-dashboard

B1 ✓ (2) · B2 ✓ (4) · B3 ✓ (3) · B4 ✓ (3) · B5 ✓ (2) · B6 ✓ · B7 ✓ · B8 ✓ · B9 ✓ · B10 ✓ (2) ·
B11 ✓ `test_the_interval_and_the_p_value_agree_about_significance` · **B12 PARTIAL** — the
"two tags, one arm" half is pinned (`…whatever_their_events_are_tagged`); the "a visitor with no
assignment for the flag is in neither arm" half is tested only with a visitor holding **no
assignment at all**, so the query's `flag_key` filter is unpinned (proved: M15b survives) ·
B13 ✓ · B14 ✓ · F1 ✓ (4) · F2 ✓ · F3 ✓ · F4 ✓ · F5 ✓ (2). Review cases R-1 ✓, R-2 ✓, R-3 ✓.

### S8 — docs

D1 "README commands run verbatim on a clean clone" — manual, recorded in `docs/changelog.md`.
Not a suite case; not counted as MISSING.

**Totals: 1 MISSING (S1 B5b, already known), 5 PARTIAL (S2 B1d, S2 B17, S3 B15, S7 B12 — S3 B15
partial by the plan's own design).** Counting only rows not already recorded in plan.md: **4
PARTIAL, 0 new MISSING.**

---

## 2. Mutation log

50 mutations, **17 survived**. Every row CONFIRMED by execution.

### Backend (24 valid mutations, 9 survived)

| # | File / mutation | Result |
|---|---|---|
| M1 | `funnel_events/clock_skew.py` `>` → `>=` | **SURVIVED** |
| M2 | `clock_skew.py` `MAX_CLOCK_SKEW_AHEAD` 5 min → 30 min | **SURVIVED** |
| M3 | `feature_flags/admin.py` `is_the_admin_token` → `presented != ''` | killed — `test_a_save_with_a_wrong_admin_token_is_refused_and_changes_nothing` |
| M4 | `assignment.weights_cover_every_bucket` `== 100` → `<= 100` | killed — 4 tests (schema, both stored-split tests, the PATCH test) |
| M5 | `weights_cover_every_bucket` `== 100` → `>= 100` (over-100 accepted) | **SURVIVED** |
| M6 | `assign_variant` `bucket < upper` → `bucket <= upper` | **SURVIVED** |
| M7 | `bucket_for` `digest[:8]` → `digest[:4]` | killed — `test_a_known_visitor_lands_in_a_pinned_bucket` |
| M8 | `stats._CRITICAL_VALUE` two-sided → one-sided | killed — 4 tests in `test_stats.py` |
| M9 | `stats` `p = 2*sf` → `sf` | killed — `…a_thousand_visitors_an_arm_is_not_significant` |
| M10 | `recommendation._has_enough_traffic` `min` → `max` | killed — `…with_one_thin_arm_still_recommends_keeping_it_running` |
| M11 | `_has_enough_traffic` `>=` → `>` | **SURVIVED** |
| M12 | `_is_significant` `p < ALPHA` → `p <= ALPHA` | **SURVIVED** |
| M14 | `experiments/repository.py` drop `distinct(visitor_id)` | killed — `…recorded_a_step_twice_is_counted_once_for_it` |
| M15b | `experiments/repository.py` `where(flag_key == flag_key)` → `where(flag_key is not None)` | **SURVIVED** |
| M16 | `visitors/router.py` cookie `httponly=False` | killed — both cookie tests |
| M17 | `visitors/router.py` `max_age=None` (session cookie) | **SURVIVED** |
| M18 | `refresh.py` `acquire(blocking=False)` → `True` | killed — `test_a_refresh_already_in_flight_is_not_started_a_second_time` |
| M19 | `refresh.py` remove the second retry gate | killed — `…before_a_failed_attempt_landed_does_not_fetch_again` |
| M20 | `signups/schemas.py` `MIN_PASSWORD_LENGTH` 8 → 1 | killed — `test_a_password_under_eight_characters_is_refused` |
| M21 | `signups/schemas.py` drop `email.lower()` | killed — 2 tests |
| M22 | `signups/schemas.py` `MAX_PASSWORD_LENGTH` 256 → 1 000 000 | **SURVIVED** |
| M23 | `funnel_events/schemas.py` drop `EVENT_ID_PATTERN` | killed — `…id_is_not_a_prefixed_client_id_is_refused` |
| M24 | `breaches/summary.py` `synced_at=max(...)` → `min(...)` | killed — `…reports_the_newest_sync…` |
| M26 | `funnel_events/router.py` 401 → 404 for a missing cookie | killed — `…no_visitor_cookie_is_refused` |

(A 25th attempt — regrouping the results query on the event tag — did not compile under SQLAlchemy
and is not counted.)

### Frontend (26 valid mutations, 8 survived)

| # | File / mutation | Result |
|---|---|---|
| F-M1 | `BreachCatalogProvider.utils.receivePage` → always replace | killed — 2 tests |
| F-M2 | `failPage` → always `Failed` | killed — `keeps the rows on screen when the next page fails…` |
| F-M3 | `awaitPage` → always `Loading` | killed — 3 tests |
| F-M4 | `hasMorePages` `<` → `<=` | killed — `offers no Load more once the whole record is on screen` |
| F-M5 | `FlagEditor.canSave` drop the token clause | killed — `does not offer a save before the admin token is pasted…` |
| F-M6 | `canSave` drop the split clause | killed — `does not offer a save while the split leaves buckets unassigned` |
| F-M7 | `clampWeight` drop the upper bound | killed — `holds a weight typed above the whole split…` |
| F-M8 | `clampWeight` `NaN → 0` becomes `NaN → 100` | **SURVIVED** |
| F-M9 | `Result.utils.resolveResultCopy` → always control copy | killed — 2 Result tests |
| F-M10 | `RecommendationBanner.showsSampleProgress` drop the traffic clause | killed — `says the arms do not differ yet…` |
| F-M11 | `http-client.utils.isPlainObject` drop `!Array.isArray` | **SURVIVED** |
| F-M12 | `bannerClassMap[KeepControl]` → `Wait` | killed — `calls the control kept on a significant loss` |
| F-M13 | `AnalyticsProvider` drop the `recorded` dedupe | killed — 2 tests |
| F-M14 | `AnalyticsProvider` update `visitorRef` during render | killed — `keeps a step recorded as the visitor arrives behind the steps already waiting` |
| F-M15 | `AnalyticsProvider` queue prepends instead of appends | killed — 2 tests |
| F-M16 | `usePasswordLeakCheck.isWorthChecking` drop `password !== ''` | **SURVIVED** |
| F-M17 | `usePasswordLeakCheck` drop the `isCurrent` guard | **SURVIVED** |
| F-M18 | `Signup.utils.validateSignupForm` email always valid | killed — `shows the inline messages…` |
| F-M19 | `describeSignupFailure` always generic | killed — `tells the visitor when the email already has an account…` |
| F-M20 | `usePasswordLeakCheck` drop `controller.abort()` | **SURVIVED** |
| F-M21 | drop **both** `isCurrent` and `abort()` | killed — `ignores a stale range that arrives after the password was changed and re-checked` |
| F-M22 | `Protected.utils.isProtectedRouteState` → `true` | killed — `sends a visit with no sign-up behind it back to the sign-up…` |
| F-M23 | `nextStepsMap[Plan.Basic]` → the Family steps | **SURVIVED** |
| F-M24 | `breach/translator.toCalendarDay` → `new Date(iso)` | killed — 3 tests (TZ pin confirmed live) |
| F-M25 | `summaryFromDTO.syncedAt` parsed as a calendar day | killed — 2 tests |
| F-M26 | `SEARCH_DEBOUNCE_MS` 300 → 0 | **SURVIVED** |
| F-M27 | `VisitorProvider.utils.variantFor` drop the flag-not-found guard | **SURVIVED** |

---

## 3. Findings

Most severe first. Every finding is CONFIRMED by execution unless stated.

### T-1 — Coverage gap: the experiment read is not pinned to the flag it is reading
`backend/app/experiments/repository.py:31` · `backend/tests/integration/test_experiment_results.py:57`
**Claim.** `count_visitors_per_step` filters `visitor_assignment.flag_key == flag_key`. Replacing
that with `flag_key IS NOT NULL` leaves the whole suite green (M15b). B12's "a visitor with no
assignment **for the flag** is in neither arm" is tested only with
`given.a_visitor_outside_the_experiment` — a visitor with no assignment **at all** — so the case
that the filter exists for (a visitor assigned to a *different* flag) is never constructed.
**Why it matters.** A second enabled flag is a live possibility the codebase already reasons about
(`funnel_events` refuses a two-assignment visitor with a 500). Without the filter, that visitor's
steps would be counted into an arm named by the wrong flag's variant, silently corrupting both
samples of the z-test.
**Fix.** Add a `given.a_visitor_assigned_to_another_flag(took=…)` to `ExperimentResultsDriver` and
assert `nothing_was_counted()`.

### T-2 — Coverage gap: a split summing to more than 100 is accepted by every layer
`backend/app/feature_flags/assignment.py:70`
**Claim.** `weights_cover_every_bucket` relaxed from `== 100` to `>= 100` survives the suite
(M5), while the `<= 100` direction is killed by four tests (M4). Every weights test is an
*under*-100 case.
**Why it matters.** `assign_variant`'s own docstring states the over-100 shape is "rejected before
it reaches here — by the update schema on write and by `list_enabled_splits` on read"; that claim
rests on an untested half of one comparison. Its failure mode is silent: with 60/60 the trailing
variant is unreachable, so an experiment runs with a dead arm and the dashboard reads one arm at
zero trials.
**Fix.** One unit case in `test_feature_flag_schemas.py` (weights 60/60 rejected) and one stored-row
case in `test_feature_flag_splits.py`.

### T-3 — Wrong-reason pass: the Basic-plan confirmation test asserts nothing about the Basic plan
`frontend/src/pages/Protected.test.tsx:22`, driver `frontend/src/pages/Protected.driver.tsx:63`
**Claim.** `it('confirms the Basic plan with its own next steps')` calls only
`assert.confirmationIsShownFor(Plan.Basic)`, which asserts the plan *line* text
(`'Basic plan'`). Swapping `nextStepsMap[Plan.Basic]` for the Family steps leaves the suite green
(F-M23). The "its own next steps" half of the name is unasserted, and the Basic steps are a
deliberate, design-diverging choice recorded in the code comment.
**Fix.** Add `assert.nextStepsRead([...])` to the driver and call it from both plan tests.

### T-4 — Wrong-reason pass: S6 F5's stale-range protection is pinned only as a pair
`frontend/src/hooks/usePasswordLeakCheck.ts:61,71` · `frontend/src/components/PasswordField.test.tsx:46`
**Claim.** The test `ignores a stale range that arrives after the password was changed and
re-checked` stays green when the `isCurrent` guard is removed (F-M17) **and** when
`controller.abort()` is removed (F-M20); it fails only when both go (F-M21). Neither mechanism is
individually pinned, so a refactor can silently delete either.
**Why it matters.** The module header assigns them different jobs — `isCurrent` covers the hash
step, before a request exists for the abort to cancel — so they are not redundant in production,
only in the test.
**Fix.** A second case that changes the password while the *hash* is outstanding (the
`native-async` testkit already drains that turn), asserting on `isCurrent`'s half alone.

### T-5 — Coverage gap: the clock-skew threshold itself is untested
`backend/app/funnel_events/clock_skew.py:19-20` · `backend/tests/integration/test_funnel_events_validation.py:56,70`
**Claim.** The two cases use +1 minute (accepted) and +1 hour (refused). Both `>` → `>=` (M1) and
5 min → 30 min (M2) survive. The guard's actual boundary is unpinned between one minute and one
hour.
**Fix.** Two cases at the boundary: `MAX_CLOCK_SKEW_AHEAD` exactly (accepted) and one second past
it (refused), spelled against the constant.

### T-6 — Coverage gap: a zero-weight variant is not proved to receive nobody
`backend/app/feature_flags/assignment.py:57`
**Claim.** `bucket < upper` → `bucket <= upper` survives (M6). With that mutation a *leading*
zero-weight variant collects bucket 0, i.e. ~1% of visitors, and every 50/50 split shifts to
51/49 — inside the ±3-point tolerance of `test_the_split_over_ten_thousand_visitors_is_within_three_points_of_the_weights`.
`test_a_single_variant_holding_all_the_weight_is_always_chosen` uses one variant, not `[0, 100]`.
**Why it matters.** 100/0 is the mechanism the S5 visual pass used to force a variant, i.e. an
operator-reachable configuration; "0 means zero" is unproved.
**Fix.** A unit case: variants `[urgent(0), calm(100)]`, 1,000 visitors, never `urgent`.

### T-7 — Coverage gap: `clampWeight`'s cleared-input branch (BF39's other half)
`frontend/src/components/FlagEditor.utils.ts:147`
**Claim.** `if (Number.isNaN(weight)) return 0;` → `return WEIGHT_TOTAL` survives (F-M8). BF39
names both halves — "accepts out-of-range values (`999`)" **and** "silently writes `0` when
cleared" — and only the first got a test (`holds a weight typed above the whole split at the whole
split`).
**Fix.** `driver.type.urgentWeight('')` then `assert.urgentWeightIs(0)`.

### T-8 — Coverage gap: `variantFor`'s flag-not-found branch
`frontend/src/providers/VisitorProvider.utils.ts:47`
**Claim.** Removing `if (flag === undefined) return undefined;` leaves Result and VisitorProvider
tests green (F-M27). The branch guards a visitor holding an assignment for a flag the flag list no
longer defines; without it the next lines dereference an undefined flag.
**Fix.** A `VisitorProvider` case: visitor assigned to `result_screen_tone`, flag list served
without it, `variantFor` is `undefined` and the Result page shows the control copy.

### T-9 — Wrong-reason pass (class): both debounce tests are self-referential on the interval
`frontend/src/components/SearchField.driver.tsx:97` · `frontend/src/components/PasswordField.driver.tsx:102`
**Claim.** Each driver advances fake timers by exactly the constant it imports
(`SEARCH_DEBOUNCE_MS`, `PASSWORD_CHECK_DEBOUNCE_MS`), so the *value* is unpinned: 300 → 0 survives
(F-M26). S5 F28 and S6 F11 prove "one request per settle", not "after the visitor pauses".
**Fix.** One assertion per driver that advances to just under the constant and asserts no request
yet; the pass/fail then depends on the interval.

### T-10 — Coverage gap: the Argon2 input bound and the visitor cookie's lifetime
`backend/app/signups/schemas.py:18` · `backend/app/visitors/router.py:91`
**Claim.** `MAX_PASSWORD_LENGTH` 256 → 1 000 000 survives (M22); `max_age=…` → `None` (a session
cookie) survives (M17). Both bounds carry an explicit rationale in the code — "a megabyte of
password is a request to burn CPU" and "a session cookie would re-bucket every returning visitor
and double-count them in the funnel" — and BF59 (Argon2 cost on an unauthenticated route) is an
open carry that this bound partly mitigates.
**Fix.** One 400 case for a 257-character password; one assertion on `Max-Age` in
`the_visitor_cookie_is_http_only_and_lax`.

### T-11 — Coverage gap: the exact-boundary rules of the ship/stop call
`backend/app/experiments/recommendation.py:103,114`
**Claim.** `p_value < ALPHA` → `<=` survives (M12) and `trials >= required_per_arm` → `>` survives
(M11). The peeking guard is the story's headline decision (ADR-0006), and neither of its two
thresholds is pinned at the boundary.
**Fix.** Two cases at exactly `required_per_arm` and at exactly `p = ALPHA`.

### T-12 — Dead test code: an unused driver method and seven unused builder methods
`backend/tests/drivers/breaches_api.py:124` (`when.listed_page`) — implemented, called by nothing.
`backend/tests/builders/feature_flag.py` (`disabled`, `with_cta_label`, `with_tone`,
`with_updated_at`) and `backend/tests/builders/hibp_breach.py` (`with_attribution`,
`with_description`, `with_disclosure_url`) — no callers anywhere in `tests/`, `app/` or `scripts/`.
`frontend/src/testkit/builders/featureFlag.ts` (`disabled`) and `…/breach.ts` (`withTotalBreaches`)
— same. Note `feature_flag.disabled()` is dead because S3 B6 disables the flag with a raw UPDATE in
`visitors_api.py:100` instead, so the builder and the driver encode the same knowledge twice.
**Fix.** Delete the unused methods; point `the_result_screen_tone_flag_is_disabled` at the builder.

### T-13 — Convention: backend entity drivers use a namespace the docs do not define for it
`backend/tests/drivers/feature_flags_api.py:30-32` and 13 sibling drivers
**Claim.** `docs/python-conventions.md` (Tests → Driver namespaces) and the project CLAUDE.md both
define `given / get / post / patch / delete / when / then`, with `when` reserved for "the rare
action that is not one HTTP verb call". `HttpDriver` follows it exactly
(`tests/drivers/http.py:61-66`); all 14 entity drivers expose only `given / when / then` and route
ordinary GET/POST/PATCH calls through `when.*`. PLAUSIBLE that the drivers are the better shape
(`when.the_flag_is_saved_with_a_wrong_token()` reads better than `patch.*`), but one of the two has
to move.
**Fix.** Decide once and amend the conventions table, or rename the request methods.

### T-14 — Convention / minor: a documented error detail and a guard branch with no assertion
- `backend/tests/unit/test_hibp_breach_translator.py:60` asserts the wire field only, not the index
  `[0]` that S2 B1d and `_describe`'s docstring both promise (`adapters/hibp/breach_catalog.py:121`).
- `frontend/src/api/http-client.utils.ts:4` — the `!Array.isArray` clause is unreachable from the
  one test file that exercises it (`normaliseNulls` checks arrays first), and removing it survives
  (F-M11). It is load-bearing only for `isProtectedRouteState`, which has no direct unit test.
- `frontend/src/hooks/usePasswordLeakCheck.ts:25` — `password !== ''` is dead: `isTooShort('')` is
  already true, and removing the clause survives (F-M16).
**Fix.** Add the index to the translator assertion; delete the dead clause; give `isPlainObject` a
one-line array case.

### T-15 — Coverage gap (class): StrictMode is exercised by 5 of 20 frontend drivers
`frontend/src/testkit/renderWithProviders.tsx:25` defaults to `RenderMode.Plain`; only
`VisitorProvider`, `AnalyticsProvider`, `BreachCatalogProvider`, `Scan`, `Protected` and
`Dashboard` opt into `RenderMode.Strict`. Production ships StrictMode. The standing BF58
(Admin flag-list effect under StrictMode) sits precisely in a driver that renders Plain — offered
as the precedent, not re-reported.
**Fix.** Flip the `renderWithProviders` default to Strict and let the failures name themselves, or
add a Strict variant to every driver that owns an effect.

---

## 4. Not covered by this audit

- **No `.only`, `.skip`, `xit`, `xdescribe`, `pytest.mark.skip` or `xfail` anywhere** (CONFIRMED by grep).
- **Assertion placement**: no `expect(` in any `*.test.tsx`; `assert` in backend test bodies appears
  only in the pure-module unit files the conventions exempt (CONFIRMED by grep).
- **`waitFor` under faked timers**: every fake-timer driver either fakes only `setTimeout`/`clearTimeout`
  and asserts synchronously (SearchField, PasswordField, Scan) or leaves `setTimeout` real so
  `waitFor` still drains (BreachSummary). No violation found (CONFIRMED by reading all four).
- **`filterwarnings = ["error", …]`** is in force with one named upstream ignore; `TZ='America/New_York'`
  is genuinely applied (F-M24 proved the January-breach test bites); `IS_REACT_ACT_ENVIRONMENT` is
  declared in `setup.ts`; `clearMocks: true` and the global setup are in place — no test file calls
  `cleanup()` or `afterEach` (CONFIRMED).
- **Integration marker by location** works: `pytest_collection_modifyitems` in `tests/conftest.py`
  applies it mechanically (read, not re-executed under `-m "not integration"`).
- **Commit gate** `.husky/pre-commit` is `pnpm typecheck && pnpm lint && pnpm test`, and the root
  scripts fan out to ruff/mypy/pytest as well as the frontend — the gate does cover both sides
  (CONFIRMED by reading `package.json`).
- **Frontend driver methods**: a mechanical scan of all 20 `*.driver.tsx` found **no** method
  implemented and never called from a test.
- **Fake-network exact-path matching**: `routeAnswers` (`testkit/fake-http.ts:104`) was read and no
  current registration relies on a bare path answering a sub-segment; `/breaches` does not shadow
  `/breaches/summary`. The silent-599 hazard remains, but no live instance was found. PLAUSIBLE that
  a future segmented route re-introduces it — the lint-style guard that would make it mechanical
  does not exist.
- **Not attempted**: any browser/visual check (out of scope here, and HARD RULE 5 forbids the
  reviewer of the code running it); the Cypress layer (there is none); `scripts/simulate_traffic.py`
  beyond its two integration cases; performance or flake-rate sampling (each suite was run to
  completion 3 times without a flake, which is not a flake measurement).
- **Environment note**: the compose `db` container was found running **without** its published
  port mid-audit and was restarted with `docker compose up -d db`. Integration runs before that
  point were re-run afterwards; no finding rests on a run that hit the outage.


---

# Independent review — conventions / named principles (A) and docs-vs-code drift (B)

Repo: `/Users/shalevshushy/guardio/guardio_growth_home_assignment` · HEAD `ddac344` · read-only,
no file in the repo was written or staged.

Checklist derived from, in this order: `~/.claude/intellectual-references.md`,
`~/.claude/docs/lint-index.md`, `docs/python-conventions.md`, all 1,565 lines of `docs/plan.md`,
`docs/design/component-inventory.md`, `docs/changelog.md`, `docs/python-primer.md`, the six ADRs
plus `docs/adr/README.md`, the six `docs/reviews/*`, `README.md`, `docs/writeup.md`, and both
`CLAUDE.md` files. Every production file under `backend/app`, `backend/scripts` and
`frontend/src` was read in full; `*.test.*` / `*.driver.*` were read only to locate duplicated
knowledge and test-only consumers.

---

## A. Convention / principle findings

### CV-1 — `eslint.config.mjs:43-44` switches off the whole of `no-restricted-syntax` for three files, which is the defect BF33 closed and HARD RULE 3 forbids · **CONFIRMED**

```js
    {
        files: ['**/api/http-client.utils.ts', '**/api/http-client.utils.test.ts', '**/main.tsx'],
        rules: { 'no-restricted-syntax': 'off' },
    },
```

The need is real and narrow — `http-client.utils.ts` is the `null → undefined` boundary and
`main.tsx` reads `document.getElementById`, both of which trip `noNullLiteral`. But `'off'`
retires **every** selector the rule carries, and `main.tsx` is a `.tsx` file that renders JSX:
`noInlineJsxLambda`, `jsxTextBackticks`, `noRawTestId`, `noInlineTestFactories` and
`noBooleanParam` are all silently gone there. The same file argues against exactly this move
nineteen lines earlier, at `eslint.config.mjs:38-40`:

> *"Composed, not switched off: every selector the rule carries stays on and only the raw-`expect`
> ban is dropped… `off` would also have retired the inline-factory and raw-testid selectors in
> these files, silently."*

`docs/plan.md:632-634` (BF33) records the identical finding — *"disables **all** of
`no-restricted-syntax` in two places where the documented `pureFunctionTestSyntaxSelectors`
composition would have passed unchanged … HARD RULE 3: the rule was weakened rather than
composed"* — and Phase 4 fixed two of the three sites. This third one was never listed.
**Fix:** compose the selector list minus `noNullLiteral` for the two boundary files, and give
`main.tsx` its own single-selector exemption.

### CV-2 — `backend/app/pwned_passwords/router.py:36-40` sends an on-call error string, including an external URL and an exception `repr`, as the client-facing `{ error }` body · **CONFIRMED**

```python
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"get_pwned_password_range: the password-leak source is unavailable — {error}",
        ) from error
```

`{error}` is the adapter's message built at
`backend/app/adapters/hibp/pwned_password_range.py:54-58`, e.g.
`fetch_range: the range API is unreachable at https://api.pwnedpasswords.com/range/5BAA6 — ConnectError(...)`.
The house contract is *"Error shape is always `{ error: string }` — human-readable, **safe to
surface**"*, and BF38 (`docs/plan.md:651-654`) already named this exact shape as a defect:
*"Messages written under the 'errors are on-call docs' rule are being rendered to a product
surface."* Every other frontend reader maps server detail to its own copy, so no visitor sees
this today — but the body still leaves the process. **Fix:** a fixed visitor-safe `detail`; the
adapter's string goes to `log.warning` only, which line 36 already does.

### CV-3 — `frontend/src/pages/Admin.tsx:33-50` and `frontend/src/pages/Dashboard.tsx:41-62` solve one problem two ways, and the two comments contradict each other · **CONFIRMED**

Admin:

```js
        // Not an AbortSignal: the flag list is a plain read and the only thing that must not
        // happen is a state update after the operator has navigated away.
        let cancelled = false;
```

Dashboard, the next page over, same load-with-retry shape:

> *"the `isCancelled` return is the whole of the protection against a state update after unmount
> (the shape of BF58)"*

DRY-as-knowledge: "how a page load is cancelled" has two authoritative homes with opposite
reasoning. It is also the mechanical cause of the still-open **BF58**
(`docs/plan.md:1239-1243`) — Admin's effect is not StrictMode-idempotent because the
`let cancelled` flag is effect-local, where `VisitorProvider`'s `useRef` and Dashboard's
`AbortController` both survive the cleanup/re-run. Secondary: `let` + reassignment is the
Immutability rule's `prefer-const` signal.
**Fix:** give `fetchFeatureFlags` the required `AbortSignal` the other API functions have
(below) and use the Dashboard shape; BF58 closes with it.

### CV-4 — `frontend/src/api/feature-flags.ts`, `visitors.ts`, `signups.ts`, `funnel-events.ts` do not take the `AbortSignal` that `breaches.ts`, `experiments.ts` and `pwned-passwords.ts` declare mandatory · **CONFIRMED**

`frontend/src/api/breaches.ts:3-5` states the rule:

> *"The signal is required, not optional: a fetch an effect can forget to abort is a state update
> after unmount waiting to happen, so the type makes the caller hold the controller."*

`frontend/src/api/experiments.ts:3-5` repeats it verbatim in substance. Four of the seven API
modules exempt themselves without saying so, and all four are called from effects
(`VisitorProvider.utils.ts:66`, `Admin.tsx:38`). A rule enforced by the type system in three
places and absent in four is not a rule — it is the shape BF58 lives in.
**Fix:** one signature convention across `src/api/**`, or a stated exemption in each file that
opts out.

### CV-5 — Dead production code that the project's own retroactive-YAGNI rule has already come due on · **CONFIRMED** (by a full-tree consumer scan; no non-test consumer exists)

| Symbol | `file:line` | Note |
|---|---|---|
| `forgetVisitorId` | `frontend/src/storage/visitor-id.ts:24` | No caller anywhere. The stale-id path (`VisitorProvider.utils.ts:56-64`) creates a new visitor and `storeVisitorId` overwrites the mirror, so the function was never needed. |
| `hasLeakedPasswords` | `frontend/src/models/breach/selectors.ts:6` | No caller; `isPasswordsDataClass` (line 11) is what `BreachRow` uses. |
| `Box`, `FullRow`, `FullColumn`, `FullBox` | `frontend/src/ui/box.tsx:7,25,31,46` | Four of the seven exported primitives have no production consumer after S7 — only `box.driver.tsx` / `box.test.tsx`. Mitigating: the global stack doctrine names these six primitives as a fixed vocabulary, so this is a judgement call, not a clear delete. |
| `$breakpoint-base`, `$focus-ring`, `$radius-lg`, `$shadow-md`, `$weight-regular`, `$weight-medium` | `frontend/src/styles/tokens.scss:17,137,120,123,96,97` | Six tokens with zero references in any `.scss` file (verified by a parser over all 22 stylesheets). |

The tokens matter most because `docs/plan.md:1053-1059` dismissed the unused-scale finding **on
a stated precondition**: *"The precondition is that they *are* consumed — an entry still unused
when S7 closes is dead code, and Beck's rule 4 reaches it then."* S7 closed 2026-09-19. The
precondition is now violated, and `$focus-ring` in particular is RF7's recorded duplicate of the
live `outline` rule in `global.scss:44`. Beck, Four Rules of Simple Design, Rule 4 — *no test
requires this; delete it.*

### CV-6 — `docs/python-conventions.md`'s "Nothing else imports those libraries" is false for `httpx2`: four importers, two outside the adapter seam · **CONFIRMED**

```
backend/app/adapters/hibp/breach_catalog.py:11      import httpx2 as httpx   (the seam)
backend/app/adapters/hibp/pwned_password_range.py:8 import httpx2 as httpx   (the seam)
backend/app/experiments/simulation.py:23            import httpx2 as httpx
backend/scripts/simulate_traffic.py:19              import httpx2 as httpx
```

Fowler — Adapter / wrap-borrowed-code-once. `simulation.py:14-15` argues its own case
(*"`httpx2` is imported here for the client type only: the seam is the factory"*), which is a
fair exemption; `scripts/simulate_traffic.py` states nothing. **Fix:** either record the
exemption in `docs/python-conventions.md` (the row is otherwise a false invariant a reader will
trust) or type the seam as a narrow `Protocol` so neither module names the library.

### CV-7 — `frontend/src/components/FlagEditor.tsx:109-113` builds a lookup table inside the render body · **CONFIRMED**

```js
    const saveToneClassMap: Record<SaveTone, string | undefined> = {
```

Every sibling map is module-level — `LiftCard.tsx:20`, `RecommendationBanner.tsx:22`,
`BreachSummary.tsx:49`, `Result.utils.ts:27`, `PasswordField.tsx:85`. This one is rebuilt on
every keystroke in the editor. "Expensive objects once" is about cost; the sharper point is
consistency: six identical constructs, five in one place and one somewhere else.
**Fix:** hoist it beside the component, as its five siblings are.

### CV-8 — Law of Demeter: `ExperimentResultModel` is read through three- and two-dot chains although it owns a `selectors.ts` · **CONFIRMED**

- `frontend/src/components/LiftCard.utils.ts:81` — `result.metrics.primary.numerator` (three dots)
- `frontend/src/components/RecommendationBanner.utils.ts:30,37,39` — `result.sample.reachedPerArm`, `result.variant.key`, `result.control.key`
- `frontend/src/pages/Dashboard.utils.ts:51-52` — `result.control`, `result.variant`
- backend mirror: `backend/app/experiments/router.py:55-56` — `read.control.primary.trials`

`frontend/src/models/experimentResult/selectors.ts` exists and holds exactly two predicates.
The house rule is explicit: *"Two-plus dots (`a.b.c`) signals a missing selector. Selectors are
the model's public API."* **Fix:** `primaryMetricStep(result)`, `armKeys(result)`,
`sampleProgress(result)` in `selectors.ts`; the call sites read like sentences afterwards.

### CV-9 — Logging discipline: three log lines carry a function-name prefix that is not the function they are in · **CONFIRMED**

| `file:line` | Message prefix | Enclosing function |
|---|---|---|
| `backend/app/visitors/router.py:80` | `create_visitor:` | `_recognised_visitor` |
| `backend/app/signups/router.py:84` | `create_signup:` | `_known_visitor` |
| `backend/app/visitors/router.py:44-48` | `create_visitor:` | `create_visitor` ✓ (listed for contrast) |

The rule's whole purpose is *"Function name as message prefix so grepping finds the source
without a stack trace."* Here a grep for `create_visitor` lands in the wrong function. Low
severity, trivially fixed; both are arguably "the operation" rather than "the function", which
is worth deciding once and applying.

### CV-10 — `backend/app/adapters/hibp/pwned_password_range.py:49,51` builds the same URL twice, by two different routes · **PLAUSIBLE**

```python
        url = f"{PWNED_PASSWORDS_BASE_URL}{RANGE_PATH}/{prefix}"   # for the messages
        ...
            response = self._client.get(f"{RANGE_PATH}/{prefix}")  # for the request
```

The message URL is reconstructed from a constant rather than read off the request, so a change
to the client's `base_url` would silently make every error message name a URL the adapter never
called. **Fix:** `response.request.url` in the `HTTPStatusError` branch, or one local for the
relative path and `self._client.base_url` for the message.

### CV-11 — `backend/scripts/simulate_traffic.py:49` reads `__doc__` without a guard · **PLAUSIBLE**

```python
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
```

`__doc__` is `None` under `python -OO`, so this is an `AttributeError` at parser construction.
Trivial, and outside the request path; listed for completeness because `strictNullChecks`'s
Python equivalent (mypy strict) does not model `__doc__` as optional.

### CV-12 — `backend/migrations/` is outside mypy's `files` and therefore unchecked · **CONFIRMED**

`backend/pyproject.toml:72` — `files = ["app", "tests", "scripts"]`. The seed migration
(`9b3f1c2d4e5a_seed_result_screen_tone.py`) writes the live experiment's copy as raw JSON and is
the exact path `docs/plan.md:620-623` (BF30) names as the way a malformed split reaches the
table *"past Pydantic"*. Nothing in the docs claims migrations are type-checked, so this is a
gap rather than a false claim — but the project's "mypy strict is the reason untyped Python
cannot land" framing (`docs/plan.md:43`) does not hold for the one directory that writes
production data by hand.

---

## B. Docs-vs-code drift

### `docs/plan.md`

**DD-1 · Repository layout (`:61-94`) is stale in six places** · **CONFIRMED**

| Plan says | Code is |
|---|---|
| `:68` `pyproject.toml … psycopg, **httpx**, argon2-cffi` | dependency is **`httpx2`** (`backend/pyproject.toml:15`). The project CLAUDE.md landmine says *"Never add httpx"* — the plan names the forbidden package. |
| `:72` `app/db/  engine, session dep, **alembic/**` | migrations live at `backend/migrations/` (project CLAUDE.md: *"not `alembic/`, which shadows the library"*). No `app/db/alembic/` exists. |
| `:87` `src/**layout**/  Box Row Column FullBox FullRow FullColumn` | `frontend/src/ui/box.tsx`; there is no `src/layout/`, and there are **seven** primitives (`MainColumn` too). |
| `:92` `src/components/ … **FunnelChart LiftChart**` | neither exists. `FunnelBars` lives in `frontend/src/charts/`; the card is `LiftCard`. Seven further shipped components (`BreachRow`, `SearchField`, `ErrorState`, `FlagEditor`, `HypothesisCard`, `RecommendationBanner`, `Wordmark`) are absent from the list. |
| `:93` `src/testkit/  builders/ **drivers/** setup.ts` | `frontend/src/testkit/` has `builders/` but **no** `drivers/`; every driver sits beside its component. |
| `:85-93` | five shipped directories are unlisted: `src/charts/`, `src/hooks/`, `src/logging/`, `src/shared/`, `src/storage/`. |

**DD-2 · `:56` Decisions → Charts still says Recharts** · **CONFIRMED, already known**
`| Charts | Hand SVG / Recharts | **Recharts**, wrapped once in a `charts/` adapter.`
No Recharts in `frontend/package.json`; `charts/FunnelBars.tsx` is native `<meter>` elements.
S7 design call 2 (`:1395-1401`) records the deviation, and `docs/writeup.md` names it as known
drift — but the Decisions row itself was never corrected, so the authoritative table still
states the wrong decision. **Correction:** rewrite the row, pointing at design call 2.

**DD-3 · `:123` and `:1073` say the urgent subheadline / tile is `17.8B`; the seeded copy is `17.7B`** · **CONFIRMED**
`backend/migrations/versions/9b3f1c2d4e5a_seed_result_screen_tone.py:46`:
`"subheadline": "17.7B accounts have leaked. Yours could be among them."`
`README.md` also says 17.7B. Note `:1099` (`formatCount(17816217392) → 17.8B`) is a *different*
claim about the formatter and is correct — only the copy lines are wrong.

**DD-4 · `:644` `[ ] BF36` and `:662` `[ ] BF42` are unticked, and the same file declares both closed at `:811-812` and measures them closed at `:961-962`** · **CONFIRMED**
Verified in code: `$color-disabled-fill`/`$color-disabled-text` are applied in the
`button-primary:disabled` rule (`frontend/src/styles/_fields.scss:84-89`) and `$text-100` is
16px. Both are genuinely fixed; only the checkboxes lie. **Correction:** tick them, or add the
one-line pointer the D1 carry paragraph earns.

**DD-5 · BF51, BF52 and BF53 (`:1005-1026`) were scheduled "before or during S5" and are all three still open, and none appears in the project CLAUDE.md "Carried, deliberately" list** · **CONFIRMED**

- **BF51** — `frontend/src/pages/Admin.tsx:125` (failed load) and `:136` (loading) both render
  `className={styles.message}`; `frontend/src/pages/Admin.module.scss:41` defines exactly one
  chip class and never includes `message-error`. And `FlagEditor.utils.ts:114-120` still maps
  `SaveStatus.Failed` **and** `SaveStatus.Conflict` to `SaveTone.Unsaved`
  (`FlagEditor.module.scss:97,102`, both `message-warning`). Both surfaces are exactly as
  described. *(Partly moved: `message-error` did gain consumers elsewhere — see DD-9.)*
- **BF52** — `frontend/src/styles/tokens.scss:23,28`: `$color-surface: #ffffff`,
  `$color-border: #d0d5d9`. Computed contrast **1.48:1**, the value the finding states. Unchanged.
- **BF53** — `frontend/src/styles/_fields.scss:65-72` `button-base` still declares no
  `box-sizing` while the `input` mixin ten lines above does (`:26`), and `button-primary`
  toggles `border: 0` (`:80`) → `border: 1px solid` on `:disabled` (`:87`). The 2px height jump
  on every click is still reachable.

No commit in the history mentions BF51/52/53 (`git log --grep='BF5[123]' -i` → empty). S5, S6 and
S7 closed without carrying them. **Correction:** either tick them in D1's triage or add them to
CLAUDE.md's "Carried, deliberately" paragraph — silently unclosed is the one state the plan's own
format is designed to prevent.

**DD-6 · `:19-25` TDD contract §2 — "Every commit below is one of three kinds … Nothing else exists" — is contradicted by 23 commits** · **CONFIRMED**

```
$ git log --format='%h %s' | grep -vE '^[0-9a-f]+ (chore|refactor|test\+impl)' | wc -l
23
```
Ten `fix:` commits (`407450e`, `325e82b`, `9e58054`, `bf6f3b0`, `5edb023`, `3d2c7b6`, `9965915`,
`a6eea9b`, `0ebc054`, `ac888ff`), two bare `test:` (`3d9ba90`, `b0ab1e2`), ten unprefixed S1
commits, and `5cc9f08 wip`. Several triages record *mislabelled* commits (S4 BF50, S5 F-11,
S6 R-13, S7 R-11) but none records the existence of a fourth and fifth commit kind.
**Correction:** the contract should name `fix` (it is an honest kind and ten commits use it) or
the history should be acknowledged. The same sentence appears verbatim in `docs/writeup.md` —
see DD-13.

**DD-7 · `:109` API contract says `POST /api/visitors` → `201`; the handler answers `200` for a recognised cookie** · **CONFIRMED**
`backend/app/visitors/router.py:49` — `response.status_code = status.HTTP_200_OK`. ADR-0003's
BF26 amendment documents the 200; the contract table does not. **Correction:** `201` on create,
`200` on a recognised `visitor_id` cookie.

**DD-8 · `:112` the summary contract omits `syncedAt`** · **CONFIRMED**
`BreachSummaryResponse.synced_at` (`backend/app/breaches/schemas.py:121`) shipped in S2b (case
R3) and the result screen renders it (`BreachSummary.tsx:41-43`). Same row: `:116` PATCH
`/api/feature-flags/{key}` also answers **400** when the split would orphan assignments
(`backend/app/feature_flags/router.py:67-74`, BF31) — not listed.

**DD-9 · `:1035` RF5 "`Admin.module.scss:56` `max-width: 720px` is the only raw literal left in a `.module.scss`" is no longer true** · **CONFIRMED**
Added since: `pages/Signup.module.scss:85` `max-width: 400px`, `pages/Protected.module.scss:18`
`max-width: 480px` and `:25` `width: 56px`, `components/RecommendationBanner.module.scss:6`
`$progress-height: 8px`, `components/PlanPicker.module.scss:62-64` `$ring-*`, plus the S5 F-10
set that RF5 post-dates. **Correction:** RF5's "only" is now "one of several"; the
undeclared-literal decision it defers is larger than it states, and the project CLAUDE.md HARD
RULE (*"a deviation is recorded in the inventory or it is a defect"*) reaches each of them.

**DD-10 · `:694-696` RF item "the flag key … appears as a literal 17 times across 10 files … Two backend drivers each declare their own copy" understates the current state** · **CONFIRMED**
37 literal occurrences across 23 files. **Six** backend test drivers now each declare their own
`RESULT_SCREEN_TONE = "result_screen_tone"` (`tests/drivers/simulation.py:26`,
`feature_flags_api.py:18`, `visitors_api.py:19`, `flag_splits.py:17`, `experiment_results.py:21`,
`funnel_events_api.py:23`). The half about `RESULT_SCREEN_TONE_FLAG` having zero consumers **is
now fixed** — three production readers (`Dashboard.tsx:46`, `Result.utils.ts:47`, plus the
Dashboard driver). **Correction:** the count, and the fact that the duplication grew.

### `docs/design/component-inventory.md`

**DD-11 · `:79` "`message-error` is defined and used by nothing" is false** · **CONFIRMED**
Two consumers: `frontend/src/components/RecommendationBanner.module.scss:30`
(`@include fields.message-error`, with its own comment *"`message-error` gains its first consumer
here (BF51 listed it as unused)"*) and `frontend/src/pages/Signup.module.scss:66`. The rest of
the same cell — *"a failed load renders as the neutral chip and a save failure shares
`message-warning` with a lock conflict"* — is **still accurate** (see DD-5). **Correction:**
split the cell: the mixin has consumers; the two named surfaces still do not use it.

**DD-12 · `:114` "the variant cards are not yet tinted by tone: that needs `toneClassMap`, which S5 introduces, and the admin page adopts it then"** · **CONFIRMED**
S5 shipped `toneClassMap` (`frontend/src/pages/Result.utils.ts:27`) and the admin page did not
adopt it — `FlagEditor.module.scss` has no tone class. The project CLAUDE.md correctly carries
this as *"deviation 6"*, so the code is fine; the inventory sentence's tense ("S5 introduces …
adopts it then") is what is stale. **Correction:** past tense plus the carry.

### `docs/writeup.md`

**DD-13 · "Every commit is one case red-to-green, a refactor, or a chore" (Approach, bullet 5)** · **CONFIRMED FALSE** — see DD-6. This is the one document an evaluator reads first, and the
claim is checkable in one `git log` command. The same bullet's *"211 commits over three days"* is
now 214 and rising (S8 is open); acceptable as an as-of figure, but it will drift again before
the repo is handed over.

### `docs/python-primer.md`

**DD-14 · No entry for `scipy` anywhere in the file, although S7 landed it** · **CONFIRMED**
`backend/app/experiments/stats.py:16` `from scipy import stats`, used at `:25-26`
(`stats.norm.ppf`) and `:73` (`stats.norm.sf`). The project CLAUDE.md rule is explicit: *"New
Python constructs get a section in `docs/python-primer.md` in the same story."* The S7 section
(`:333-391`) covers eleven constructs and omits the one third-party numerical import in the
codebase — including the `sf`-over-`1 - cdf` precision reasoning, which is the least obvious line
in `stats.py` and already has a comment worth promoting. Everything else the brief asked me to
check is present: `SecretStr` (`:299`), `ON CONFLICT … RETURNING` (`:326`), `scope="function"`
(`:381`), `SystemRandom` (`:366`).

### `docs/python-conventions.md`

**DD-15 · "Wrap borrowed code once … Nothing else imports those libraries"** · **CONFIRMED FALSE** for `httpx2` — see CV-6. `argon2`, `ulid` and `scipy` each have exactly one importer ✓.

**DD-16 · Types table: "Enums, never string literals … | ruff `PLR2004` (magic values) partially"** · **CONFIRMED FALSE**
`backend/pyproject.toml:52-54` puts `PLR2004` in the global `ignore` list, not a per-file
ignore — the rule is off in `app/**` as well as `tests/**`. The row credits a mechanical
enforcement that does not run. **Correction:** the row is review-only. (The `ignore` itself has
a stated rationale and is listed in section D, not raised as a HARD RULE 3 violation.)

**DD-17 · Types table: "No boolean parameters | ruff `FBT` (added when the first case appears)"** · **CONFIRMED, informational** — `FBT` is not in `select` and no boolean-parameter case exists in
`backend/app/**`, so the row is honest; noted only because it reads as a live rule.

### `README.md`

**DD-18 · "The token is required in `.env` with no default" vs `.env.example:20` shipping `ADMIN_TOKEN=change-me-before-exposing-this`** · **CONFIRMED — the most consequential drift here**

The compose guard is real: `docker-compose.yml:38` uses `${ADMIN_TOKEN:?…}`, which refuses an
unset *or empty* value. But the documented first-run recipe is
`cp .env.example .env # then set ADMIN_TOKEN`, and after the `cp` the variable **is** set — to a
string committed to the repository. A user who follows the recipe and skips the comment gets a
booting stack whose flag-write gate is a token every cloner has. That is BF28
(`docs/plan.md:606-611`) — *"`ADMIN_TOKEN` defaulting to a token committed to the repo"* — moved
one file to the left, and it collides with the global HARD RULE on hardcoded credentials, which
has no exceptions. The compose comment at `:36-37` argues the case against itself:

> *"No default: a token committed here is a token everyone who clones the repo has, and it gates
> the write that rewrites what every visitor reads."*

**Correction:** `ADMIN_TOKEN=` (empty) in `.env.example` with the `openssl rand -hex 24`
instruction, so the compose `:?` guard fires for anyone who skips the step. The README, the
project CLAUDE.md recipe and `.env.example`'s own comment are then all true at once.

**DD-19 · "About two working days … across 211 commits"** — 214 at HEAD. As-of figure; see DD-13.

Everything else in the README checks out against the code: the ports bind to `127.0.0.1`
(`docker-compose.yml:10,44,55`); the run, dev and check commands match `package.json` and
`infra/dev.sh`; the pre-commit hook does run all three (`.husky/pre-commit`); the two-variant
copy table matches the seed migration exactly; and every number in "The read and the call" —
144/1,940 (7.4%), 185/1,885 (9.8%), z = 2.64, p = 0.008, +32% (+7% to +63%), 4,921 required,
1,885 reached, `KEEP_RUNNING` — matches `docs/simulation-read.json` field for field.

### Project `CLAUDE.md`

**DD-20 · "Carried, deliberately" omits BF51, BF52, BF53** · **CONFIRMED** — see DD-5. The
paragraph carries deviation 6, BF58, BF59, DV3 and the unmeasured `/admin` states, so the
omission reads as "closed", not "carried".

**DD-21 · Everything else in "What's done" verifies** · **CONFIRMED**
- "225 backend, 208 frontend" — 226 backend `def test_` (one is another session's throwaway
  probe, so 225) and 208 `it(` calls. ✓
- "no inline style anywhere" — zero `style={`, `style="`, `cssText` or `setProperty` in
  production `frontend/src`. ✓
- "`SessionDep = Depends(get_session, scope="function")` commits before the response is sent" —
  `backend/app/db/session.py:30`. ✓
- "the arm is the stored `visitor_assignment`, never the event tag" —
  `backend/app/experiments/repository.py:24-34` joins `VisitorAssignmentRow`. ✓
- "`$series-1/2` alias the tone accents" — `tokens.scss:67-68`. ✓
- S5 "28 commits (21 test+impl, 3 refactor, 4 chore)" — exact against `story/S5..story/S5-done`. ✓
- S7 "17 commits" / S6 "14 commits" — 18 and 15 between the tags, the extra being each story's
  `/story-start` plan chore; the convention is consistent across both, so the figures are sound.

### Git tags (not a document, but the plan's mechanism)

**DD-22 · `story/S6-done` points at S5's closing commit, so S6's story range is empty** · **CONFIRMED**

```
story/S5-done -> e8eee7d9 chore: close S5 — review triage, corrected claims, state
story/S6      -> e8eee7d9   (same commit)
story/S6-done -> e8eee7d9   (same commit)
$ git rev-list --count story/S6..story/S6-done
0
```

`/story-done` is supposed to tag the story's closing commit (HARD RULE 2). S6's fifteen commits
sit between `e8eee7d9` and `story/S7` (`61c346b9`) and are bracketed by nothing. Any later
`git log story/S6..story/S6-done` — the diff `/story-done` itself reviews — silently returns
empty. **Correction:** move the tag to `61c346b9^` (S6's last commit before the S7 start tag),
or delete it and say so.

---

## C. Duplicated knowledge

Legend: **recorded** = the duplication is named in a comment, ADR or the plan; **none** = no
recorded reason found.

| Knowledge | Homes | Recorded reason |
|---|---|---|
| Flag key `result_screen_tone` | `backend/app/experiments/hypothesis.py:45`; seed migration `:61`; **six** backend test drivers each declaring their own copy (`simulation.py:26`, `feature_flags_api.py:18`, `visitors_api.py:19`, `flag_splits.py:17`, `experiment_results.py:21`, `funnel_events_api.py:23`); `frontend/src/models/featureFlag/model.ts:34`; three frontend testkit builders | **Partial** — the S3 RF-backlog names it, but understates it (DD-10) and it has grown since |
| Control copy (`Known breaches` / `Here's the public record…` / `Protect me` / calm) | `frontend/src/pages/Result.utils.ts:37-42`; seed migration `:35-38` | **Recorded, ADR-0004.** Verified byte-identical today ✓ |
| `FunnelEventName` — six members and their wire strings | `backend/app/funnel_events/models.py:27-32`; `frontend/src/models/funnelEvent/model.ts:6-11` | **none** (the frontend enum carries no "the backend's enum carries the same" note that `Plan`, `Tone`, `Recommendation` and `BreachSortColumn` all carry) |
| `Plan` (`basic` / `family`) | `backend/app/signups/models.py:26-27`; `frontend/src/models/signup/model.ts:5-6` | recorded, both sides |
| `Tone` (`calm` / `urgent`) | `backend/app/feature_flags/schemas.py:28-29`; `frontend/src/models/featureFlag/model.ts:5-6` | recorded, both sides |
| `Recommendation` (3 members) | `backend/app/experiments/recommendation.py:30-32`; `frontend/src/models/experimentResult/model.ts:7-9` | recorded, frontend side |
| Sort columns (`breachDate`/`pwnCount`/`name`) | `backend/app/breaches/schemas.py:31-33`; `frontend/src/models/breach/model.ts:53-55` | recorded, frontend side |
| `"Passwords"` data class | `backend/app/breaches/summary.py:20` `PASSWORDS_CLASS`; `frontend/src/models/breach/model.ts:73` `PASSWORDS_DATA_CLASS` | **none** |
| Weight total / bucket count = 100 | `backend/app/feature_flags/assignment.py:14` `BUCKET_COUNT`; `frontend/src/models/featureFlag/model.ts:38` `WEIGHT_TOTAL` | recorded (frontend comment explains the backend rejects anything else) |
| Password floor = 8 | `backend/app/signups/schemas.py:16`; `frontend/src/components/PasswordField.utils.ts:19` | recorded (*"Mirrors the backend's floor for the inline message only; the backend is the boundary"*) |
| Admin header name `X-Admin-Token` | `backend/app/feature_flags/admin.py:19`; `backend/app/main.py:65` (CORS `allow_headers`, a raw literal); `frontend/src/api/feature-flags.ts:7` | **none** — and `main.py:65` is a literal, not the constant one import away |
| HTTP status literals | `409` in `frontend/src/components/FlagEditor.utils.ts:6` **and** `frontend/src/pages/Signup.utils.ts:37`; `404` in `frontend/src/providers/VisitorProvider.utils.ts:37` | **none** — three private constants for one vocabulary; the S3 RF-backlog moved `HTTP_CONFLICT` once already |
| Event id prefix `evt_` | `frontend/src/shared/ids.utils.ts` callers (`AnalyticsProvider.tsx:100`, `useTrackOnce.ts:13`, `Scan.tsx:33`); `backend/app/funnel_events/schemas.py:15-17` `EVENT_ID_PATTERN`; `backend/app/experiments/simulation.py:164` | recorded in the pattern's comment (*"`evt_` and either a UUID body … or a ULID body"*) |
| Scan moment = 2s | `frontend/src/pages/Scan.utils.ts:13` `SCAN_MOMENT_MS = 2000`; `frontend/src/styles/tokens.scss:136` `$scan-moment: 2s` | recorded (*"change both or the bar will finish before or after the page does"*) — two homes by necessity, flagged in the comment |
| Debounce 300 ms | `SearchField.utils.ts:12`; `PasswordField.utils.ts:24` | **not a violation** — two independent rules that happen to share a value today |
| Route paths | `SCAN_ROUTE` in `Landing.utils.ts:16`, `RESULT_ROUTE` in `Scan.utils.ts:16`, `SIGNUP_ROUTE` in `Result.utils.ts:10`, `PROTECTED_ROUTE` in `Signup.utils.ts:21`, `DASHBOARD_ROUTE` in `Dashboard.utils.ts:8` — but **`/`** and **`/admin`** are raw literals in `App.tsx:21,27` | **partial** — each constant lives in the page that *links to* it rather than the page it names, and two routes have no constant at all |
| Page size 20 / TTL 24h / retry 5 min | backend only (`schemas.py:16`, `staleness.py:13,16`) | single home ✓ |
| Alpha / power / baseline / MDE | backend only (`stats.py:20,23`, `hypothesis.py:56-57`); the frontend renders them from the wire | single home ✓ |

---

## D. Suppressions

| Kind | Where | Justification present? |
|---|---|---|
| `# type: ignore` | **none anywhere in the repo** | — |
| `typing.cast` | **none** | — |
| `typing.Any` | `backend/tests/drivers/http.py:18,180,193,216,331`; `backend/tests/drivers/experiments_api.py:11,37,43,49` (9 sites, all `dict[str, Any]` for decoded JSON bodies) | **Implicitly** — `docs/python-conventions.md` scopes the ban to `app/**`, so tests are out of scope. No per-site comment. Production `app/**` is clean. |
| `# noqa` | `backend/migrations/env.py:14,16,17,18,19` — `# noqa: F401` on five model imports | **Yes**, once: line 14 carries `— imported so autogenerate sees it`; the four below inherit it by position. Legitimate (Alembic's metadata-registration idiom). |
| `eslint-disable` / `@ts-ignore` / `@ts-expect-error` / `as any` / `as X` / `!` non-null | **none anywhere in `frontend/src`** | — |
| Rule turned off in config | `eslint.config.mjs:43-44` — `'no-restricted-syntax': 'off'` for three files | **Yes** (*"Boundary files that must speak null"*), but the reason justifies one selector and the fix removes all of them — **raised as CV-1** |
| Rule turned off in config | `eslint.config.mjs:56` — `'no-console': 'off'` for `**/logging/logger.ts` | Yes, and correct: that file *is* the logger the rule points at |
| Rule turned off in config | `eslint.config.mjs:62` — `'no-restricted-imports': 'off'` for `http-client.ts` and `testkit/fake-http.ts` | Yes, and it matches `lint-index.md`'s "one entry + one override exemption per wrapper file" |
| Rule ignored in config | `backend/pyproject.toml:53` — `PLR2004` in the global `ignore` | Yes (*"magic values in tests are the expected values; mypy + names cover production"*), but the scope is global, not tests-only — **see DD-16** |
| Per-file ignores | `backend/pyproject.toml:56-60` — `S101`, `S105`, `S106` under `tests/**` | Yes, each with a one-line reason; all three are standard for a pytest suite |
| Warning filter | `backend/pyproject.toml:87-90` — one `ignore:` beside `error` | Yes, with the upstream package, the version and the removal condition named |

---

## E. Not covered

- **The repository was being modified by another session while I read it.** `git status` at my
  start showed only `?? docs/adr/README.md`; partway through it showed
  `M frontend/src/pages/Result.tsx` and `?? backend/tests/integration/test_zz_probe.py`
  (a throwaway CORS probe, header: *"THROWAWAY review probe — delete after running"*), and by the
  end `M docs/changelog.md`. I changed nothing and staged nothing. My reads are of whatever was on
  disk at the moment of each read; the committed HEAD (`ddac344`) is what every `file:line`
  citation should be checked against.
- **No test suite was executed.** `pnpm test` and `pytest` share the compose database on 5433
  with the concurrent session, and a run would have collided with its probe. Test *counts* were
  taken by static enumeration (`def test_` / `it(`), not by running. Nothing in section A or B
  depends on a test result.
- **No UI was rendered.** This is a code-and-docs review; every visual claim I verified
  (BF52's 1.48:1, BF53's 2px jump, BF51's identical chips) was computed or read from source, not
  measured in a browser. `docs/reviews/*` visual findings I spot-checked (V2, V3, V9) are all
  genuinely fixed in the stylesheets; I did not re-measure them.
- **`docs/design/claude-design-export/` (16 committed `.dc.html` files and `support.js`)** was not
  read against the inventory. It is the design's own artifact, committed verbatim by an explicit
  decision, so the inventory's translation table is the thing under review and the export is the
  source it cites.
- **`docs/reviews/s3-review.md` (827 lines)** was skimmed, not audited line by line; the S3
  findings were instead checked through the plan's triage, whose checkboxes I verified against the
  code for every unticked item.
- **`backend/tests/**` conventions** (driver namespaces, builder `with_*` immutability, GWT
  phasing) were only sampled while tracing duplicated knowledge. A dedicated testing-conventions
  pass would be a separate review.
- **Performance** is out of scope; one recorded item is worth re-reading in light of S7:
  `visitor_assignment.flag_key` still has no index (`backend/app/visitors/models.py:24-31`), and
  `count_visitors_per_step` now filters on it on every dashboard load. The S3 RF-backlog predicted
  exactly this; it is a live query today rather than a future one.
