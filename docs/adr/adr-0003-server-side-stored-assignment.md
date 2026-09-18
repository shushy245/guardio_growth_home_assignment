# ADR-0003 — Assign variants on the server and store the result

Date: 2026-09-18 · Status: accepted · Story: S3

## Context

One A/B test runs on the result screen: `result_screen_tone`, two variants, weights a product
person can retune from `/admin` without a redeploy. Every funnel event is tagged with the variant
the visitor saw, and S7 reads those events as a two-proportion z-test. The read is only as good
as the assignment underneath it: a visitor who is counted under `calm` at `scan_completed` and
under `urgent` at `activation` silently poisons both arms.

Three shapes were available:

1. **Client-side hash.** The browser hashes a locally-generated id against weights it fetched and
   picks its own variant.
2. **Server-side hash, recomputed per request.** The backend derives the variant from the visitor
   id and the live weights every time it is asked.
3. **Server-side hash, stored once.** The backend derives the variant when the visitor is created
   and writes it to `visitor_assignment`; every later read returns the stored row.

## Decision

**Option 3.** `POST /api/visitors` mints a `vis_` id, derives one variant per *enabled* flag, and
writes the visitor and its assignments in the request's single transaction. `GET
/api/visitors/{id}` returns what is stored and never recomputes.

The derivation is pure and lives in `app/feature_flags/assignment.py`: the bucket is
`sha256("{visitor_id}:{flag_key}") mod 100`, walked against the cumulative weights in variant
order. **`sha256`, not Python's `hash()`** — `hash()` is salted per process, so the same visitor
would land in a different bucket on every worker and after every restart. A pinned-bucket test
is what catches that substitution; every other test in the file passes with either.

Identity is a `visitor_id` cookie (`HttpOnly`, `SameSite=Lax`, `Secure` outside dev, one year)
**and** a `localStorage` mirror the page keeps. They answer different questions. The cookie is
the server's: `POST /api/visitors` reads it and, when it names a visitor this server still knows,
answers `200` with that visitor and their **stored** assignments instead of minting a second
identity — which is what makes the create idempotent per browser, and what stops two tabs opened
together from enrolling one person in the experiment twice under two different variants. The
mirror is the page's: the cookie is `HttpOnly` and invisible to script, so the mirror is how the
browser knows which visitor to *ask about* on the next load. A stored id the server no longer
knows — a reset database behind a browser that kept its state — starts a fresh visitor rather
than surfacing an error, on both paths.

*(Amended 2026-09-18, S3 review BF26. As first shipped the cookie was set and never read by any
code on either side: "belt and braces" described a belt that was not fastened, and the second tab
really did become a second visitor. The paragraph above is what the code now does.)*

## Consequences

**What gets easier.** The variant a visitor saw is a fact in a table, not a function of whatever
the weights happened to be at the moment of the query, so the funnel arithmetic stays sound
across a weight change. Nothing about the split reaches the browser, so the experiment cannot be
read off the bundle or re-rolled by a visitor who clears part of their state. Adding a second
flag is a row, not a deploy.

**What gets harder.** Changing weights moves **new visitors only** — the intended behaviour for a
running experiment, but it must be said out loud on `/admin`, and it is (the page carries the
sentence). A visitor is created on the first page load of any route, including `/admin`; those
rows carry an assignment and no events, which is noise in the `visitor` table but affects no
funnel count, since every rate in S7 is computed per step from `funnel_event`. Scoping the
provider to the funnel routes is the fix if it ever matters, and belongs with S5's routing.

**Rejected, and why.** Option 1 puts the split in the bundle and makes the assignment a claim the
client makes about itself — unverifiable, and re-rolled by anyone who clears storage. Option 2
holds no history: the day product moves the weights, every visitor already in the experiment is
silently re-bucketed and both arms are contaminated at exactly the moment someone is watching
the result. Recomputation also has no place to record *when* a visitor entered.

## The write behind it

`PATCH /api/feature-flags/{key}` is the only user-editable entity in the system and carries the
house optimistic lock: one statement, `UPDATE … WHERE key = :key AND updated_at = :token
RETURNING updated_at`. Zero rows means the row is gone or the token is stale, and one existence
read on that failure path alone tells a 404 from a 409.

The new token is stamped with **`clock_timestamp()`, not `now()`**: Postgres pins `now()` to the
start of the transaction, so two saves inside one transaction would mint the same token and the
second could not be told from a replay of the first. That is not a hypothetical — the savepoint
test harness runs every integration test inside one transaction, and the consecutive-saves test
fails under `now()`.

The token crosses the wire as the **exact string** the API sent, on both sides. A JavaScript
`Date` holds milliseconds while the column holds microseconds, so a token that round-tripped
through a `Date` would never match what is stored and every honest save would be a 409.

The write is gated on a shared secret in `X-Admin-Token`, compared with `hmac.compare_digest`.
This is deliberately short of authentication and the README says so: reads stay open, so an
unauthenticated `/admin` is a harmless page, and the operator pastes the token per session —
never into the Vite build, which would ship it to every visitor, and never into `localStorage`.
