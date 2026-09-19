# S5 — visual review (2026-09-19)

Three independent `visual-reviewer` runs against the rebuilt compose bundle, each told only the
changed paths, the URLs and procedural steps (a fresh browser context; report every button's
computed colours). The experiment's split was retuned to 100/0 between the runs so a first-time
visitor was assigned one variant, then the other; restored to 50/50 afterwards. Run 1 covered `/`,
`/scan` and `/result` under the **urgent** variant with pass A + B; run 2 covered `/result` under
the **calm** variant with pass A on the bundle carrying run 1's fixes, so it is also the
confirmation pass for those. Run 3 covered `/result` again (calm, pass A) on the bundle carrying
V5's second fix, and measured the edges it was about.

## Triage

| # | Finding (run 1, urgent) | Class | Outcome |
|---|---|---|---|
| V1 | Verified-only input measures **44×26** at every viewport (the label around it is 44 tall) | measured, tap target | **Fixed** (`187a528`): the input is the 44×44 hit area, the 26px track is drawn inside it with pseudo-elements |
| V2 | "Credential" breaks **mid-word** in the Largest-breach tile at 768 | observed | **Fixed**: `overflow-wrap: anywhere` → `break-word` (both tile value and row title), and the largest-breach *name* reads at `$text-300` — a name is not a number, and at 28px bold it needed six lines in a 768 tile |
| V3 | Tiles stretch to the tallest, ~140px empty at 1280, ~400px at 390 | observed | **Reduced by V2's fix**, not removed: run 2 sees the name on four lines at 390/768 and two at 1280, with blank area still beneath the number tiles. Equal-height rows are the design's; the residual is a long title's content, recorded rather than fought |
| V4 | Chip scroller clips the fourth chip at 390 with no affordance | observed | **Fixed**: a right-edge `mask-image` fade on the scroller, removed at md+ where the chips wrap |
| V5 | Header and body do not share a left/right edge at 1280 (h1 at x=64, tiles at x=144) | observed | **Fixed twice.** The first fix capped the header's row and run 2 measured the gap at 64px (h1 at x=80, tiles at x=144): the header capped an unpadded row while the body capped a padded border-box. The body is now the header's band-and-row shape (`c30ed64`); run 3 measures both edges |
| V6 | Line-length boxes >75ch: the synced line (95/134ch) and every row meta line (113ch) | measured, with the reviewer's caveat that the strings are shorter and do not wrap | **Fixed** for hygiene: both capped at `$prose-measure`, so the box the script measures is the measure |
| V7 | Console: the search `<input>` has no `id` or `name` | measured | **Fixed**: `name="q"` |
| V8 | Tab order diverges from visual order **at 390**: the CTA is first in the DOM and rendered at the bottom | observed (from the 1280 traversal + the 390 capture) | **Recorded, not fixed.** One node, two placements (deviation 2): whichever end of the DOM it sits at, one width tabs it out of visual order. First is the choice — the primary action is reached first from the top of the document — and it is the precondition of deviation 2, written there |
| V9 | `/scan` has no heading of any level | measured (pass B) | **Recorded**: a transient two-second state announced through `role="status"`; a heading would be read once and gone. Reopen if the moment ever holds longer |
| V10 | `/result` CLS **0.047** (Lighthouse scores it 0.99, lists it as failing) | measured | **Recorded**: under the 0.1 "good" line; the shift is the skeleton→rows swap and the count-up. Revisit if a later story adds shift above the fold |
| V12 | (run 3) at 390 the fixed CTA bar covers a row's chevron mid-scroll | observed | **Recorded, precondition written:** the page reserves `padding-bottom` equal to the bar's height (`$sticky-bar-height` in `Result.module.scss`), so every row scrolls clear of the bar at the end of the page; a row under the bar mid-scroll is what a fixed bar is. Nothing is unreachable |
| V13 | (runs 2 and 3) the subheadline measures 37–43 characters, under the 45 floor | measured | **Recorded, not a defect:** it is one sentence of product-owned copy from the flag, not running prose; the floor is for paragraphs |
| V11 | `/result` has no `h2`–`h6`: tiles, filters and the list are not headed sections | measured (pass B) | **Recorded** as an S6/S7 candidate: the design has no section headings; adding them is a deviation to decide, not a fix to slip in |

**Run 3 (calm) confirmed V5:** at 768 the `h1` and the first tile both start at x=32; at 1280
both start at x=80 and the CTA's right edge equals the last tile's (1200). Every measured check
passes at all three widths, console clean on both reads.

**Run 2 (calm) confirmed:** zero tap targets under 44×44 (the switch input is 44×44), no word broken inside any tile at 768 or 1280, no line-length box over 75 characters, the chip scroller's right-edge fade computed, console empty on both reads, `<main>` carrying `_toneCalm_…`. **The tone seam re-points by class alone, measured:** the CTA computes `rgb(0, 59, 62)` (`#003b3e`, calm accent-strong) under `toneCalm` and `rgb(104, 21, 0)` (`#681500`, urgent accent-strong) under `toneUrgent`, with Load more's text following the same pair — the second half of D1's finding 1, now closed. Run 2's script-level label read returned empty for the row toggles; run 1's pass B named them by `aria-label` "Show details" and its `button-name` audit passed, so this is the probe, not the control.

**Unmeasured and stated as such** (from run 1's own list): the calm variant (run 2 covers it);
every interactive and error state (row expanded, chip selected, search typed, sort changed, Load
more, empty-filter, error) — the deep pass is `visual-review-deep`, on request; `/result` below the
first viewport visually (full-page capture returned 0 bytes at 390×3; the script measured the whole
DOM); the real `prefers-reduced-motion` feature (the served CSS carries the four blocks; the tool
has no switch for it); `/scan` at 390/768 was measured on a held copy proved identical to the
unaided 1280 transient.

**Environment**: run 1 stopped an orphan Chrome holding the devtools profile (anyone with it open
lost it), throttled the network once and stubbed `/api/breach*` once to hold `/scan`, and reports
both restored and verified. Nothing was written to the repo by either run.

## Run 1 — verbatim report (urgent variant, `/`, `/scan`, `/result`, pass A + B)

**Environment changes made and restored (read first — all restores completed and verified):**
1. A leftover Chrome process (pid 15123) was holding `/Users/shalevshushy/.cache/chrome-devtools-mcp/chrome-profile` and every devtools call failed with "browser is already running". I stopped that process; the MCP server then launched its own Chrome on the same profile. Nothing to undo, but anyone who had that browser open lost it.
2. `Slow 3G` network throttling applied for one navigation attempt on `/scan` → **cleared** on the next `emulate`; no later tool output reports network emulation.
3. An in-page stub (via `initScript`) delaying `/api/breach*` requests, used to hold the transient `/scan` screen long enough to capture it → **removed**; verified `window.fetch` and `XMLHttpRequest.prototype.send` are `[native code]` again and `/scan` proceeds to `/result` on its own.
4. Procedural requirement 1: instead of clearing the shared profile, every measurement ran in a **fresh isolated browser context** (`vr-clean`) — empty cookie jar, empty storage, so the session was a first-time visitor by construction (`localStorage` was empty on arrival and the app minted `breach-scan.visitorId` itself on that first load). At the end `localStorage`/`sessionStorage` were cleared and verified empty; `document.cookie` read empty at every point in the run.

**Build is live, not stale.** Served stylesheet is `http://localhost:5173/assets/index-DNrzvzgX.css` — the hash you named. Hashed CSS-module classes from the changed files are in the DOM on each screen (`_wordmark_157rb_1`, `_hero_1rizh_18` on `/`; `_page_77myb_1`, `_spinner_77myb_34`, `_fill_77myb_58` on `/scan`; `_headline_bi2cc_44`, `_stickyBar_bi2cc_57`, `_tile_x1h8o_18`, `_chip_mua2k_5`, `_row_i7h78_1` on `/result`). No rebuild was needed.

---

### MEASURED

#### Source signals (one grep over all 43 changed files)
- **No `max-width` media query anywhere in the changed files.** Every `@media` that reflows is `min-width` over a token: `BreachSummary.module.scss:61`, `BreachFilters.module.scss:159`, `Result.module.scss:83` and `:120`, `Landing.module.scss:66` and `:99` — all `@media (min-width: tokens.$breakpoint-md)` / `$breakpoint-lg`.
- **No width branch in any component.** `matchMedia` occurs exactly once, in `frontend/src/ui/motion.ts:5`: `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. No `isMobile` prop/state, no `innerWidth` read, in any changed file.
- **No breakpoint literal outside a token.** The only numeric `min-width:` values are `min-width: 0` (`BreachRow.module.scss:33`, `BreachSummary.module.scss:22`). Hardcoded px widths are two, both on decorative/hidden elements: `BreachFilters.module.scss:70  width: 20px` (switch knob) and `:131  width: 1px` (visually-hidden input).
- **No `100vh`** in any changed file.
- **No content reordering between widths.** No `order:` in CSS (the `order:` grep hits are JS object keys in `BreachFilters.utils.ts:38-40,65`), no `row-reverse`, no `column-reverse`, no `grid-area`/`grid-row`/`grid-column`. `position: absolute` appears twice, both on the switch knob and the visually-hidden input (`BreachFilters.module.scss:67`, `:130`) — neither is a flow child that moves. Consequence: the DOM order at 390 is the order measured at 1280.
- **Reduced-motion blocks are present in served CSS:** `Scan.module.scss:77-80`, `BreachFilters.module.scss:85-89`, `BreachRow.module.scss:132-134`, `_fields.scss:118-119`. Declared animations: `Scan.module.scss:48  animation: spin 0.9s linear infinite`, `:72  animation: fill tokens.$scan-moment linear forwards`, `_fields.scss:116  skeleton-shimmer 1.4s ease-in-out infinite`. Transitions: `BreachFilters.module.scss:63,74`, `BreachRow.module.scss:125`.

#### Screen 1 — `http://localhost:5173/`
Measurement script run verbatim at all three viewports.

| check | 390 | 768 | 1280 |
|---|---|---|---|
| horizontal overflow (`scrollWidth` vs viewport) | 390 / 390 — pass | 768 / 768 — pass | 1280 / 1280 — pass |
| elements past the right edge | none | none | none |
| tap targets < 44×44 | none | none | none |
| body text < 16px | none | none | none |
| line length outside 45–75 chars | lead 43 chars @18px; two trust labels 32 and 22 chars @16px | two trust labels 32 and 22 chars @16px | two trust labels 32 and 22 chars @16px |

Nothing exceeds 75 characters at any width on this screen; the sub-45 entries are short UI labels and the lead paragraph at 43 characters at 390.

**Buttons (requirement 2) — one `<button>` on this screen, colours identical at all three widths:**
- "Scan known breaches" `[data-testid="LandingTestIds.Scan"]` — background `rgb(0, 59, 62)`, colour `rgb(252, 252, 252)`; 358×48 at 390, 213×48 at 768 and 1280.

**Pass B, screen 1 (probes at 1280):**
- `lighthouse_audit` (desktop, navigation): **Accessibility 100**, Best Practices 100, SEO 82, Agentic Browsing 67. **Zero failing accessibility audits.** The three failures are `meta-description`, `robots-txt` and `llms-txt` — SEO/agentic, not accessibility.
- Heading order: exactly one `h1`, "Find out if you've been breached". No second `h1`, no skipped level.
- Accessible names: N = 1 enabled control. `button "Scan known breaches"` — name from **text content**. No unnamed control, no placeholder-only input, no non-semantic clickable (`div[onclick]`/`span[onclick]`/`[role=button]` that is not a button: none).
- Keyboard traversal, **run at 1280**, N+1 = 2 `Tab` presses from the document start: press 1 → `button "Scan known breaches"`; press 2 → focus leaves the document (browser chrome). Every control reached once, no repeat before the wrap, no trap, no control focus never reaches. The grep found no CSS reordering between widths, so the order at 390 is this same order.
- Focus indicator: unfocused `outline-style: none`; focused `outline: rgb(0, 123, 171) solid 3px`, `outline-offset: 2px`. Changed on focus — a visible indicator is present. No `outline: none` left unreplaced.
- `document.getAnimations()`: 0 running animations.
- Console: empty on first read and empty again after `ignoreCache` reload.

#### Screen 2 — `http://localhost:5173/scan`
**This screen moves on by itself and it moved on before any tool call could land.** Two unaided attempts (navigate → evaluate; navigate → screenshot) both arrived at `/result`, and it also moved on under `Slow 3G`. `frontend/src/hooks/useScanMoment.ts:18-20` is a wall-clock `setTimeout`, so throttling cannot stretch it.

I therefore measured it two ways, and both are reported as such:
- **Natural transient, unaided, at 1280:** an `initScript` snapshot taken at t = 102, 269, 620, 1119 and 1720 ms ran the measurement script verbatim inside the live screen. All five snapshots show `location.pathname === '/scan'` with identical DOM.
- **Held state, at 390 and 768 (and the 1280 screenshot):** the `/api/breach*` request was delayed in-page so the screen stayed up. The held DOM is identical to the natural transient at 1280 — same classes (`_page_77myb_1`, `_scanning_77myb_13`, `_spinner_77myb_34`, `_track_77myb_49`, `_fill_77myb_58`), same testids (`ScanTestIds.Page`, `ScanTestIds.Scanning`), same text.

| check | 390 (held) | 768 (held) | 1280 (natural transient) |
|---|---|---|---|
| horizontal overflow | 390 / 390 — pass | 768 / 768 — pass | 1280 / 1280 — pass |
| elements past the right edge | none | none | none |
| tap targets < 44×44 | none (no controls) | none (no controls) | none (no controls) |
| body text < 16px | none | none | none |
| line length outside 45–75 | "Checking the public record of …" 43 chars @18px | same, 44 chars @18px | same, 44 chars @18px |

**Buttons (requirement 2): there are no `<button>` elements on this screen at any viewport** — the natural-transient snapshot returns `buttons: []`.

**Pass B, screen 2:**
- `lighthouse_audit` had to run in **snapshot** mode on the held screen (navigation mode reloads, and the reload would land on `/result`): **Accessibility 100**, Best Practices 100, SEO 60, Agentic 50. Zero failing accessibility audits; the three failures are again `meta-description`, `robots-txt`, `llms-txt`.
- Heading order: **zero headings of any level** on this screen (`h1`–`h6` empty, measured in the natural transient). There is no `h1`.
- Accessible names: N = 0. No `button`, `a`, `input`, `select` or `textarea` exists here, so there is nothing to name and nothing to traverse — no keyboard traversal and no focus-indicator check is possible on this screen.
- `document.getAnimations()` in the natural transient: two running — `_spin_77myb_34` on `SPAN._spinner_77myb_34` with **iterations `Infinity`**, and `_fill_77myb_58` on `SPAN._fill_77myb_58` with iterations `1`. The served CSS **does** carry `@media (prefers-reduced-motion: reduce) { … animation: none }` at `Scan.module.scss:77-80`, so the infinite spinner is switched off under the preference in the stylesheet.
- Console: empty on first read; after the `ignoreCache` reload the only message is the `/result` one below (the reload auto-advanced to `/result`).

#### Screen 3 — `http://localhost:5173/result`
Measurement script run verbatim at all three viewports. The visitor was assigned the **urgent** variant (`_toneUrgent_bi2cc_16` on the page root).

| check | 390 | 768 | 1280 |
|---|---|---|---|
| horizontal overflow | 390 / 390 — pass | 768 / 768 — pass | 1280 / 1280 — pass |
| elements past the right edge | **2 `.chip` buttons: right 477 and 602 vs a 390 limit** | none | none |
| tap targets < 44×44 | **1: the Verified-only input, 44×26** | **same, 44×26** | **same, 44×26** |
| body text < 16px | none | none | none |
| line length > 75 chars | none | **"Record synced 12 hours ago" box = 95 chars @16px** | **"Record synced…" = 134 chars; each of the 20 row meta lines ("magairports.com · 2026 · 8.8M accounts" etc.) = 113 chars, all @16px** |
| line length < 45 chars | 32 entries, all short labels/titles/badges; longest-relevant is the lead at 43 chars @18px | 13 entries, same character | 10 entries, same character |

On the two chips past the right edge at 390: the page itself does not overflow (`scrollWidth` 390 = limit). The chip row is a horizontal scroller — `overflow-x: auto`, `flex-wrap: nowrap`, `scrollWidth 586` vs `clientWidth 358`, row right edge 374. So those chips are inside a scroller, not bleeding out of the page.

On the >75-char entries: these are the element *boxes*, which is what the threshold measures — the strings themselves are shorter and do not wrap. Reported as measured, with that caveat stated.

**Buttons (requirement 2) — 30 `<button>` elements; colours are identical at all three viewports, only the CTA's width changes:**
| visible text | testid | background | colour |
|---|---|---|---|
| Protect me now | `ResultTestIds.Cta` | `rgb(104, 21, 0)` | `rgb(252, 252, 252)` |
| Email addresses | `BreachFiltersTestIds.Chip.Email addresses` | `rgb(255, 255, 255)` | `rgb(18, 28, 35)` |
| Passwords | `BreachFiltersTestIds.Chip.Passwords` | `rgb(255, 255, 255)` | `rgb(18, 28, 35)` |
| Names | `BreachFiltersTestIds.Chip.Names` | `rgb(255, 255, 255)` | `rgb(18, 28, 35)` |
| Usernames | `BreachFiltersTestIds.Chip.Usernames` | `rgb(255, 255, 255)` | `rgb(18, 28, 35)` |
| IP addresses | `BreachFiltersTestIds.Chip.IP addresses` | `rgb(255, 255, 255)` | `rgb(18, 28, 35)` |
| Newest (selected segment) | `BreachFiltersTestIds.Sort.Newest` | `rgb(255, 255, 255)` | `rgb(18, 28, 35)` |
| Most accounts | `BreachFiltersTestIds.Sort.MostAccounts` | `rgba(0, 0, 0, 0)` | `rgb(78, 87, 93)` |
| Name | `BreachFiltersTestIds.Sort.Name` | `rgba(0, 0, 0, 0)` | `rgb(78, 87, 93)` |
| (no text; aria-label "Show details") ×20 | `BreachRowTestIds.Toggle` | `rgba(0, 0, 0, 0)` | `rgb(78, 87, 93)` |
| Load more | `BreachListTestIds.LoadMore` | `rgb(255, 255, 255)` | `rgb(104, 21, 0)` |

CTA size: 358×48 at 390; 156×48 at 768 and 1280. Chips 80–142 × 44, sort segments 72–127 × 44, row toggles 44×44, Load more 124×48 — all at every viewport.

**Pass B, screen 3 (probes at 1280):**
- `lighthouse_audit` (desktop, navigation): **Accessibility 100**, Best Practices 100, SEO 82, Agentic Browsing 66. Named audits, all passing: `color-contrast` 1, `label` 1, `button-name` 1, `heading-order` 1, `landmark-one-main` 1, `list` 1, `target-size` 1, `aria-allowed-attr` 1; `image-alt` and `link-name` not applicable (no images, no links). Failures: `meta-description`, `robots-txt`, `llms-txt`, and **`cumulative-layout-shift` — measured CLS 0.047** (audit score 0.99, below the 0.1 "good" line but scored under 1, hence listed as failing).
- Landmarks present: `MAIN`, `HEADER`, `INPUT[role=switch]`, `SPAN[role=status]`.
- Heading order: exactly one `h1`, "You're exposed!". No second `h1`, no skipped level. **There is no `h2`–`h6` anywhere**, so the summary tiles, the filter bar and the 20-row list are not headed sections.
- Accessible names: N = **32** enabled controls, and **every one has a name**. 10 buttons named by **text content** (CTA, 5 chips, 3 sort segments, Load more); 20 row toggles named by **`aria-label` "Show details"**; the search field named by **`aria-label` "Search breaches"**; the Verified-only checkbox named by a **wrapping `<label>` "Verified only"**. **No control with no accessible name, and no input whose only name is its `placeholder`.** No non-semantic clickables.
- Keyboard traversal, **run at 1280**, N+1 = **33** `Tab` presses from the document start. All 32 controls reached, each exactly once, in this order: CTA → search → 5 chips → Verified-only → 3 sort segments → 20 row toggles (top to bottom, y = 816 → 3783) → Load more → **wrap back to the CTA on press 33**. **No trap, no control focus never reaches, no repeat before the wrap.** The grep found no CSS reordering, so this is also the order at 390.
- Focus indicator, checked on seven representative controls (CTA, search input, a chip, the Verified-only switch, a sort segment, a row toggle, Load more): **every one** goes from `outline-style: none` to `outline: rgb(0, 123, 171) solid 3px` with `outline-offset: 2px`. No `outline: none` left unreplaced anywhere checked.
- `document.getAnimations()` at rest: **0 running animations**.
- Console: the same single message on first read and again after `ignoreCache` reload — `[issue] A form field element should have an id or name attribute (count: 1)`. The search `<input type="search">` has neither an `id` nor a `name` attribute (it is named by `aria-label`, which is why the Lighthouse `label` audit passes).

#### DOM fact across all three screens
Every `data-testid` value renders as the literal enum path, not a semantic identifier: `LandingTestIds.Page`, `LandingTestIds.Scan`, `ScanTestIds.Page`, `ScanTestIds.Scanning`, `ResultTestIds.Cta`, `BreachFiltersTestIds.Chip.Email addresses`, `BreachRowTestIds.Toggle`, `BreachListTestIds.LoadMore`. Reported as what the DOM contains; I make no claim about whether that is intended.

---

### OBSERVED

**Screen 1 (`/`) — the layout reorganizes, it is not a narrower copy.** At 390: left-aligned, wordmark top-left, a full-width 358px CTA, and the three trust points stacked as a vertical list with the check mark to the left of each label. At 768 and 1280: everything centres, the CTA shrinks to a 213px inline button, and the trust points become a single 3-across row with the check stacked *above* each label. Three distinct arrangements of the same DOM. Text is crisp at all three widths, no clipping, no truncation, no font-loading flash observed in any capture, no broken images (there are none), no stacking problems. Considerable vertical whitespace below the content at every width — at 1280 the page's content ends around y≈500 in an 800px viewport.

**Screen 2 (`/scan`) — identical composition at all three widths**, and the source comment at `Scan.tsx:2-3` is borne out by the render: wordmark, spinner, one line of copy, a progress bar, all centred in a single column. The only difference across widths is that the copy wraps to two lines at 390 and sits on one line at 768/1280. Nothing clipped, nothing truncated. Note that in the **held** captures the progress bar reads *full* while the spinner still turns — the fill animation runs once over the scan-moment duration and had completed, whereas in the unaided run the screen leaves before that. In the unaided (unstubbed) 1280 arrival captures, the "Accounts exposed" tile on the destination read `17.5B` in one capture and `17.7B` in another, i.e. the count-up was caught mid-flight.

**Screen 3 (`/result`) — reorganizes properly, with three concrete render defects.**

Reflow (positive): at 390 the "Protect me now" CTA is a full-width bar **pinned to the bottom of the viewport**, the summary tiles are a 2×2 grid, the filter chips are a horizontal scroller, and the Verified-only switch sits above the sort segments. At 768 and 1280 the CTA moves **into the top header as an inline 156px button** (`position: static` at 1280 — measured), the tiles become a single 4-across row, the chips fit on one line without scrolling, and the switch and sort segments share one row at opposite ends. Three genuinely different arrangements.

1. **Mid-word break at 768.** The "Largest breach" tile renders "Synthient Credentia / l Stuffing Threat Data" — the word *Credential* is split across lines. At 390 and 1280 the same string breaks only at word boundaries.
2. **Tiles stretch to the tallest, leaving large empty areas.** All tiles in a row match the height of the "Largest breach" tile, which is the only multi-line one. At 1280 the "Breaches, last 12 months / 102", "Accounts exposed / 17.7B" and "Passwords leaked / 65%" tiles each render roughly 140px of empty white beneath their value. At 768 the same, proportionally taller. At 390 the effect is largest: "Passwords leaked / 65%" shares its row with "Largest breach" and renders roughly 400px of empty white below "65%".
3. **Chip row clips with no affordance at 390.** "Email addresses", "Passwords" and "Names" are fully visible; the fourth chip is cut by the container's right edge. There is no fade, gradient, arrow or scrollbar — the sliver of the partial chip is the only cue that more exists sideways.

Two further observations:
4. **Header and content do not share a left or right edge at 1280** (measured from the render): the `h1` starts at x = 64 and ends at x = 492, while the tiles and the search field run x = 144 → 1136; the CTA's right edge is 1216 against the tiles' 1136. An 80px difference on both sides.
5. **Tab order diverges from visual order at 390.** The traversal was measured at 1280 (where the CTA is top-right and first is correct), and the DOM is identical at 390 because nothing in the CSS reorders content. At 390 that same first-in-order CTA is rendered **pinned to the bottom of the screen**, so the first `Tab` from the top of the document jumps focus to the bottom bar before the search field and everything above it. That is a comparison of the measured traversal against the 390 capture, which is why it sits here rather than under MEASURED.

Text renders crisply at all three widths on this screen; the row meta lines, badges and titles are not truncated or clipped; no font-loading flash, no broken images, no z-index/stacking problem observed (the 390 sticky bar correctly overlays the list).

---

### UNCERTAIN

- **`/scan` was never captured unaided.** The 390 and 768 measurements and all three of its screenshots come from the state held open by my request stub. I verified the held DOM is identical to the natural transient at 1280 (same classes, testids and text), and the 1280 numbers *are* from the unaided transient — but I cannot say the 390/768 numbers were taken from an unaided render, only from an identical one.
- **`prefers-reduced-motion` was established from the served CSS plus `document.getAnimations()`, not from the real media feature.** The `emulate` tool has `colorScheme` but no reduced-motion parameter. I know what the stylesheet says (`@media (prefers-reduced-motion: reduce)` blocks exist at the four sites listed, covering the infinite spinner) and what is running with the preference *off*. I did not observe the browser under the preference on.
- **`/result` screenshots are viewport-only, not full-page.** `fullPage: true` returned a 0-byte image twice at 390×3 on this ~5600px-tall page, so I switched that screen to viewport-only at all three widths for comparability. Everything below the first viewport at each width is **measured** by the script (which walks the whole DOM) but was **not visually inspected**. The mid-word break, the tile stretching and the chip clipping are all above the fold; a defect further down the 20-row list would not have been seen.
- **Only the urgent variant of `/result` was rendered.** The page root carried `_toneUrgent_bi2cc_16`. The calm variant was never on screen and is entirely unmeasured.
- **Only the default state of each screen was exercised.** No row expanded, no chip selected, no search typed, no sort changed, no Load more clicked, no hover state, no empty/no-results state, no error state (`ErrorState.tsx` is in the changed files and never rendered). Pass A/B as scoped covers the arrival state only.
- **httpOnly cookies could not be enumerated** from the page; `document.cookie` read empty throughout. The first-time-visitor guarantee rests on the isolated browser context having started with an empty jar, not on my having read and emptied a jar.
- The `>75 character` line-length entries on `/result` are element box widths; the strings inside them are shorter and do not wrap. Whether that constitutes a real measure problem is a judgement I am not making.
- One call at 768 on `/result` returned a line-length list I had truncated to 10 entries; I re-ran the script **verbatim** at that viewport and the table above reports the untruncated result (13 entries). Every other number in MEASURED came from an unmodified run of `~/.claude/docs/visual-review-script.js`.

**What I could not check, and why:** the calm `/result` variant (never assigned to this visitor); every interactive and error state (out of scope for pass A/B); `/result` below the fold visually (full-page capture failed at 390); the real reduced-motion media feature (no tool parameter); httpOnly cookie contents (not readable from the page). No viewport was skipped — 390, 768 and 1280 were measured on all three screens.

## Run 2 — verbatim report (calm variant, `/result`, pass A, confirmation of V1–V7)

VISUAL PASS A — screen: http://localhost:5173/result (one screen, three viewports)

Proof the change is live: served stylesheet is `/assets/index-DBAHvjU-.css` (the hash you named), and `<main>` carries `_toneCalm_lrmdz_9` from the changed `Result.module.scss`. No rebuild was needed and nothing in the stack was changed. All measurement ran in a fresh isolated browser context (`vr-fresh`, empty jar/storage); at the end `localStorage` (`breach-scan.visitorId`) and `sessionStorage` were cleared and the page/context was closed. An unrelated pre-existing page in context `vr-clean` was left untouched.

== MEASURED ==

Source signals (one grep over all 11 changed files, patterns: max-width media query, matchMedia/isMobile/innerWidth, `width:<n>px`, `min-width:<digit>`, `100vh`):
- No `@media ... max-width` anywhere in the changed files — no non-mobile-first query found.
- No `matchMedia`, no `isMobile` prop/state, no `innerWidth` read in `BreachSummary.tsx`, `SearchField.tsx`, `Result.tsx`, `Result.utils.ts`, `BreachSummary.utils.ts` — no width branch in the components.
- No `100vh` (and no `100dvh` needed anywhere the grep could see).
- Four px-literal hits, none a container width: `BreachRow.module.scss:33 min-width: 0`, `BreachSummary.module.scss:23 min-width: 0` (flex min-size fixes), `BreachFilters.module.scss:85 width: 20px` (an icon), `BreachFilters.module.scss:145 width: 1px` (visually-hidden clip). No breakpoint literal outside a token; the only `min-width: 390px` text is a comment in `tokens.scss:15`.

Measurement script (run verbatim from ~/.claude/docs/visual-review-script.js) at each viewport:
- Horizontal overflow: none at any viewport. `documentElement.scrollWidth` = 390 / 768 / 1280, equal to the visual viewport each time.
- Offenders past the viewport right edge: at 390 only, two chips — `BUTTON._chip` right=477 (w 109) and right=602 (w 118). Their parent `_row _chips` is `overflow-x: auto`, `scrollWidth` 586 vs `clientWidth` 358, so these are inside a deliberately scrollable strip, not page overflow. No offenders at 768 or 1280.
- Tap targets under 44x44: none at 390, none at 768, none at 1280 (the script found zero in each run). `BreachFiltersTestIds.VerifiedOnly` is exactly 44x44 at 390.
- Body text under 16px: none at any of the three viewports.
- Line length outside 45–75 characters: every flagged block is **short** (below 45), never above 75. At 390: 32 blocks, 14–43 chars — e.g. subheadline "Here's the public record of da…" 18px / 43 chars, tile label "Breaches, last 12 months" 16px / 19 chars, every breach meta line 16px / 27 chars. At 768: 13 blocks, 13–37 chars (subheadline 37, "Synthient Credential Stuffing…" 20px / 13). At 1280: 13 blocks, 19–37 chars. No block exceeds 75 characters at any viewport.

Buttons — computed `background-color` / `color` (30 button elements per viewport; values are identical at 390, 768 and 1280, so one list covers all three):
- "Protect me" (`ResultTestIds.Cta`) — bg `rgb(0, 59, 62)`, color `rgb(252, 252, 252)`
- "Email addresses" (`BreachFiltersTestIds.Chip.Email addresses`) — bg `rgb(255, 255, 255)`, color `rgb(18, 28, 35)`
- "Passwords" (`…Chip.Passwords`) — bg `rgb(255, 255, 255)`, color `rgb(18, 28, 35)`
- "Names" (`…Chip.Names`) — bg `rgb(255, 255, 255)`, color `rgb(18, 28, 35)`
- "Usernames" (`…Chip.Usernames`) — bg `rgb(255, 255, 255)`, color `rgb(18, 28, 35)`
- "IP addresses" (`…Chip.IP addresses`) — bg `rgb(255, 255, 255)`, color `rgb(18, 28, 35)`
- "Newest" (`BreachFiltersTestIds.Sort.Newest`) — bg `rgb(255, 255, 255)`, color `rgb(18, 28, 35)`
- "Most accounts" (`…Sort.MostAccounts`) — bg `rgba(0, 0, 0, 0)`, color `rgb(78, 87, 93)`
- "Name" (`…Sort.Name`) — bg `rgba(0, 0, 0, 0)`, color `rgb(78, 87, 93)`
- 20 × empty text (`BreachRowTestIds.Toggle`, one per row) — bg `rgba(0, 0, 0, 0)`, color `rgb(78, 87, 93)`; no text content and no `aria-label` was found on them by the script's label read (see UNCERTAIN)
- "Load more" (`BreachListTestIds.LoadMore`) — bg `rgb(255, 255, 255)`, color `rgb(0, 59, 62)`

`<main>` class list — identical at all three viewports: `_column_17g6y_8 _page_lrmdz_23 _toneCalm_lrmdz_9`.

At 768 and 1280:
- 768 — `h1` left x = 32; first tile (`BreachSummaryTestIds.Tile.RecentBreaches`) left x = 32. Same left edge.
- 1280 — `h1` left x = 80; first tile left x = 144. **64px apart**; the heading block and the tile grid do not share a left edge at 1280 (they do at 768).
- Broken words inside tiles: none. Every word in all four `BreachSummaryTestIds.Tile.*` elements resolves to a single line box at 768 and at 1280 (per-word Range rects, zero words with more than one distinct top). Tile computed `word-break: normal`, `overflow-wrap: normal`, `hyphens: manual`.
- Tile x/width at 768: 32/211/390/569, each 167 wide. At 1280: 144/395/646/897, each 239 wide, all 149 tall.

At 390:
- Chip container (`_row_17g6y_3 _chips_4t1wv_5`, the direct parent of the `BreachFiltersTestIds.Chip.*` buttons): `mask-image: linear-gradient(90deg, rgb(0, 0, 0) calc(100% - 40px), rgba(0, 0, 0, 0))`, same value for `-webkit-mask-image`; `overflow-x: auto`, scrollWidth 586 vs clientWidth 358. Its parent (`_column _bar`) has `mask-image: none`.
- `BreachFiltersTestIds.VerifiedOnly`: `INPUT[type=checkbox]`, bounding box x=16, y=602.78, w=44, h=44; `opacity: 1`, `position: relative`, `appearance: none`.

Console (read once, reload with `ignoreCache: true`, read again, both at 1280): **no messages of any type** on either read — no errors, warnings or logs.

== OBSERVED ==
- The layout reorganizes rather than shrinking. At 390 the four summary tiles are a 2×2 grid, the CTA "Protect me" is a full-width button in a bar pinned to the bottom of the viewport, the five filter chips are a horizontally scrolling strip showing three with a fade at the right edge, and "Verified only" sits above the sort segments. At 768 the tiles are one 4-across row, "Protect me" has moved into the top-right of the header (no bottom bar visible in the viewport capture), all five chips fit inline, and "Verified only" and the sort segments share a row at opposite ends. At 1280 the same 768 arrangement holds at a wider measure. The 390 and 1280 renders are not the same layout.
- At 1280 the header band (white, full-bleed, containing "Known breaches", the subheadline and "Protect me") runs from x≈80 to x≈1200, while everything below it (tiles, search field, chips, rows) runs from x=144 to x≈1136. The two blocks are visibly inset by different amounts; this is the 64px number above.
- At 390 and 768 the "Largest breach" tile's value wraps to four and four lines respectively ("Synthient / Credential / Stuffing Threat / Data"), and because the tiles in a row equalise height the neighbouring tiles render with a large empty area below their value — most visible at 390, where "Passwords leaked / 65%" occupies roughly the top third of its tile and the lower two thirds are blank. At 1280 the same value wraps to two lines and the blank area is smaller but still present in the first three tiles.
- The 20 row-toggle buttons render as a chevron glyph only, with no adjacent text label.
- No clipped or truncated text, no broken images, no element rendering as though disabled, no obvious font-swap flash or z-index stacking problem in any of the three captures.
- Text/background pairs seen in the captures: body copy `rgb(18,28,35)` and the muted `rgb(78,87,93)` on white/very light `#f4f7f7`-ish page background; the "Verified" dot and word render dark green on white.

== UNCERTAIN ==
- Screenshots were viewport-only (`fullPage` not used), the same mode at all three viewports. Everything below the fold — the remaining breach rows, the "Load more" button, and whether the sticky bottom bar reappears at 768/1280 after scrolling — was **not** visually inspected. The measurement script measured the whole document, so the numbers cover it; the render does not.
- The script's label read returned an empty string for all 20 `BreachRowTestIds.Toggle` buttons, which means no text content and no `aria-label`; I did not probe `aria-labelledby` or a visually-hidden child, so I cannot say the control has no accessible name. Pass B was not requested and no accessibility audit, keyboard traversal, heading-order or focus check was run.
- Contrast ratios were not computed (that is pass B's `lighthouse_audit`); the colour values above are raw computed values, not ratios.
- The page rendered as a first-time visitor with the default (calm) tone class. The urgent tone variant, the empty/zero-breach state, loading and error states, and any state behind interaction (a chip pressed, the toggle on, a row expanded, search typed) were not reached or measured.
- Cookies: `document.cookie` was empty from JS, so any server-set visitor cookie is HttpOnly and could not be cleared from the page. It existed only inside the throwaway isolated context, which was closed at the end of the run, so nothing persists.
- The 1280 h1/tile 64px offset is reported as a measurement and an observation only; whether the two blocks are intended to share an edge is not something I can determine.

## Run 3 — verbatim report (calm variant, `/result`, pass A, confirmation of V5's second fix)

Environment: fresh isolated browser context (`vr-fresh`), created empty for this run. No rebuild was needed. At the end: `localStorage` cleared (1 key → 0, verified), `sessionStorage` empty, isolated page closed so the context is discarded. Nothing written to the repo. **All three viewports ran; none skipped.**

**Proof the change is live:** served stylesheet is `http://localhost:5173/assets/index-DeWIonYs.css` — the expected hash. `<main>` carries the `Result.module.scss` hashed classes `_page_168k5_23 _toneCalm_168k5_9`.

---

### MEASURED

**Source signals** — one grep over `frontend/src/pages/Result.module.scss` and `Result.tsx`:

- **No `max-width` media query.** Both media queries are `min-width` over tokens: `Result.module.scss:94` `@media (min-width: tokens.$breakpoint-md)`, `Result.module.scss:134` `@media (min-width: tokens.$breakpoint-lg)`.
- **No width branch in the component.** Searched `matchMedia`, `isMobile`, `innerWidth` across both files — **no matches**.
- **No hardcoded px width on a container, no non-token breakpoint literal.** Searched `width:\s*[0-9]+px` and `min-width:\s*[0-9]` — **no matches**. The three `max-width` declarations are all tokens: `Result.module.scss:41` and `:90` `max-width: tokens.$content-max`, `:47` `max-width: tokens.$prose-measure`.
- **No `100vh`.** `Result.module.scss:24` is `min-height: 100dvh`.
- No `order:`, `row-reverse`, `column-reverse`, `grid-area`/`grid-row`/`grid-column`, or `position: absolute` in `Result.module.scss` — searched, none found.

**Horizontal overflow — passes at all three.** `documentElement.scrollWidth` vs `visualViewport.width`: 390/390, 768/768, 1280/1280. FAIL=false at each.

- At **390** the script listed two offenders: `BUTTON._chip_4t1wv_5` at right 477 (w 109) and right 602 (w 118). Their parent (`_row_17g6y_3 _chips_4t1wv_5`) computes `overflow-x: auto`, scrollWidth 586 / clientWidth 358, right edge 374 — a contained horizontal scroller, not page overflow. At 768 and 1280 the offender list is empty.

**Tap targets ≥ 44×44 — passes at all three.** `tapTargetsUnder44` empty at 390, 768 and 1280.

**Body text ≥ 16px — passes at all three.** `bodyTextUnder16` empty at 390, 768 and 1280. Smallest measured size anywhere is 16px.

**Line length 45–75 characters.** Nothing exceeds 75 at any viewport. Under 45:
- The only running prose on the screen, the subheadline "Here's the public record of data breaches." at 18px: **43 chars at 390**, **37 chars at 768**, **37 chars at 1280** — below the 45 floor at every viewport.
- Every other flagged entry is a single-phrase label rather than a paragraph: tile captions ("Breaches, last 12 months" 19 chars at 390 / 17 at 768 / 31 at 1280), the largest-breach title ("Synthient Credential Stuffing…" at 20px, 14/13/23 chars), row titles (19–26 chars), row meta lines ("magairports.com · 2026 · 8.8M accounts" etc., 27 chars at every viewport) and data-class badges ("Partial credit card data" 24, "Browser user agent details" 27).

**`<main>` class list — identical at all three viewports:** `_column_17g6y_8 _page_168k5_23 _toneCalm_168k5_9`

**Requested x-coordinates (CSS px, left / right):**

| element | 768 | 1280 |
|---|---|---|
| `h1` | 32 / 342.6 | 80 / 390.6 |
| first `BreachSummaryTestIds.Tile.*` (`.RecentBreaches`) | 32 / 199 | 80 / 351 |
| last `BreachSummaryTestIds.Tile.*` (`.LargestBreach`) | 569 / 736 | 929 / 1200 |
| `ResultTestIds.Cta` | 613 / 736 | 1077 / 1200 |

Derived from those numbers: the CTA's right edge equals the last tile's right edge at both widths (736 at 768, 1200 at 1280), and the `h1`'s left edge equals the first tile's left edge at both (32, 80). The `h1` right edge is its text box, not a container edge. 4 tiles at both widths, all on one row (`top` 171.1 at 768, 267.1 at 1280). The tiles wrapper measures 80→1200, width 1120, at 1280.

**Console — clean.** Read at 1280 after the three viewports: no messages. Reloaded with `ignoreCache: true`, read again with preserved messages: no messages. No errors or warnings on first load or on reload.

---

### OBSERVED

- **The layout reorganizes rather than shrinking.** Four changes between 390 and 1280: the `Protect me` CTA renders as a full-width bar pinned to the bottom of the viewport at 390 and inline at the top right of the header at 768/1280; the summary tiles are 2×2 at 390 and 1×4 at 768/1280; the filter chips are a horizontal scroller at 390 (3 of 5 visible, 2 off-screen) and all 5 inline at 768/1280; the sort segmented control sits below the "Verified only" toggle at 390 and to its right at 768/1280.
- **Tile heights equalize to the tallest tile in the row, leaving large empty areas.** At 390 the "Passwords leaked / 65%" tile renders with roughly 250px of blank space below its value, because "Synthient Credential Stuffing Threat Data" wraps to four lines in the tile beside it. At 768 the first three tiles each carry roughly 200px of blank space below their values for the same reason. At 1280 that title wraps to two lines and the blank space drops to roughly 30px.
- **At 390 the sticky CTA bar overlays page content.** In the capture a breach row's chevron toggle glyph renders partly behind the bar's top edge, cut off horizontally by it.
- No clipped or truncated text elsewhere, no broken images, no font-loading flash across the three captures, no control rendering as though disabled, no visible z-index stacking problem other than the sticky bar noted above.

---

### UNCERTAIN

- Screenshots are **viewport-only**, the same mode at all three widths. Content below the fold at each width was not visually inspected; the measurement script did run over the whole document at each width, so the numbers above cover it and the OBSERVED notes do not.
- The 390 sticky-bar overlap: I can see the chevron intersecting the bar in the capture but did not measure z-order or the bar height against the scroll container's bottom padding, so I cannot say whether any content is permanently unreachable behind it.
- `<main>` carries `_toneCalm_168k5_9` at every viewport — only the calm tone rendered. Any other tone state on this screen was not reached and is unmeasured.
- The visitor cookie set on first load was not readable from `document.cookie` (0 entries visible — likely HttpOnly), so I could not clear or verify it directly. It existed only inside the throwaway isolated context, which I closed.
- I did not determine whether the equalized tile heights and the resulting blank areas are a row-alignment consequence or explicit sizing; I report only the measured geometry and what the captures show.

**Not checked, and why:** pass B was not requested, so no Lighthouse audit, keyboard traversal, focus-indicator, heading-order, accessible-name or reduced-motion checks were run. Contrast was therefore not measured. Only `/result` was given, so no other screen was reviewed.
