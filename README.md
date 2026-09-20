# Breach Scan Funnel

A mobile-first breach-scan funnel on public HIBP data, one A/B test on the result screen driven
by a feature flag product can retune without a deploy, every funnel step stored per visitor, a
traffic simulator, and an in-app read of the test. Guardio growth take-home.

**Read first:** [`docs/writeup.md`](docs/writeup.md) — approach, where AI helped, what I'd do next.

## Run it

```sh
cp .env.example .env          # then set ADMIN_TOKEN — `openssl rand -hex 24`
docker compose up -d --build  # frontend :5173, backend :8000, Postgres :5433
```

Open <http://localhost:5173>. Migrations, the seeded flag and the HIBP catalogue load on start;
ports bind to `127.0.0.1` only.

| Page | What |
|---|---|
| `/` → `/scan` → `/result` → `/signup` → `/protected` | the funnel |
| `/admin` | configuring the experiments |
| `/dashboard` | data about the a/b test |

A browser is assigned once and keeps its arm — to see both, use a private window or set the
split to 100/0 on `/admin`.

Dev loop: `pnpm dev` (needs `uv`, `pnpm`, Docker). Checks: `pnpm typecheck`, `pnpm lint`,
`pnpm test` (needs `docker compose up -d db`) — 433 tests, all three run pre-commit.

## Product decisions on the result screen

- **Four tiles, four reasons to buy:** breaches in the last 12 months, accounts exposed, share of
  breaches that leaked passwords, largest breach by name.
- **Newest first** by default; also most accounts, name.
- **Search, one data-class chip, verified-only.** A year filter was cut — worst control on a
  phone, and the sort already answers it. Retired and fabricated breaches hidden.
- **Everything is a server query** over our own copy of the catalogue, synced daily. HIBP down
  does not take the funnel down; an empty table is a visible error, never fake data.
- **Sign-up** stores an Argon2id hash, not the SHA-1 from the leak check (ADR-0005).

## The experiment

**Hypothesis:** an urgent result screen raises activation (activate / scan completed) by at least
20% relative, from an 8% baseline. Secondary: CTA click rate. Guardrail: activation per click.

| Arm | Headline | Subheadline | Button |
|---|---|---|---|
| `calm` (control) | Known breaches | Here's the public record of data breaches. | Protect me |
| `urgent` | You're exposed! | 17.7B accounts have leaked. Yours could be among them. | Protect me now |

Assignment is server-side, stored on the visitor's first request (ADR-0003), so refreshes never
re-bucket. Every step is tagged with the stored assignment, never with what the browser claims,
and replayed events are ignored.

**Retuning it (product, no deploy):**

1. Copy the token you put in `.env`: `grep ADMIN_TOKEN .env`.
2. Open `/admin` and paste it into the **Admin token** field at the top of the page. It is kept
   in memory for that tab only — not saved, so paste it again after a refresh. Until it is
   filled, Save is disabled and the page says so.
3. Change the weights (must sum to 100), the copy or the enabled switch, and save. The page
   sends the token as an `X-Admin-Token` header on the write.

Live for the next visitor; visitors already assigned keep what they saw. A conflicting save is
refused, not merged. The hypothesis lives in code, so nobody can move the finish line after a
slow week.

## The read and the call

`/dashboard` shows the funnel per arm, the relative lift with its 95% CI and p-value, sample
progress, and one call: ship, keep control, or keep running. Two-proportion z-test, alpha 0.05,
sample size powered from the hypothesis at 0.8 (ADR-0006); the three rates are in the API
response behind it.

4,000 simulated visitors through the real API, activation set at 8% calm and 10% urgent:

```sh
cd backend && uv run python scripts/simulate_traffic.py --visitors 4000 --activation calm=0.08 urgent=0.10
```

| | Control | Variant |
|---|---|---|
| Scan completed | 1,940 | 1,886 |
| Activated after a scan | 143 | 184 |
| **Activation rate** | **7.4%** | **9.8%** |

z = 2.64, p = 0.008, relative lift +32% (95% CI +7% to +63%). Required per arm 4,921, reached
1,886. **Call: `KEEP_RUNNING`** — significant at this look, but short of the sample the
hypothesis was powered for. That is the peeking guard: a daily refresh is a sequential look, and
a null test crosses p < 0.05 at some look if the reader may stop there. Full response:
[`docs/simulation-read.json`](docs/simulation-read.json).

The simulator encodes the effect it is asked for, so this validates the pipeline and the
statistics, not the hypothesis. Only real traffic answers that.

## The admin gate

The flag write needs an `X-Admin-Token` header; the token is required in `.env` with no default,
pasted into `/admin` per session, never in the build or `localStorage`. Reads are open — short of
real auth on purpose: no accounts, no audit trail. `/dashboard` and its endpoint are open too,
deliberately: counts of anonymous visitors, no personal data, loopback only. A public deployment
would put both behind the same login as the write.

## Stack

- **Frontend:** Vite, React 19, TS strict, axios, SCSS modules over one token file. Responsive by
  CSS only. Vitest with a driver per screen.
- **Backend:** FastAPI + Pydantic at the boundary, SQLAlchemy 2 + Alembic on Postgres, structlog
  with a correlation id per request, scipy. HIBP behind ports with in-memory fakes. Ruff, mypy
  strict, pytest.
- **Docs:** [`plan.md`](docs/plan.md), [`changelog.md`](docs/changelog.md),
  [`adr/`](docs/adr/README.md), [`python-primer.md`](docs/python-primer.md).

## Time spent

About 9–10 hours.
