# Breach Scan Funnel

A mobile-first breach-scan funnel over the public Have I Been Pwned catalogue, with one A/B test
on the result screen driven by a database-backed feature flag that product retunes without a
deploy, every funnel step stored per visitor and tagged with their variant, a traffic simulator,
and an in-app statistical read of the test. Guardio growth take-home.

**Read first:** [`docs/writeup.md`](docs/writeup.md) — how it was approached, where AI helped,
where it was wrong and how that was caught, and what I would do with more time.

## Running it

```sh
cp .env.example .env          # then set ADMIN_TOKEN — `openssl rand -hex 24`
docker compose up -d --build  # frontend on :5173, backend on :8000, Postgres on :5433
```

Then open <http://localhost:5173>. The backend applies its migrations on start, seeds the one
experiment, and pulls the breach catalogue from HIBP before it starts serving (about a second).
If HIBP is unreachable on a first boot, the scan answers 503 with a message and the next request
retries the pull; it never serves an empty list as if it were the record.

Every published port binds to `127.0.0.1`. The stack is a development stack and is reachable from
the machine it runs on and nowhere else; reaching it from a phone on the same network needs a
deliberate rebind in `docker-compose.yml`.

| Page | What it is |
|---|---|
| `/` → `/scan` → `/result` → `/signup` → `/protected` | The funnel, in the brief's order |
| `/admin` | The feature flag: split, copy, on/off — the product-facing control |
| `/dashboard` | The read: funnel by variant, lift with its interval, and the call |

**While editing**, `pnpm dev` (needs [`uv`](https://docs.astral.sh/uv/) and `pnpm`) runs the same
stack with hot reload: the compose database, the migrations, then uvicorn `--reload` and the
Vite dev server in parallel, with `/api` proxied to :8000. One Ctrl-C stops both servers; the
database stays up. The three parts are also separate scripts — `dev:db`, `dev:backend`,
`dev:frontend` — for a terminal each.

**Checks:** `pnpm typecheck`, `pnpm lint` and `pnpm test` each run the frontend and the backend.
`pnpm test` needs the same `.env` plus the compose database (`docker compose up -d db`), which
the backend integration tests run against. The husky pre-commit hook runs all three, so nothing
in `git log` was committed red.

## The funnel

1. **Landing** — one promise and one button, "Scan known breaches". No email box: the scan is
   the public record, the same for everyone, so the scanning moment is part of the experience
   and not a lookup.
2. **Scan** — a two-second moment that waits for the record to load, then hands over.
3. **Result** — the heart of the exercise. Four summary tiles, a browsable list of every known
   breach with search, data-class chips, a verified-only toggle and a three-way sort, and one
   "Protect me" button. This is the screen the A/B test changes.
4. **Sign-up** — a plan (Basic or Family, mock prices, no payment), an email, and a password
   that is checked against Pwned Passwords as it is typed. A leaked password warns and does not
   block. The account is stored with an Argon2id hash, never the SHA-1 the leak check computes
   (ADR-0005: an unsalted fast hash that a public database already indexes is a lookup key, not
   a credential).
5. **Protected** — the confirmation. Reaching it is the activation, and activation is the KPI.

### Product decisions on the result screen

The brief leaves the summary, the sort and the filters as product calls. These are the calls:

- **The four tiles** are the four reasons to buy protection: breaches in the last twelve
  months (this is still happening), total accounts exposed (the scale), the share of breaches
  that leaked passwords (why the password check matters), and the single largest breach, named
  (a name a visitor recognises lands harder than a count). The tiles say when the record was
  last synced.
- **Default sort is newest first**, because "is this recent?" is the question a visitor brings.
  The alternatives are most accounts and name.
- **Filters are search, one data-class chip and a verified-only toggle.** A year range was
  considered and cut: it is the worst control of the four on a 390px thumb, and the newest-first
  sort already answers what it would. Retired and fabricated breaches are hidden by default.
- **Every sort and filter is a server query** over our own copy of the catalogue, 20 rows a
  page with "Load more". The browser never sorts or filters 1,000 records.
- **The record is ours, refreshed daily.** The catalogue is stored in Postgres, synced at boot
  and refreshed in the background once it is a day old (ADR-0002). HIBP being slow or down does
  not make the funnel slow or down; HIBP being down with an empty table is a visible error,
  never fake data.

## The experiment

**Hypothesis, stated up front:** an urgent framing of the result screen raises the activation
rate — visitors who complete a scan and go on to activate — by at least 20% relative, from a
baseline of 8%.

**Primary metric:** activation / scan completed, per variant. **Secondary:** CTA click / scan
completed. **Guardrail:** activation / CTA click, so a variant that wins by luring clicks it
cannot convert shows up as such.

**The two arms** are the same data under two framings, 50/50 by default:

| | Headline | Subheadline | Button | Look |
|---|---|---|---|---|
| `calm` (control) | Known breaches | Here's the public record of data breaches. | Protect me | neutral |
| `urgent` (variant) | You're exposed! | 17.7B accounts have leaked. Yours could be among them. | Protect me now | red tone, the exposed-account count counts up |

**Assignment is server-side and stored** (ADR-0003). A visitor's first request creates a visitor
row and a cookie, hashes the visitor id against the flag's live weights, and stores the result.
The same visitor sees the same screen on every refresh because the assignment is a row, not a
recalculation. Changing the weights on `/admin` moves **new visitors only**; everyone already
assigned keeps what they saw, which is what keeps the eventual read honest.

**Every funnel step is stored and tagged.** Six events — `landing_view`, `scan_started`,
`scan_completed`, `cta_click`, `signup_started`, `activation` — each written once under the
visitor the server's cookie names, stamped with the flag and variant from the stored assignment.
The browser cannot name a visitor id in the body, and a replayed event is ignored, not counted
twice.

### The feature flag, for product

The experiment is a row in the `feature_flag` table, edited on `/admin` — no engineer, no
redeploy. To retune it:

1. Open <http://localhost:5173/admin>. The page loads without a token and shows the current
   configuration.
2. Paste the admin token (the `ADMIN_TOKEN` from `.env`) into the field at the top. It lives in
   that tab for that session only.
3. Change what you need: the **weights** (they must add up to 100), each variant's **headline**,
   **subheadline** and **button label**, or the **enabled** switch that stops assigning
   altogether. A stopped flag sends every new visitor the calm control.
4. **Save.** The change is live for the next visitor. If someone else saved while you were
   editing, the save is refused and the page says so, rather than silently overwriting their
   change; reload and apply yours to the current version.

What product cannot change here is the hypothesis — the baseline and the minimum lift the test
is powered for. That lives in code (`backend/app/experiments/hypothesis.py`), because an operator
who could raise it after a disappointing week would be moving the finish line. Changing it is a
commit.

The write is protected by the token; reads are open. The section at the end says exactly what
that does and does not buy.

## The read, and the call

`/dashboard` reads the stored events for the flag and shows the hypothesis, the funnel step by
step for each arm, the three rates, the lift with its 95% interval on both scales, how much of
the required sample has arrived, and one of three calls: ship the variant, keep the control, or
keep running. Everything on it comes from `GET /api/experiments/result_screen_tone/results`,
which is what the simulator prints at the end of a run, so the number below is the number on the
screen.

**The statistics** (ADR-0006): a pooled two-proportion z-test on the primary metric, two-sided at
alpha 0.05; the interval on the absolute lift from the unpooled standard error and on the
relative lift by the delta method on the log ratio; the required sample per arm computed from
the hypothesis at power 0.8, not from the data. **Significance alone does not earn a call:** ship
or keep-control needs a significant test *and* the smaller arm past the required sample *and* a
statable lift. Anything less is keep running. A dashboard refreshed daily is a sequential look
at the data, and a null test will cross p < 0.05 at some look if the reader may stop there.

**The simulated run.** 4,000 visitors walked through the real HTTP API one browser each, with
per-step drop-off and the activation rate set at 8% for calm and 10% for urgent:

```sh
cd backend
uv run python scripts/simulate_traffic.py --visitors 4000 --activation calm=0.08 urgent=0.10
```

| | Control (`calm`) | Variant (`urgent`) |
|---|---|---|
| Scan completed | 1,940 | 1,885 |
| Activated | 144 | 185 |
| **Activation rate (primary)** | **7.4%** | **9.8%** |
| CTA click rate (secondary) | 34.8% | 35.5% |
| Activation per click (guardrail) | 21.3% | 27.6% |

| Test | Value |
|---|---|
| z | 2.64 |
| p | 0.008 |
| Absolute lift | +2.4 pp (95% CI +0.6 to +4.2) |
| Relative lift | +32% (95% CI +7% to +63%) |
| Required per arm | 4,921 scan completions |
| Reached per arm | 1,885 |
| **Call** | **`KEEP_RUNNING`** |

The full response is in [`docs/simulation-read.json`](docs/simulation-read.json). The table
behind it holds 4,764 visitors: the 4,000 of this run, 750 from a first run that crashed on a
bug the run itself found (see the write-up), and 14 manual ones from driving the funnel in a
browser.

**The call is keep running, and that is the right call.** The effect is significant at this
look, the interval excludes zero on both scales, and the dashboard still declines to ship it,
because 1,885 completions per arm is short of the 4,921 the hypothesis was powered for. That is
the peeking guard doing its job. A PM who wants a call at this sample wants a sequential test,
not a smaller number, and the dashboard says so rather than shipping on a lucky look.

**Stated plainly:** the simulator *encodes* the effect it is asked for. This run validates the
pipeline — cookie identity, stored assignment, distinct-visitor counting, the statistics — and
says nothing about whether urgency actually moves activation. That question needs real traffic.

## How it is built

- `frontend/` — Vite, React 19, TypeScript strict, react-router, axios. Layout by a handful of
  flex primitives and SCSS modules over one token file (`src/styles/tokens.scss`), which holds
  every colour, size and breakpoint the design uses. Responsive by CSS alone — no width branch
  in JavaScript — so one DOM tree serves 390, 768 and 1280 and every test covers all three.
  Vitest with a driver per component; tests never touch the network.
- `backend/` — FastAPI + Pydantic v2 at the boundary, SQLAlchemy 2 and Alembic on Postgres, sync
  throughout, structlog with a correlation id per request, scipy for the statistics. One
  transaction per request, committed before the response leaves. Ruff, mypy `--strict`, pytest.
  HIBP sits behind two ports with in-memory fakes; `backend/app/main.py` is the only place the
  real adapters are named.
- `docs/` — [`plan.md`](docs/plan.md) (the build plan, story by story, with each review's
  triage), [`changelog.md`](docs/changelog.md) (one plain-words entry per story),
  [`adr/`](docs/adr/README.md) (six decisions with their alternatives), the design tokens and
  component inventory under `design/`, the visual-review records under `reviews/`, and
  [`python-primer.md`](docs/python-primer.md) — the backend was written in a language I am new
  to, and the primer is the map from the TypeScript conventions I know to the Python that landed.

## The admin gate, and what it is not

`/admin` is where the running experiment is retuned: the traffic split, the copy each variant
serves, and whether the flag assigns at all. Reads are open — `GET /api/feature-flags` needs
nothing, so an unauthenticated `/admin` is a page that shows the current configuration and can
change none of it. Only the write is gated.

`PATCH /api/feature-flags/{key}` requires an `X-Admin-Token` header carrying a shared secret,
compared with `hmac.compare_digest`. The token is a required setting: the stack refuses to start
without one, and there is no default in the repository, because a default committed here is a
credential everyone who clones the repository holds.

**This is deliberately short of authentication, and the shortfall is the point to be explicit
about.** There are no accounts, no sessions and no authorisation: anyone holding the token can
make any change, and nothing records who made it. What it buys is that the write is not open to
whoever finds the page. A real deployment would want an identity behind each change and an audit
trail of them, and neither is here.

The operator pastes the token into the field at the top of `/admin`, where it lives in React state
for that tab only — never in the Vite build, which would ship it to every visitor, and never in
`localStorage`, which would leave it on the machine. It is sent as a header rather than in the URL,
which lands in access logs, or the body, which the update schema rejects.

## Time spent

Roughly two working days, spread over three calendar days (17–19 September 2026). The commit
timestamps bracket about 16 hours of active work across 211 commits, counting every gap under
ninety minutes as work; on top of that sit the planning before the first commit and the design
session in Claude Design, neither of which left a commit. The plan budgeted one day for the core
and a second for stretch; the core took the two, and the stretch list (`docs/plan.md`, E2) is
what I would do next.
