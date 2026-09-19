# Breach Scan Funnel

A mobile-first breach-scan funnel on public HIBP data, one A/B test on the result screen driven
by a feature flag product can retune without a deploy, every funnel step stored per visitor, a
traffic simulator, and an in-app read of the test. Guardio growth take-home.

**Read first:** [`docs/writeup.md`](docs/writeup.md) — approach, where AI helped, where it was
wrong, what I'd do next.

## Run it

```sh
cp .env.example .env          # then set ADMIN_TOKEN — `openssl rand -hex 24`
docker compose up -d --build  # frontend :5173, backend :8000, Postgres :5433
```

Open <http://localhost:5173>. Migrations, the seeded flag and the HIBP catalogue load on start.
Ports bind to `127.0.0.1` only.

| Page | What |
|---|---|
| `/` → `/scan` → `/result` → `/signup` → `/protected` | The funnel |
| `/admin` | The feature flag: split, copy, on/off |
| `/dashboard` | The read and the call |

Dev loop: `pnpm dev` (needs `uv` and `pnpm`) runs the same stack with hot reload.
Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test` (needs `docker compose up -d db`).
The pre-commit hook runs all three.

## Product decisions on the result screen

- **Four tiles, four reasons to buy protection:** breaches in the last 12 months, accounts
  exposed, share of breaches that leaked passwords, largest breach by name.
- **Newest first** by default; also most accounts, name.
- **Search, one data-class chip, verified-only.** A year filter was cut: worst control on a
  phone, and the sort already answers it. Retired and fabricated breaches hidden.
- **Everything is a server query** over our own copy of the catalogue, synced daily. HIBP down
  does not take the funnel down. HIBP down with an empty table is a visible error, never fake data.
- **Sign-up** stores an Argon2id hash, not the SHA-1 from the leak check (ADR-0005).

## The experiment

**Hypothesis:** an urgent result screen raises activation (activate / scan completed) by at
least 20% relative, from an 8% baseline. Secondary: CTA click rate. Guardrail: activation per click.

| Arm | Headline | Subheadline | Button |
|---|---|---|---|
| `calm` (control) | Known breaches | Here's the public record of data breaches. | Protect me |
| `urgent` | You're exposed! | 17.7B accounts have leaked. Yours could be among them. | Protect me now |

Assignment is server-side and stored on the visitor's first request (ADR-0003), so refreshes
never re-bucket. Every step is tagged with the stored assignment, never with what the browser
claims. Replayed events are ignored.

**Retuning it (product, no deploy):** open `/admin`, paste the `ADMIN_TOKEN` from `.env`, change
the weights (sum to 100), the copy, or the enabled switch, save. Live for the next visitor;
visitors already assigned keep what they saw. A conflicting save is refused, not merged. The
hypothesis itself lives in code, so nobody can move the finish line after a slow week.

## The read and the call

`/dashboard` shows the funnel per arm, the three rates, the lift with 95% CI, sample progress,
and one call: ship, keep control, or keep running. Two-proportion z-test, alpha 0.05, sample
size from the hypothesis at power 0.8 (ADR-0006). **Significance alone does not earn a call:**
ship needs a significant test *and* the powered sample. That is the peeking guard.

4,000 simulated visitors through the real API, activation set at 8% calm and 10% urgent:

```sh
cd backend && uv run python scripts/simulate_traffic.py --visitors 4000 --activation calm=0.08 urgent=0.10
```

| | Control | Variant |
|---|---|---|
| Scan completed | 1,940 | 1,885 |
| Activated | 144 | 185 |
| **Activation rate** | **7.4%** | **9.8%** |

z = 2.64, p = 0.008, relative lift +32% (95% CI +7% to +63%). Required per arm: 4,921. Reached:
1,885. **Call: `KEEP_RUNNING`.** Significant at this look, and still not shipped, because the
sample is short of what the hypothesis was powered for. Full response:
[`docs/simulation-read.json`](docs/simulation-read.json).

The simulator encodes the effect it is asked for. This validates the pipeline and the
statistics, not the hypothesis. Only real traffic answers that.

## Stack

- **Frontend:** Vite, React 19, TS strict, axios, SCSS modules over one token file. Responsive
  by CSS only. Vitest with a driver per component.
- **Backend:** FastAPI + Pydantic at the boundary, SQLAlchemy 2 + Alembic on Postgres, structlog
  with a correlation id per request, scipy. HIBP behind ports with in-memory fakes. Ruff, mypy
  strict, pytest.
- **Docs:** [`plan.md`](docs/plan.md), [`changelog.md`](docs/changelog.md),
  [`adr/`](docs/adr/README.md), [`python-primer.md`](docs/python-primer.md).

## The admin gate

The flag write needs an `X-Admin-Token` header. The token is required in `.env` with no default,
pasted into `/admin` per session, never in the build or `localStorage`. Reads are open. This is
short of real auth on purpose: no accounts, no audit trail. It keeps the write from whoever finds
the page, and no more.

## Time spent

About 9-10 hours.
