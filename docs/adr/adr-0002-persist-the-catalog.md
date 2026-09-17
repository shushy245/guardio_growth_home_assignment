# ADR-0002 — Persist the HIBP catalog rather than proxy it per request

Date: 2026-09-18 · Status: accepted · Story: S2

## Context

The funnel's result screen is the centrepiece of the exercise: a summary of the public breach
record, a sortable and filterable list under it, and a CTA whose copy is A/B tested. All of that
reads from HIBP's `/api/v3/breaches` — 1,036 records, about 1 MB of JSON, refreshed by HIBP a
handful of times a week.

Three shapes were available:

1. **Proxy per request.** Call HIBP on every list request and answer from the response.
2. **In-memory cache.** Call HIBP once per process, hold the list in a module variable.
3. **Persist to a table**, synced on startup behind a TTL.

Two house rules bear directly on the choice. *Sort and filter always happen server-side — never
fetch all records, never sort or filter in the browser.* And *never synthetic, mock or fallback
data in production paths: if a dependency is down, fail visibly.*

## Decision

**Persist to a `breach` table**, synced at startup and skipped while the stored catalog is
younger than 24 hours (`app/breaches/staleness.py`). The endpoints read only the database and
never call HIBP.

- The list contract (`page`, `limit`, `sort`, `order`, `q`, `dataClass`, `verifiedOnly`) is
  answered in SQL. Proxying would have meant holding all 1,036 records in the request and
  sorting them in Python — the same anti-pattern as sorting in the browser, one process further
  back, and it would have made the client-side fallback tempting.
- The upsert is keyed on HIBP's stable `name` and derives its update set from the table, so a
  re-sync is free and a column added later cannot silently stop advancing `fetched_at`.
- Rows absent from a later sync are left in place. HIBP does not delete breaches, and a
  truncate-then-insert would empty the catalog for the length of its own transaction.
- An unreachable HIBP does **not** fail a request: a day-old public record is still the public
  record. `BreachCatalogError` is caught at startup, logged, and the app serves what it holds.
- An **empty** catalog is a 503 on both endpoints, never an empty 200. This is the fail-visible
  rule at its sharpest: an empty list would state that no breaches exist, when the truth is that
  we are not holding the record. A filter that matches nothing stays a 200 — a different fact
  deserves a different status code.

The in-memory cache was rejected for the same reason as the proxy — it cannot answer a sorted,
filtered, paginated query without doing the work in Python — and additionally dies with the
process, so every deploy would re-fetch.

## Consequences

**Easier.** Sort, filter, pagination and the summary are one query each. The funnel stays up
while HIBP is slow or down. The result screen renders from a local database, so its latency is
independent of a third party. Simulated traffic (S7) can hammer the API without hammering HIBP.

**Harder.** There is now a schema and a migration to keep in step with HIBP's payload, and a
sync path with its own failure modes to test. The catalog can be up to 24 hours stale — accepted
explicitly: nothing on the result screen changes meaning inside a day.

**Watch.** The summary loads every servable row and computes in Python rather than aggregating in
SQL. That is a deliberate trade at 1,036 rows — the `unnest`-and-group form of the data-class
ranking is materially harder to read and to test — and is recorded in
`repository.list_breach_facts` as the thing to revisit if the catalog grows an order of magnitude.
