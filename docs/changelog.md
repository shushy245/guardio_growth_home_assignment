# Changelog

The product diary: one entry per story, newest first, in the words of someone who never saw the
code. Commit-level detail lives in `git log`; the plan holds what is still ahead.

## S5 — funnel-ui (closed 2026-09-19)

- **Pain** — The funnel had a design and a data layer and no screens between them: the landing
  route was a placeholder heading, nothing scanned, and the result screen the whole exercise is
  judged on did not exist — so neither variant of the A/B test had ever been rendered.
- **Fix** — The three funnel screens are built to the D1 design from its tokens and component
  inventory: a landing page with one promise and one button, a two-second scan moment that waits
  for the record, and the result screen — four summary tiles, a search, data-class chips, a
  verified toggle, a three-way sort, a results line, expandable breach rows with the Passwords
  badge singled out, and one "Protect me" button that is a fixed bar on a phone and sits beside the
  headline on a laptop *(instead of the design's two buttons switched by JavaScript at a width
  breakpoint, rejected because a width branch in code would let every test silently cover one
  viewport and miss the other two)*. The variant changes the words and one colour class on the
  root; every ordering and narrowing is a server query, never a browser sort.
- **Trade-off** — A visitor the experiment cannot place — the flag stopped, or the visitor service
  down — sees the calm control framing from a constant kept in the frontend, which duplicates the
  seeded copy on purpose (ADR-0004): the funnel must not go dark because the flag service did. The
  landing lead names no breach count, because the page has none to name yet. The scan and
  result data ride one shared load, so a direct visit to /result loads it itself with skeletons.
- **Result** — 31 cases (F0–F30, 9 of them from the story-start pre-mortem and mid-story
  additions), each named by a test; 56 frontend tests added (95→151), 12 of the green-on-arrival
  cases pinned by a mutation that fails only them; 21 commits, every one red-first or a pure
  refactor. Three independent visual passes, urgent then calm then a confirmation: the urgent run measured every screen
  at three widths with accessibility 100 on each and found one tap-target defect and three render
  defects, all fixed the same day; the calm run confirmed the fixes and measured the one
  thing the tests cannot — the same button computes the calm colour under one class and the
  urgent colour under the other, so the A/B test's two looks are now proved on screen, not only
  in a stylesheet. Record: `docs/reviews/s5-visual-review.md`.

## D1 — design handoff (closed 2026-09-19)

- **Pain** — The funnel screens had no design at all, so the screen the whole exercise is judged
  on was about to be invented while it was being built, and the admin page still carried three
  defects a previous accessibility check had already measured.
- **Fix** — Shalev designed the screens in Claude Design and we translated the output into one
  token scale the whole app reads, plus a named inventory of every component still to be built
  *(instead of styling each screen as it is built, rejected because the three measured defects
  would then have to be fixed once per page)*.
- **Trade-off** — The design's colours were converted into a narrower colour space so the review
  tooling can measure them, which costs a little richness on a wide-gamut laptop; keeping the
  originals would have meant no measurable contrast numbers at all. And the borders inherited from
  the design fail the non-text contrast standard, which we recorded rather than quietly corrected.
- **Result** — 69 tokens and 24 named components (counted), 8 deviations recorded rather than
  silent; all three carried defects closed and confirmed by an independent pass — contrast passes
  with zero items, nothing renders under 16px, no line exceeds 75 characters, and both screens
  score 100 on accessibility.

### The review round that closed it

- **Pain** — Two independent reviews found the same defect five times over: the documents
  described the system that had been *designed*, not the one that had been *built*. The worst was
  the mechanism that lets the result screen switch between its calm and urgent looks — it was
  written down, named in the inventory, and connected to nothing, so the A/B test's urgent variant
  would have rendered in the calm colours and the only fix left would have been to edit the shared
  button everything else uses.
- **Fix** — The switch is now wired, with the calm colours as the fallback so nothing on screen
  today changed *(instead of deleting the unused mechanism and leaving it to S5, rejected because
  the inventory S5 reads as its specification already promises it)*; three claims no code backed
  were corrected in place, each pointing at the item that carries the code half.
- **Trade-off** — Six findings were recorded rather than fixed, including two real ones: a failed
  flag load still looks exactly like a page that is loading, and every border on the site fails the
  non-text contrast standard. Fixing them inside a story that ships no logic would have meant
  changing behaviour with no test to hold it.
- **Result** — 11 findings triaged: 5 fixed, 3 filed as defects, 5 as batched cleanups, 1
  dismissed with the condition that voids the dismissal written down. Three visual passes across
  the story, the last confirming the rewired button still computes the colour it computed before.

## S4 — funnel-events (closed 2026-09-18)

- **Pain** — The funnel could not say what a visitor did: no step was recorded anywhere, so the
  experiment had numbers on paper and none in a table — and the first version of the recorder
  would have let anyone who knew a visitor's id file a sign-up for them.
- **Fix** — Every step a page reports is written once, tagged with the variant the visitor was
  in, under the identity the server's own cookie names *(instead of a visitor id the browser
  sends, which the review showed lets a stranger file steps for anyone)*.
- **Trade-off** — Nothing in the request says who sent it, so the traffic simulator must carry
  a cookie per simulated visitor rather than post ids, and a browser that refuses cookies records
  nothing.
- **Result** — 17 backend and 13 frontend cases added (153→170, 82→95 in the test runs), every
  planned and pre-mortem case named by a test and 11 of them proved by a mutation that fails only
  them (session record); on the rebuilt stack, one row per step, a replay ignored, and five kinds
  of bad request refused with the reason in the body.

### The review round that closed it

- **Pain** — What shipped first trusted the browser's word about who it was; a visitor id in the
  request body was enough to file any step for anyone. It also minted its event ids with a browser
  function that does not exist on plain http off localhost, where the throw would have happened
  mid-render and taken the page down.
- **Fix** — Eleven findings from an independent review worked in one pass: the cookie became the
  identity and the body field was removed *(instead of keeping the field and checking it against
  the cookie when present, which would still have trusted a cookieless caller)*; the id seam got a
  fallback; two guarantees that had no test behind them got one, each proved by a mutation.
- **Trade-off** — The two-assignment path stays a deliberate loud failure rather than a guess,
  so enabling a second experiment before the event row can tag both is a visible outage of the
  recorder, not a silent misfiling.
- **Result** — 11 of 11 findings closed the same day: 8 fixed red-first, 3 recorded with the
  precondition that would reopen them written where it will be seen; the visual pass measured the
  landing route at three widths and found nothing to act on, and said so rather than calling it
  clean.

## S3 — feature-flags (closed 2026-09-18)

- **Pain** — The A/B test on the result screen existed only on paper. There was no way to say
  which visitor should see which framing, no way for a product person to change the split or the
  wording without a developer and a deploy, and nothing that would let the funnel numbers be
  broken down by variant later.
- **Fix** — A visitor now gets an identity on their first visit and is assigned a variant once,
  on the server, which is written down and never recalculated *(instead of the browser deciding
  for itself, or the server re-deciding on every request)*. A small admin console at `/admin`
  lets product retune the traffic split, reword the headline, subheadline and button, or stop the
  test — live, with no redeploy.
- **Trade-off** — A change to the weights moves **new visitors only**; everyone already in the
  test keeps what they were shown, which is what keeps the eventual result honest but means a
  retune is not instant across the whole audience. The console is protected by a single pasted
  token rather than real accounts, and reads are open — a deliberate stopping point, recorded in
  the README, not an oversight.
- **Result** — Verified on the running stack through the proxy: a visitor is created, assigned,
  and returns the same variant when asked again; editing the button text with a valid token
  succeeds and the change is live immediately; saving without a token is refused; and saving
  against a version someone else has already changed is refused with an explanation instead of
  quietly overwriting their work.

### The review round that closed it

- **Pain** — What shipped first had a save that discarded everything typed while it was saving and
  then displayed "Saved." over the reverted values; two tabs opened together turned one person into
  two people under two different variants of the running experiment; and the stack published an
  admin token committed to this repository on every network interface, reproduced from another
  machine on the same network.
- **Fix** — Worked the review's 23 findings as an ordered six-phase list — 21 fixed, 2 carried to
  the design stage — beginning by pulling the flag editor out of the page into its own unit *(instead
  of patching the five bugs where they sat, which is what had left them with no test able to reach
  them)*.
- **Trade-off** — The stack now listens on this machine only and refuses to start without an admin
  token you generate yourself, so a first run takes one extra step and checking the site from a
  phone on the same network needs a deliberate change; both were the price of not shipping a
  credential that everyone who clones the repository holds.
- **Result** — 21 of 23 closed over 25 commits; the suites went from 146 + 59 to 153 + 82 tests,
  two of them proved by deleting the code they cover and watching them fail; four independent
  visual passes measured the page at 390, 768 and 1280 rather than judging it by eye, and every
  change to the API, the cookie, the proxy and the compose file was watched working on the running
  stack before it was called done.

## S2b — catalog-refresh (closed 2026-09-18)

- **Pain** — "Refreshed once a day" was only true across restarts: the copy of the public record
  was re-checked at boot and never again, so a backend that stayed up for a week quietly served a
  week-old catalog, and nothing on the screen could say how old it was.
- **Fix** — Every breach request now answers from the stored copy at once and, if that copy is
  more than a day old, refreshes it in the background right after replying *(instead of a
  scheduler, which would be the shape at scale, but whose only wiring is the one place our tests
  cannot reach)*. One refresh at a time per process, and a source that is down is tried again
  five minutes later, not on every visit. The summary now reports when the copy was last synced.
- **Trade-off** — The copy is refreshed only while there is traffic (a cold start still fills
  it at boot), and the refresh holds a database connection for the length of the HIBP call.
  Both are the accepted cost of one worker in compose; the ADR names the point at which a
  separate periodic job takes over.
- **Result** — Watched live against HIBP: a request over a 25-hour-old copy was answered in
  16 ms from the old rows, the refresh ran after it under the same correlation id, pulled all
  1,036 records in about a second, and the next summary reported the new sync time. A backend
  whose boot found HIBP down now heals itself on the first visit instead of answering 503 until
  someone restarts it.

## S2 — breach-catalog (closed 2026-09-18)

- **Pain** — The funnel had nothing to show a visitor: the breach data lived at HIBP, a third
  party that can be slow or unreachable, and searching or sorting it would have meant pulling all
  1,036 records into the browser and hoping the phone coped.
- **Fix** — We keep our own copy of the public breach record, refreshed once a day, and answer
  every search, sort and page from it in a single query *(instead of calling HIBP on each request
  and sorting the answer in memory)*.
- **Trade-off** — The copy can be up to a day old and there is now a schema to keep in step with
  HIBP's payload; calling through on every request would have stayed current to the minute but
  made the result screen exactly as fast and as available as someone else's API.
- **Result** — The screen's numbers are real and live: 1,031 breaches, 17.7 billion exposed
  accounts, and 65% of those breaches leaked passwords — and when HIBP is down the funnel keeps
  serving, while an empty catalog returns a visible error rather than a reassuring empty list.

## S1 — scaffold (closed 2026-09-17)

- **Pain** — A take-home is judged first on whether it runs, and this scaffold only looked
  finished: a clean clone could not start it (the compose file demanded a file that is deliberately
  never committed, and the database had no migration to apply), while the one test guarding request
  tracing turned out to assert nothing at all.
- **Fix** — Worked the review's fourteen findings one commit at a time: the stack now starts from a
  fresh clone with no setup step, request tracing is proven by two genuinely concurrent requests
  rather than a no-op assertion, and a malformed browser-origin setting now fails loudly at startup
  instead of silently blocking every request the browser makes.
- **Trade-off** — Two settings the later stories will need (the admin token and the HIBP user
  agent) were deleted rather than left sitting ready, so S3 and S6 each re-add one when its first
  real consumer arrives — the price of never shipping configuration that nothing reads.
- **Result** — `docker compose up -d --build` with no `.env` present serves the landing page and
  answers `/api/health` with 200 (verified live, not inferred); 45 tests green (28 backend, 17
  frontend) with type-checking and linting clean; 4 unused files deleted; the fix pass itself is
  +343 / −124 lines across 32 files (`git diff --stat`).
