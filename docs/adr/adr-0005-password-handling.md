# ADR-0005 — Passwords: Argon2id for the credential, SHA-1 only as a lookup key, through a proxy

Date: 2026-09-19 · Status: accepted · Story: S6

## Context

The mock sign-up takes a password and does two things with it: warns the visitor if it appears
in a known leak, and stores an account. Both touch the same string, and both are the kind of
place a security company's take-home is read most closely.

The leak check is Have I Been Pwned's Pwned Passwords API, whose protocol is k-anonymity: the
client hashes the password with SHA-1, sends the first five hex characters, and receives every
suffix in that range with its count. The full hash never leaves the client. That protocol is
fixed by the API and is not ours to choose; what was ours was where the hash is computed, whether
the call goes to HIBP directly, and what is stored.

## Decision

**The browser hashes; the backend proxies; the hash is never stored.** `sha1Hex` runs in the
browser with Web Crypto and only the five-character prefix is sent, to our own
`GET /api/pwned-passwords/range/{prefix}`, which forwards it to HIBP with `Add-Padding: true` and
returns the text untouched. On the leak-check path the backend never sees the password or its
hash — only five characters of the hash — and the visitor's browser never talks to a third-party
origin. (The sign-up itself sends the password to the backend once, to be hashed; see below.) A proxy failure is a `503` the field renders as
"couldn't check" — a fail-visible seam, never a silent clean bill. Padding makes every answer
the same order of size, so the length of the response tells a listener nothing about how common
the password is.

**The stored credential is Argon2id**, via `argon2-cffi` with the library's recommended
parameters, one hasher per process built in the composition root. It is the OWASP Password
Storage Cheat Sheet's first recommendation; bcrypt is its fallback. The unsalted SHA-1 the leak
check computes is a lookup key for a public database, not a credential, and reusing it as one
would store every account behind a hash that is fast to compute, unsalted, and already indexed
by the very service we query.

**`passwordWasPwned` is persisted as the browser sent it**, keyed to the exact password submitted.
The read the field exists for is "how many chose a leaked password anyway", so it has to be what
the visitor saw at that moment. The frontend derives it from a check result that carries the
password it checked (`wasPwned`), so a warning for a password the visitor then edited is never
carried onto the one actually sent.

The alternatives weighed:

- **Call HIBP from the browser directly.** Rejected: a failed check is invisible to us, and every
  visitor's browser makes a cross-origin call to a third party from a security product's sign-up.
  The proxy costs one route and gives a logged, correlated failure.
- **Check on the backend instead.** Rejected: the password would then travel to our server twice
  — once to check, once to store — and the whole point of k-anonymity is that only five characters
  do. The backend receives the password exactly once, to hash it.
- **bcrypt.** Weighed as OWASP's fallback; Argon2id is the first recommendation, memory-hard, and
  `argon2-cffi` is the maintained binding. Nothing about the exercise favours the older choice.
- **Reuse the SHA-1.** Rejected for the reasons above; the write-up says so in plain words.

## Consequences

**Easier.** HIBP is one adapter file behind a second port (`PwnedPasswordRangePort`), with an
in-memory fake for every test and a `MockTransport` for the adapter's own. The route validates
the prefix before the port is asked, so a malformed request never reaches the source. The
password is a `SecretStr` at the boundary, so it cannot land in a log line by accident, and the
create response and the log are tested to carry neither the password nor the hash.

**Harder.** Two HIBP hosts means two clients and two ports rather than one; the split is real
(different host, no key, text not JSON) and the cost is one more file in `adapters/hibp/`. Web
Crypto is only available in secure contexts, so on plain http off localhost the check cannot run
— the field shows "couldn't check" and the sign-up proceeds without the flag, which is the same
fail-open the S4 review chose for `randomUUID`. Argon2id hashing takes tens of milliseconds per
sign-up, which is the point and is invisible at this scale.

**Stated exposure (S6 review, BF59).** Argon2id's recommended parameters cost 64 MiB of memory per
hash, and `POST /api/signups` needs no cookie and has no rate limit. Forty concurrent sign-ups —
the default anyio thread pool — would hold ~2.5 GiB for tens of milliseconds and starve every
other route of a worker for that long. A public deployment bounds this at the edge (a rate limit
per address) or with a semaphore around the hash; this take-home records it rather than adding
either, because nothing here is exposed beyond loopback.
