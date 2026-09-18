# Breach Scan Funnel

A mobile-first breach-scan funnel over the public Have I Been Pwned catalogue, with one A/B test
on the result screen driven by a database-backed feature flag, stored funnel events, simulated
traffic and an in-app statistical read. Guardio growth take-home.

Full written documentation lands with S8; this file currently carries what someone needs before
touching the running stack.

## Running it

```sh
cp .env.example .env          # then set ADMIN_TOKEN — `openssl rand -hex 24`
docker compose up -d --build  # frontend on :5173, backend on :8000, Postgres on :5433
```

Every published port binds to `127.0.0.1`. The stack is a development stack and is reachable from
the machine it runs on and nowhere else; reaching it from a phone on the same network needs a
deliberate rebind in `docker-compose.yml`.

`pnpm test` runs both suites and needs the same `.env` plus the compose database
(`docker compose up -d db`), which the backend integration tests run against.

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

Architecture decisions live in `docs/adr/`; ADR-0003 covers the flag and the assignment behind it.
