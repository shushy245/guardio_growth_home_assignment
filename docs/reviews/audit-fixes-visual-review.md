# Visual review — story `audit-fixes` (2026-09-20)

Run by the independent `visual-reviewer` agent against the compose stack rebuilt with
`docker compose up -d --build`, at `http://localhost:5173`. It was given the 38 changed frontend
paths and the seven routes, and nothing about what any screen was meant to look like. Pass B (the
accessibility sweep) was requested and run.

**The report is folded in verbatim below.** The triage above it is this session's; the words
below the rule are the reviewer's.

## Triage

| # | Finding | Class | Outcome |
|---|---|---|---|
| V1 | The not-found page has no headings at all; its title is a `p role="alert"` at 18px | **defect, mine** | Fixed `1acbb90`: `ErrorState` takes an `ErrorStateKind`, a table picks `h1` or the announced paragraph, and the render-time boundary takes the page form too |
| V2 | `/result` at 390: the fixed CTA bar covers a line of content mid-scroll | not a defect | The bar is what a fixed bottom bar is, and `.page` reserves 72px for it against a measured 68px — the end of the list clears it. Recorded rather than changed |
| V3 | `/result`: "Load more" renders in the urgent maroon | by design | `button-secondary` reads `--tone-accent-strong`, so every secondary control on the result screen wears its arm's ink. That is the tone seam working; changing it would make one control opt out of the variant |
| V4 | `/admin`: the flag checkbox paints 24×24, under the 44 minimum | carried | The element that activates it is its wrapping label at 324×52, which is what a thumb hits. Recorded; the painted box is deviation-sized, not the target |
| V5 | `/admin` console: "Password field is not contained in a form" and 9 fields with no `id`/`name` | carried | Chrome DevTools hints, not failures: the controls are named through `aria-labelledby` and Lighthouse reports accessibility 100 on the page. Worth a pass when the admin page is next opened |
| V6 | `/dashboard`: the two series are told apart by colour alone | carried, recorded | Deviation 14 — each series is an arm and each arm is a tone; every bar carries its variant in the `<meter>`'s `aria-label` and the legend names both |
| V7 | `/scan` and `/result` heading gaps (`/scan` has none; `/result` has an `h1` and no `h2`) | carried | Pre-existing and already on the audit's structure list ("`Scan` has no heading and the Result body's three regions have none"). Not this story's surface |
| V8 | `/result`: 20 disclosure buttons share the accessible name "Show details" | carried | Pre-existing; each sits inside a card whose heading names the breach. Add the breach name to the button when the row expansion is next touched |
| V9 | 404: the error mark is an empty red square | as designed | `ErrorState`'s square mark, the shape that tells a failure from an empty filter state. Reported because it reads as a missing glyph; left as the design's |
| V10 | The not-found page's `h1` is 18px — the smallest `h1` in the app (re-measure) | decided | Kept. The page *is* the error card the rest of the app shows, and the card's type scale is what makes it recognisable as one; a title sized like the landing page's would make the same card read as a different component. D1 designed no not-found screen, so this is a choice, not a deviation |

**What the pass measured clean:** no page overflow in any of the 21 measurements (7 screens ×
390/768/1280); no body text under 16px anywhere; accessibility **100** and best practices **100**
on all six screens Lighthouse reached, with zero contrast, form-label, landmark or alt failures;
every focusable control has a visible focus indicator; no control anywhere is named by its
placeholder; keyboard traversal reaches every enabled control once, in document order, with no
trap — 32 of 32 on the result screen. The two changes this story made to what renders are in
that: the sign-up fields' accessible names and the 3.29:1 control border both measured clean.

**Gaps the reviewer states, carried as unmeasured:** `/scan` has no Lighthouse audit and was
measured under an injected `setTimeout` stub (it redirects on its own); reduced motion is read
from the served stylesheet, not observed under the real media feature; keyboard traversal ran at
1280 only, with the result screen's CTA measured directly at 390 (it is DOM index 0 while
painting at the bottom — tab order and visual order diverge there); only the `urgent` arm of the
result screen was seen; the authenticated `/admin` states, the loading/empty/error states of
`/result` and `/dashboard`, and the expanded breach card were not reached.

## Re-measure after the fix (same reviewer, told only that the image was rebuilt)

`/a-url-that-matches-nothing`, served bundle `index-BnXLjCav.js` against the previous run's
`index-BjIoEJhJ.js`:

- **one heading, `h1: That page is not here`**, no skipped level, `role="alert"` gone — V1 closed
  by measurement, not by assertion;
- no overflow at 390/768/1280 (`scrollWidth` equals the viewport at each); no body text under
  16px; no tap target under 44×44; the one control's focus outline goes from `3px none` to
  `3px solid rgb(0, 123, 171)`;
- **Lighthouse accessibility 100, best practices 100**, 37 passed / 3 failed — the same three
  dev-server artefacts (`meta-description`, `robots-txt`, `llms-txt`) the first pass reported on
  every route, because the SPA fallback serves `index.html` for any path;
- console silent on a cold reload.

The reviewer raised V10 above on this pass and re-stated V9 unchanged. It did not re-run the
keyboard traversal, the accessible-name sweep or `getAnimations()` for this route — the first
pass's results for them stand (one control, named from its text, no animations).

---

## The reviewer's report, verbatim

## Environment

Nothing to restore by hand. One deliberate change: to hold `/scan` (which redirects to `/result` on its own) I navigated with an `initScript` stubbing `window.setTimeout` to drop callbacks ≥250ms. It was removed by the next plain navigation and verified gone (`String(window.setTimeout).includes('[native code]') === true`, path back to `/result`). No rebuild, no container touched, no storage written.

**Change is live** — no stale build. `/a-url-that-matches-nothing` renders `[data-testid="NotFoundTestIds.Page"]` with the exact copy from `frontend/src/pages/NotFound.utils.ts`, and the served CSS carries the `password-check-spin` keyframe from `frontend/src/components/PasswordField.module.scss`. Served bundle: `/assets/index-BjIoEJhJ.js`.

---

# MEASURED

## Source signals (one grep over the 38 changed files)

**Searched and found none:**
- No `@media (max-width: …)` in any changed stylesheet — the changed styles are mobile-first.
- No `matchMedia`, no `isMobile`, no `innerWidth` in any changed `.tsx`/`.ts` — no width branch in the component tree.
- No `100vh`.
- No `order:`, `row-reverse`, `column-reverse`, `grid-area`, `grid-row` or `grid-column` in any changed stylesheet. The one `order:` hit is `frontend/src/providers/BreachCatalogProvider.utils.ts:163` — `order: (filters) => filters.order,`, a TypeScript object key, not CSS.

**Found:**
- `position: absolute` — `frontend/src/components/BreachFilters.module.scss:70`, `:82` (toggle track/thumb pseudo-elements), `:144` and `frontend/src/styles/_fields.scss:142` (both inside `width: 1px` visually-hidden blocks). None reorders flow content.
- Hardcoded px on containers — `frontend/src/pages/Admin.module.scss:63` `max-width: 720px;` and `frontend/src/pages/Signup.module.scss:84` `max-width: 400px;`. Other px literals are icon/control boxes: `FlagEditor.module.scss:37` `width: 24px;`, `BreachFilters.module.scss:85` `width: 20px;`, `PasswordField.module.scss:33` `width: 14px;`, `_fields.scss:154` `width: 16px;`.
- Infinite animations, each paired with a `prefers-reduced-motion: reduce` override in the same file: `PasswordField.module.scss:38` `animation: password-check-spin 0.8s linear infinite;` (override at `:41`); `_fields.scss:131` `skeleton-shimmer 1.4s … infinite` (override at `:133`); `_fields.scss:160` `button-spin 0.8s linear infinite` (override at `:163`); `BreachFilters.module.scss:77`/`:89` transitions (override at `:100`).

## Overflow, tap targets, body text — every screen, every viewport

`documentElement.scrollWidth > visualViewport.width` was **false on all 21 measurements** (7 screens × 390/768/1280). No body text below 16px anywhere. Tap targets under 44×44: **one**, on `/admin` only (below).

| screen | 390 | 768 | 1280 |
|---|---|---|---|
| `/` | clean | clean | clean |
| `/scan` | clean | clean | clean |
| `/result` | 2 off-viewport chips (see below) | clean | clean |
| `/signup` | clean | clean | clean |
| `/admin` | checkbox 24×24 | checkbox 24×24 | checkbox 24×24 |
| `/dashboard` | clean | clean | clean |
| 404 | clean | clean | clean |

**`/admin`, all three viewports** — `input[type=checkbox]` ("Running — assign new visitors to a variant") measures **24×24**, below the 44×44 minimum. Its wrapping `<label>` measures **324×52** with `cursor: pointer` and contains the input, so the element that activates the control is above the minimum; the 24px is the painted box (`FlagEditor.module.scss:37`).

**`/result` at 390** — two `_chip_` buttons have `getBoundingClientRect().right` of **477** and **602** against a 390px viewport, while page `scrollWidth` stays 390. They sit inside a horizontally scrolling chip rail, so no page overflow; two of the five filter chips start off-screen.

## Line length (45–75 char band)

Every out-of-band entry on every screen was a short single-line label (breach names, data-class chips, stat-card titles, status lines), not running prose. The prose blocks measured in band: `/` lead at 390 = 43 chars / 18px; `/dashboard` hypothesis at 390 = 43 chars / 16px; 404 description at 390 = 43 chars / 16px. The heuristic flags these at 43–44 rather than 45; no paragraph anywhere exceeded 75.

## Pass B — Lighthouse (desktop, navigation, 1280)

**Accessibility 100 and Best Practices 100 on every screen audited**: `/`, `/result`, `/signup`, `/admin`, `/dashboard`, 404. Zero contrast, form-label, landmark or image-alt failures reported on any of them.

Identical non-accessibility failures on all six (they are dev-server artefacts — the SPA fallback returns `index.html` for any path):
- SEO 82: `meta-description` ("Document does not have a meta description"); `robots-txt` ("robots.txt is not valid" — the audit is parsing `<!doctype html>` line by line).
- Agentic Browsing 67: `llms-txt` ("File is missing a required H1 header", "File does not appear to contain any links").

**`/scan` was not audited** — see UNCERTAIN.

## Pass B — heading order

| screen | headings |
|---|---|
| `/` | `h1: Find out if you've been breached` — one h1, no skip |
| `/result` | `h1: You're exposed!` — one h1; **zero h2–h6** despite "Breaches, last 12 months", "Showing 20 of 1,031" and 20 breach cards |
| `/signup` | `h1: Choose your plan` — one h1, no skip |
| `/admin` | `h1: Feature flags` → `h2: result_screen_tone` → `h3: calm`, `h3: urgent` — correct |
| `/dashboard` | `h1: Result screen tone test` → `h2: Hypothesis`, `h2: Funnel by variant`, `h2: Lift on activation` — correct |
| `/scan` | **no headings at all** |
| 404 | **no headings at all** — the title "That page is not here" is a `<p role="alert">` at 18px |

## Pass B — accessible names

No control anywhere had a missing accessible name, and **no input was named by its placeholder**. Sources:
- `/` — 1 button, from text.
- `/result` — 32 controls. Search input from `aria-label="Search breaches"`; "Verified only" from `label[for]`; chips/segments from text; **20 disclosure buttons all carry the identical accessible name "Show details"** — nothing in the name distinguishes which breach card each belongs to; "Load more" from text.
- `/signup` — 5 controls, all from `label[for]` (the two radios take the whole plan card's text).
- `/admin` — 11 controls. `aria-labelledby` resolves to disambiguated names: "calm Share of traffic (%)", "urgent Headline", etc. Save is `disabled`.
- `/dashboard`, `/scan` — no focusable controls. Dashboard's 12 `<meter>` elements each carry an `aria-label` ("calm, Landing: 2,414 visitors", …).

## Pass B — keyboard traversal (run at 1280; see UNCERTAIN for 390)

| screen | N enabled | presses | result |
|---|---|---|---|
| `/` | 1 | 2 | reaches the CTA, wraps. No trap, nothing unreachable. |
| `/result` | 32 | 33 | **all 32 reached, once each, in document order**, ending at "Load more", then out of the page. No trap, no repeat, no unreachable control. |
| `/signup` | 5 | 6 | 4 stops: radio group (lands on the checked `family` radio) → email → password → submit → wraps. Standard radio-group behaviour; Tab never lands on `basic` (arrow keys move within the group). |
| `/admin` | 10 (Save disabled) | 11 | token → checkbox → calm ×4 → urgent ×4, document order, disabled Save correctly skipped, then out. |
| `/dashboard` | 0 | 1 | focus leaves the page immediately — no focusable control exists. 0 elements with a click handler and no tabindex. |
| `/scan` | 0 | — | no focusable controls. |
| 404 | 1 | 2 | reaches the one button, wraps. |

## Pass B — focus indicators

Every control that focus reaches gains a visible indicator; `outline: 3px solid rgb(0, 123, 171)` where unfocused is `outline-style: none`. Checked per control family, focused vs unfocused computed style:
- `/result`: `_cta_`, search `_input_`, `_chip_`, `_switch_`, `_segment_`, `_toggle_`, `_loadMore_` — all 7 change.
- `/admin`: password, checkbox, number, text — all change.
- `/signup`: email, password, submit change on the element. The **radio does not** (`._radio_1f9sh_70:focus-visible { outline: none; }`), but it is replaced: `._card_1f9sh_36:has(:focus-visible) { outline: rgb(0, 123, 171) solid 3px; }` paints the ring on the wrapping card, confirmed changing from `3px none` to `3px solid rgb(0,123,171)`. Not a bare `outline: none`.

## Pass B — reduced motion (determined from served CSS + `getAnimations()`)

The served stylesheet contains **10 `@media (prefers-reduced-motion: reduce)` blocks**, covering `._spinner_77myb_34, ._fill_77myb_58` (the `/scan` spinner and progress fill), `._chevron_1482f_112`, five skeleton classes, `._switch_b42io_50::before/::after`, `._spinner_1163y_59` and `._spinner_127uc_134`. The `/scan` rule resolves to `animation: … none`.

`document.getAnimations()` at the time of measurement: `/scan` had `_spin_77myb_34` **running with `iterations: null` (infinite)** on `._spinner_77myb_34`, plus `_fill_77myb_58` finished after 1 iteration. Every other screen returned `[]`. The one infinite animation found running is covered by a reduced-motion override in the served CSS.

## Console (read, then hard reload with `ignoreCache`, then read again)

- `/`, `/scan`, `/result`, `/signup`, `/dashboard`, 404 — **no messages on either read**.
- `/admin` — **2 messages, reproduced on the cold reload**: `[verbose] [DOM] Password field is not contained in a form` and `[issue] A form field element should have an id or name attribute (count: 9)`.

---

# OBSERVED

**`/` (landing) — reorganizes.** At 390: left-aligned, full-bleed CTA, three trust points stacked as rows with a check pill left of each label. At 768/1280: centred, auto-width CTA, trust points in a three-across row with the pill above the label. Different layout, not a narrower copy.

**`/result` — reorganizes, with two things to flag.** 390: stat cards 2×2, filter chips become a horizontal scroll rail with the 4th chip visibly clipped at the right edge, and the "Protect me now" CTA leaves the hero and becomes a `position: fixed; bottom: 0` full-width bar. 768/1280: stat cards 4-across, all five chips fit, CTA inline at top-right.
- At 390 the fixed CTA bar **overlaps page content**: it occupies y≈776–844 while "Showing 20 of 1,031" sits at y=760, and the screenshot shows that line cut in half by the bar. The bar has `z-index: auto`.
- The "Load more" button renders with a maroon border and maroon label (`rgb(104, 21, 0)`) — the same danger family used for the urgent CTA — on a neutral pagination action.
- The "Passwords leaked / 65%" card at 390 is stretched to match the four-line "Largest breach" card beside it, leaving roughly half the card empty.

**`/scan` — no reflow path.** Identical single centred column at 390, 768 and 1280: wordmark, spinner, `role="status"` line, a ~240px progress bar. Only text wrapping changes. This is a transient loading screen with one column of content, so there is nothing to restack; stating it because a layout identical at 390 and 1280 is normally the finding.

**`/signup` — capped, not reorganized.** Identical single column at all three widths; from 768 up it is capped at ~400px and centred (`Signup.module.scss:84`). Plan cards stack at every width. The `family` plan (the $9.99 one) is pre-checked and tinted on load; `basic`'s radio renders as a thin grey ring.

**`/admin` — reorganizes.** 390: the `calm` and `urgent` variant cards stack. 768/1280: side by side within the 720px cap. Both variant cards render the same neutral grey — nothing in the card itself signals which tone it configures apart from its `calm`/`urgent` heading. The Subheadline inputs clip their values mid-word ("Here's the public record of data breach…", "17.7B accounts have leaked. Yours coul"). The disabled Save button renders `rgb(62,67,71)` on `rgb(222,226,229)` — a 7.68:1 ratio, `cursor: not-allowed`, 670×48 — with "Paste the admin token above before saving." below it.

**`/dashboard` — reorganizes.** 390/768: hypothesis, funnel and lift card stacked in one column. 1280: funnel left, lift card right, with a large empty region below the lift card. In the funnel chart the two series are distinguished **by colour alone** (teal `calm` / red-brown `urgent`), with no pattern or in-bar label; the legend sits below the whole chart and is off-screen at 1280 in the viewport capture. Each bar's `<meter>` does carry the variant in its `aria-label`.

**404 — no reflow path, and an empty mark.** Same centred card at all three widths. Above the title sits a 48×48 `<span class="_mark_…" aria-hidden="true">` with `border: 2px solid rgb(163, 0, 24)`, no content and no `::before`/`::after` — it renders as an empty red rounded square. `ErrorState.module.scss:14-15` describes it as an intentional shape ("A square, where the empty state's mark is a circle"), so this is what it is meant to be, not a failed icon load. Reported because it reads as a missing glyph.

---

# UNCERTAIN

- **`/scan` has no Lighthouse audit.** The route redirects to `/result` on its own; the first `lighthouse_audit` I aimed at `/scan` reported `URL: http://localhost:5173/result` and I used that report for the `/result` screen. Lighthouse navigates without my `initScript`, so I could not hold `/scan` open for it. `/scan`'s accessibility category is unmeasured — no contrast ratios, no audit IDs.
- **`/scan` was measured under an injected stub.** All three viewport measurements and screenshots of `/scan` were taken with `setTimeout` calls ≥250ms suppressed. That is what kept the screen on-screen; it may also have suppressed timer-driven copy changes or progress steps I therefore never saw.
- **Keyboard traversal was run at 1280 only.** The step-2 grep found no `order`, `*-reverse` or grid reordering in the changed CSS, so the DOM order at 390 is the order I measured — with one exception I measured directly instead of re-running: on **`/result` at 390** the "Protect me now" CTA is **index 0 of 32** in DOM order (so the first Tab stop) while rendering in a `position: fixed; bottom: 0` bar at the bottom of the screen (top 784 of an 844px viewport). Tab order and visual order diverge for that control at 390; at 1280 the same control is top-right and the two agree. I did not re-run the full 33-press traversal at 390.
- **Reduced motion is established from the served stylesheet, not from the browser under the real media feature.** The `emulate` tool has `colorScheme` but no reduced-motion parameter, so I read the CSSOM and `getAnimations()` instead. I know the rules exist and what they resolve to; I did not observe the browser applying them.
- **`/result` at 768 was measured twice.** My first run replaced the script's final field with its length to keep the output small; I re-ran it verbatim and every number reported for that viewport comes from the verbatim run. All other 20 measurements were the script verbatim, first time.
- **Only one variant of the A/B'd result screen was seen.** Every capture of `/result` shows the `urgent` arm ("You're exposed!", 99% traffic share per `/admin`). The `calm` arm ("Known breaches") was never rendered, so it is unmeasured at all three viewports.
- **Authenticated `/admin` is unmeasured.** I did not supply an admin token, so the saving, saved, conflict and error states — and whatever the Save button looks like enabled — were not reached.
- Loading, empty and error states for `/result` and `/dashboard` were not reached; both screens had data on every load.
- The 20 `/result` disclosure buttons were never expanded, so the expanded card state is unmeasured.
