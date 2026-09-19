# S7 — visual review of `/dashboard`

Three runs on 2026-09-19 by the independent `visual-reviewer` agent, given only the changed
rendered files and the URL. Run 1 (pass A and B) against the stack rebuilt at `03319ac`,
mid-way through the first simulation (279 of 4,921 per arm). Run 2 (pass A and B) at
`/story-done`, against `9416524` with the full simulated read. Run 3, a targeted re-measure of
the banner after `b9d0718`. All three reports are folded in verbatim below; the triage covers
all of them.

## Triage

| # | Finding | Class | Outcome |
|---|---|---|---|
| V1 | Four text blocks under the 45-character floor at 390; one at 1280 (the banner's status line, 43) | precondition | Recorded. At 390 a 16px line inside a 16px gutter measures ~43 characters; the floor cannot be met without text under the 16px floor, which is the harder rule. The 1280 case is a one-line status, not prose. |
| V2 | The lift card's interval line runs to 90 characters at 768 — a `span`, so the global `p` measure does not cap it | fix | `LiftCard.module.scss`: `.interval` capped at `$prose-measure` (refactor commit after C11). |
| V3 | ~350px of blank white inside the lift card at 1280, stretched to the funnel card's height | fix | `Dashboard.module.scss`: `.pair { align-items: flex-start }` — content-height cards (same commit). |
| V4 | The bars' `aria-label`s sit on elements with no `role` attribute; whether AT announces them is uncertain | dismissed, precondition stated | The bars are native `<meter>` elements, whose implicit ARIA role is `meter`; the reviewer read the `role` *attribute*, which is absent by design. The `progress` element it did accept is the same shape. Precondition: a screen-reader pass would confirm; none was available. |
| V5 | The chart renders no numbers to a sighted reader; the two "Landing" bars (353 vs 398) look equal at full width | recorded, deferred | By design at this size: each series is sized against its own first step, so both first bars are full and the *shape* of each funnel is what the eye reads; the count is in the accessible name. The dataviz skill's per-mark hover tooltip is the natural addition and is not built (no consumer asked for it, YAGNI); a `title` on each bar would be the one-line change. |
| V6 | The `md` query changes only padding; 768 is a wider copy of 390 | by design | The design's own note: "390 → 768: cards stay stacked; only padding and card width grow." The reorganisation is at `lg`, and the reviewer observed it. |
| V7 | The banner's status line is not a heading | by design | It is the call, announced as `role="status"`, not a section. |
| V8 | Loading, error and zero-sample states unmeasured; real `prefers-reduced-motion` unmeasured; hover/active unmeasured; the `ship` and `stop` banners unmeasured; non-text contrast of the bar and progress fills unmeasured (pseudo-element backgrounds do not resolve through `getComputedStyle`) | unmeasured, stated | The reviewer deliberately did not manipulate the shared stack. The states are driven by the page tests (F3, F4); `visual-review-deep` on request. |
| V9 | **Defect (run 2):** the banner's class attribute carried the raw enum string `wait` beside the hashed module class; it matched no rule, and the banner painted neutral grey (`rgb(238, 242, 245)`) instead of the warning tint | fix | `RecommendationBanner.tsx`: a `toneClassMap` from the enum to `styles.*`, as the lift's direction map and the chart's series map already did (`b9d0718`). **Confirmed by run 3:** class `_wait_rmbaa_42`, background `#f7e6c3`, colour `#423000`, contrast 10.31:1, identical at 390 and 1280. Precondition recorded on the map: Vitest's non-scoped CSS modules make the raw and the hashed name one string in every test. |
| V10 | Run 2 confirmed V2 and V3 closed: nothing over 75 characters at any width (the interval line now wraps at 768), and the lift card is content-height at 1280 | confirmed | — |

Accessibility 100, Best Practices 100 in both full runs; zero overflow, zero tap-target and
zero text-size violations at 390, 768 and 1280; console clean on load and on a cache-ignoring
reload, both runs.

## Run 1 report, verbatim (`03319ac`)

VISUAL REVIEW — http://localhost:5173/dashboard (one screen). Pass A and pass B both ran in full. No restore outstanding: the only environment change was an in-page `tabindex="-1"` on `<body>` for the focus instrumentation, discarded by the next `emulate` reload and again by the `ignoreCache` reload. No rebuild was needed — the change was confirmed live on first load. Lighthouse reports were written to the session scratchpad, nothing to the repo.

**Change confirmed live:** hashed CSS-module classes from the changed files are in the DOM — `_chart_v2y4g_`, `_bar_v2y4g_`, `_lift_100fz_`, `_banner_rmbaa_`, `_card_ec507_`, `_page_22bjy_` — with `data-testid="DashboardTestIds.Page"` on `<main>`.

### MEASURED

**Source signals (step 2 grep over all 19 changed files)**
- No `max-width` media query anywhere in the changed styles. The only `max-width` uses are properties, not queries: `frontend/src/pages/Dashboard.module.scss:11` `max-width: tokens.$content-max;` and `frontend/src/styles/tokens.scss:127` `$prose-measure: 65ch;`.
- Both media queries are `min-width` over breakpoint tokens, no literals: `frontend/src/pages/Dashboard.module.scss:49` `@media (min-width: tokens.$breakpoint-md) {` and `:55` `@media (min-width: tokens.$breakpoint-lg) {`. No other changed `.module.scss` contains a media query at all.
- Searched for `matchMedia`, `isMobile`, `innerWidth` across all changed `.tsx`/`.ts` — **none found**. No width branch in any component.
- Searched for `100vh` / any `vh` unit in the changed styles — **none found**, so the `100vh`/`100dvh` question does not arise here.
- One hardcoded px width: `frontend/src/charts/FunnelBars.module.scss:87` `width: 12px;` (the legend swatch).
- Content-reordering properties (`order:`, `row-reverse`, `column-reverse`, `grid-area`/`grid-row`/`grid-column`, `position: absolute`) — **none found** in any changed file. The three `border: 0` hits are the grep's `order:` substring matching `border:`, not real matches.
- `animation`, `transition`, `prefers-reduced-motion` — **none found** in any changed file.

**Measurement script (run verbatim, all three viewports)**
- Horizontal overflow: `scrollWidth === visualViewport.width` at all three — 390/390, 768/768, 1280/1280. `FAIL: false`, zero offenders, at every viewport.
- Tap targets ≥44×44: zero violations at all three viewports — vacuously, because the page has **zero interactive controls** (see below).
- Body text ≥16px: zero violations at all three. Every measured text block is exactly 16px at 390, 768 and 1280.
- Line length 45–75 characters — the only threshold breached, at every viewport:
  - **390**: 4 blocks below the 45-char floor — "An urgent framing of the resul…" **43**, "Baseline 8% · powered to detec…" **43**, "95% CI −8.3% to +174.8% · p = …" **43**, "Keep running — 279 of 4,921 re…" **36**.
  - **768**: 1 block above the 75-char ceiling — "95% CI −8.3% to +174.8% · p = …" at **90 chars**. (The hypothesis paragraph is inside measure here; the CI line is not capped by `$prose-measure`.)
  - **1280**: 1 block below the floor — "Keep running — 279 of 4,921 re…" at **43 chars**.

**Console** — read at 1280, then reloaded with `ignoreCache: true` and read again: **no console messages of any kind on either read**. No errors, no warnings, no React or Vite output.

**Pass B — Lighthouse (`navigation`, desktop, at 1280)**
- Accessibility **100**, Best Practices **100**. 43 audits passed, 3 failed.
- The three failures are all outside accessibility: `meta-description` ("Document does not have a meta description"), `robots-txt` ("robots.txt is not valid") under SEO (category 0.82), and `llms-txt` ("llms.txt does not follow recommendations") under Agentic Browsing (0.67).
- **Zero** colour-contrast failures, zero missing form labels, zero image-alt violations, zero landmark/document-structure violations, as the audit states them.

**Pass B — heading order (1280).** Four headings, in document order: `h1` "Result screen tone test" → `h2` "Hypothesis" → `h2` "Funnel by variant" → `h2` "Lift on activation". Exactly one `h1`, no level skipped. Clean.

**Pass B — accessible names on controls (1280).** The query over `button, a, input, select, textarea, [tabindex], [role=button]` returned **an empty array**. There is not a single interactive control on this page — no buttons, no links, no inputs, not even a link back to the rest of the app. So **N = 0**. Nothing to report as unnamed, and nothing named by a placeholder.

**Pass B — keyboard traversal (run at 1280; where a tab order can diverge from visual order at all).** With N = 0 the traversal is N+1 = 1 press; I pressed **Tab twice** to prove the wrap rather than one. Focus was moved to `document.body` first and a `focusin` listener logged every move. After both presses the log contains **only the initial `BODY` entry** and `document.activeElement` is still `BODY` — focus left the document into browser chrome and came back to nothing. No control is reachable because none exists. No focus trap, and no interactive control that focus fails to reach: the only element carrying a click handler is `div#root`, which is React's own event delegation, not a control.
  - Re-run at 390 **not required and not run**: the step 2 grep found no `order`, `row-reverse`, `column-reverse`, `grid-area`/`grid-row`/`grid-column` or `position: absolute` in the served CSS, and there is one DOM tree with no width branch — so the order at 390 is the order measured at 1280, which is the empty order.

**Pass B — visible focus indicator.** Not applicable and not measurable: focus reaches no control, so there is no focused-vs-unfocused comparison to make. This is a consequence of N = 0, not an unchecked item.

**Pass B — reduced motion.** `document.getAnimations()` at 1280 returns **0 animations**; `animationCount: 0`. The step 2 grep found **no `animation`, no `transition` and no `@media (prefers-reduced-motion`** in any of the changed files. Nothing is running, so there is nothing for a reduced-motion query to suppress on this screen.

**Chart text alternatives (measured from the DOM).** Each bar carries an `aria-label` with its series, step and count — e.g. `aria-label="calm, Landing: 353 visitors"` and `aria-label="urgent, Landing: 398 visitors"`. These labels are on elements with **no `role` attribute** (`role: null`), and the chart container itself has `role: null` and `aria-label: null`. An accessible name on an element that computes to `role=generic` is not reliably exposed by assistive technology; Lighthouse does not audit this, so its 100 does not cover it. The progress element is a real `<progress class="_progress_rmbaa_53" value="279" max="4921" aria-label="Visitors per arm so far, of the sample required">` — native element, named.

### OBSERVED

- **Reflow path exists and reorganizes, not just shrinks.** 390 and 768 are one stacked column (Hypothesis, Funnel, Lift). At **1280** the layout genuinely reorganizes: "Funnel by variant" and "Lift on activation" sit side by side as two cards in a row, and the Recommendation banner moves inside the right-hand column. 390 and 1280 are not the same layout. The `$breakpoint-md` query at `Dashboard.module.scss:49` produces no visible change at 768 — 768 renders as a wider copy of 390 (same stack, same order); the side-by-side pairing appears only at the `lg` step.
- **The funnel chart renders no numbers to a sighted reader.** At all three viewports the six steps (Landing, Scan started, Scan completed, CTA click, Sign-up started, Activation) show two coloured bars each with no value labels, no axis, no ticks and no gridlines. The counts exist only in the `aria-label`s. A sighted reader can compare bar lengths but cannot read any figure off the chart — including whether the two "Landing" bars (353 vs 398) differ, which at full width they visibly do not.
- **Series are distinguished by colour plus a text legend.** Teal (`calm`) and rust (`urgent`), with a legend reading "calm" / "urgent" next to 12px swatches. The pairing of bar to series within a step relies on colour and on consistent top/bottom ordering; there is no per-bar text.
- **Large empty area in the right-hand card at 1280.** The "Lift on activation" card stretches to match the height of the funnel card beside it: content ends at roughly y=480 and the card border runs to roughly y=838, leaving about 350px of blank white inside the card. At 390 and 768 the card is content-height and this does not occur.
- **The Recommendation banner title is not a heading.** "Keep running — 279 of 4,921 required per arm" renders in bold at body size on a grey tinted panel, inside the Lift card, as a non-heading element (it is absent from the four-heading list above).
- **The banner's progress bar is a very short dark-olive segment** on a light track — at 1280 roughly 20px of fill in a ~350px track, consistent with 279/4921. It renders as a small dark nub; nothing is clipped or broken about it.
- Nothing clipped, nothing truncated, no broken images (the page contains no images), no font-loading flash observed on the `ignoreCache` reload, no overlapping or mis-stacked elements at any viewport. The "+58.7%" figure renders dark green on white; Lighthouse measured contrast as passing.
- All three viewports captured `fullPage: true`, consistently.

### UNCERTAIN

- **Whether the `aria-label`s on the bars are actually announced.** I measured that the labels are present and that the elements carry no `role`; I did not run a screen reader, so I cannot say what any given AT does with a name on a generic element.
- **Reduced motion under the real media feature.** The `emulate` tool has no reduced-motion parameter, so I determined this from the served CSS and `getAnimations()` only. I established that the changed stylesheets declare no animation, transition or `prefers-reduced-motion` block and that nothing is animating at load — not what the browser does under the real media feature, and not what happens during a data-loading transition I did not observe.
- **Only the loaded, populated state was measured.** The page rendered with real data on every load. I did not reach or measure the loading, empty, error or zero-sample states, nor any state where the experiment read fails — so nothing here speaks to those.
- **The `$breakpoint-md` rule.** I observed no visual difference at 768 and did not resolve what `Dashboard.module.scss:49` changes or at what pixel value `$breakpoint-md` sits; it may take effect between 768 and 1280.
- **Interaction states.** There are none to check on this screen (no controls), but I also did not test hover, active or any pointer interaction, and I did not scroll-test at a viewport height other than the emulated ones.
- The three failing Lighthouse audits (`meta-description`, `robots-txt`, `llms-txt`) are site-level, not specific to this screen or this diff; I did not determine whether they pre-date the change.

**Not checked, and why:** screen-reader announcement (no AT available); real `prefers-reduced-motion` (no emulation parameter); all non-populated data states (I did not manipulate the backend, deliberately, to leave the shared stack untouched); the `md` breakpoint's actual value and effect (would have required a call beyond re-measuring). Every viewport ran — 390x844x3 mobile/touch, 768x1024x2, 1280x800x1 — none skipped.

## Run 2 report, verbatim (`9416524`, pass A and B at `/story-done`)

VISUAL REVIEW — http://localhost:5173/dashboard (one screen). Pass A + Pass B both ran in full. All three viewports measured. No restore outstanding.

CHANGE CONFIRMED LIVE — no rebuild was needed. CSS-module class names are hashed without file names, so I matched on rendered strings instead: `Funnel by variant` (frontend/src/pages/Dashboard.tsx:104) and `Keep running — 1,885 of 4,921 required per arm` (frontend/src/components/RecommendationBanner.utils.ts:32) are both in the DOM.

=== MEASURED ===

Source signals (one grep over all 19 changed files):
- No `max-width` media query in the new styles. The only two media queries are min-width over tokens: `frontend/src/pages/Dashboard.module.scss:52` `@media (min-width: tokens.$breakpoint-md)` and `:58` `@media (min-width: tokens.$breakpoint-lg)`.
- No width branch in any component: searched `matchMedia`, `isMobile`, `innerWidth` across all changed `.tsx`/`.ts` — zero matches.
- No `100vh` anywhere in the changed files (and no `100dvh`).
- One hardcoded px width: `frontend/src/charts/FunnelBars.module.scss:87` `width: 12px` (the legend swatch, paired with `height: 12px` at :88). Every other width/cap is a token (`LiftCard.module.scss:40` `max-width: tokens.$prose-measure`; `Dashboard.module.scss:11` `max-width: tokens.$content-max`).
- Pass-B grep: no `order:`, `row-reverse`, `column-reverse`, `grid-area`, `grid-row`, `grid-column`, or `position: absolute` in any changed stylesheet. No `@keyframes`, no `animation`, no `transition`, and no `@media (prefers-reduced-motion` in any of the seven changed stylesheets. (My first grep's `order:` alternation false-matched `border: 0` at FunnelBars.module.scss:33/38, RecommendationBanner.module.scss:39, _card.scss:9 — I re-ran precisely; there is no real flex reordering.)

Measurement script, run verbatim at each viewport:
- Horizontal overflow: PASS at all three. 390 → scrollWidth 390 / limit 390. 768 → 768/768. 1280 → 1280/1280. Zero offending elements at every width.
- Tap targets ≥44×44: PASS, vacuously — the script found zero elements matching `a,button,input,select,textarea,[role=button],[onclick]` at any viewport, because the page has no interactive controls (see traversal below).
- Body text ≥16px: PASS at all three. Zero blocks under 16px at 390, 768 or 1280.
- Line length 45–75 chars: four blocks below the 45 lower bound at 390 — "An urgent framing of the resul…" 43ch @16px, "Baseline 8% · powered to detec…" 43ch @16px, "95% CI +7.3% to +62.9% · p = 0…" 43ch @16px, "Keep running — 1,885 of 4,921 …" 36ch @16px. Zero flagged at 768. One at 1280: "Keep running — 1,885 of 4,921 …" 43ch @16px (it sits in the narrow right-hand card). Nothing exceeded the 75 upper bound at any width.

Console: clean. Read once, reloaded with `ignoreCache: true`, read again with preserved messages — no messages of any type, either pass.

Pass B, at 1280:
- Lighthouse (navigation, desktop): Accessibility **100**, Best Practices 100, SEO 82, Agentic Browsing 67. 43 passed / 3 failed. No accessibility audit failed. The three failures are all non-a11y: `meta-description` ("Document does not have a meta description"), `robots-txt` ("robots.txt is not valid" — the dev server returns index.html, so every line reports "Syntax not understood"), `llms-txt` ("File is missing a required H1 header", "File does not appear to contain any links"). `color-contrast` scored 1. `label`, `link-name`, `button-name`, `target-size`, `bypass`, `list`, `image-alt` were all **notApplicable** — consistent with a page that has no controls, links or images.
- Heading order: `h1` "Result screen tone test" → `h2` "Hypothesis" → `h2` "Funnel by variant" → `h2` "Lift on activation". Exactly one `h1`, no level skipped. Lighthouse `heading-order` scored 1.
- Accessible names on controls: N = **0**. The probe found zero `button`, `a`, `input`, `select`, `textarea`, `[role=button]` or `[tabindex]` elements in the document, and zero elements matching `a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])`. No control lacks a name because no control exists. The one non-native node the probe flagged was `<div id="root">` carrying React's delegated `onclick` — not an interactive control, so not a finding.
- Keyboard traversal, run at **1280** (stated per spec): focus moved to document start, then Tab pressed twice (N+1 = 1 was the minimum; I pressed 2). The `focusin` log contains only the initial `BODY` entry — focus never entered any element, and `document.activeElement` was still `BODY` afterwards. There is no focus trap and no control that focus fails to reach, because the page contains nothing focusable; Tab leaves the document for browser chrome on the first press. No re-run at 390 was needed: one DOM tree, and the grep found no reordering properties in the served CSS, so the order at 390 is the order measured at 1280 — which is to say, empty at both.
- Visible focus indicator: **not applicable, and this is why** — there is no control for focus to reach, so there is nothing whose focused-vs-unfocused appearance can be compared. I did not run the probe.
- `prefers-reduced-motion`: `document.getAnimations()` returned **0** running animations. The seven changed stylesheets contain no `@keyframes`, no `animation`, no `transition` and no `@media (prefers-reduced-motion` block. Nothing is in motion on this page, so there is no infinite animation to honour or fail to honour.

DEFECT — the recommendation banner's tone class is emitted unhashed and paints nothing:
- The banner's live class attribute is `_column_17g6y_8 _banner_rmbaa_17 wait`. `_banner_rmbaa_17` is the hashed CSS-module class; **`wait` is a raw, unhashed string** and matches no rule in the compiled stylesheet.
- Measured computed values on that element: background `rgb(238, 242, 245)`, color `rgb(18, 28, 35)`. The `.wait` rule (`RecommendationBanner.module.scss:25-27` → `fields.message-warning` → `_fields.scss:54-57`) specifies background `tokens.$color-warning-tint` `#f7e6c3` and color `tokens.$color-warning` `#423000`. Neither is applied.
- Source: `frontend/src/components/RecommendationBanner.utils.ts:17-26` — `enum BannerClass { Ship = 'ship', Stop = 'stop', Wait = 'wait' }` and `bannerClassMap: Record<Recommendation, BannerClass>` map to those raw strings; `RecommendationBanner.tsx:19` interpolates the result directly: `` className={`${styles.banner} ${bannerClassMap[result.recommendation]}`} ``. It never goes through `styles`.
- This is a single site. The two neighbouring maps do it the other way and render correctly: `LiftCard.tsx:20-24` `directionClassMap` holds `styles.up` / `styles.down` / `styles.flat`, and `FunnelBars.tsx:23` `seriesClasses` holds `[styles.series1, styles.series2]` — the teal and rust bars and swatches paint as specified (`rgb(0, 82, 86)` and `rgb(139, 32, 0)` measured on the legend swatches).
- The three tone classes `.ship` / `.wait` / `.stop` are all supplied by the same map, so by the same mechanism none of the three can paint; I measured only the `wait` state, which is the one the current data renders.

=== OBSERVED ===

- Reflow is real, not a shrink. At 1280 the "Funnel by variant" card and the "Lift on activation" card sit side by side (the `.pair` Row), the funnel card taking roughly the left 56% and the lift card the right; at 768 and 390 the same two cards are stacked full-width, funnel above lift. The layout at 390 is not a narrower copy of 1280 — the two-column pair collapses to one column, and the page cap at `tokens.$content-max` leaves symmetric margins at 1280. The 768 capture is the 390 layout at wider measure (both single-column); the second breakpoint's effect is the one visible between 768 and 1280.
- The funnel chart renders **no numeric value and no axis anywhere on screen**. Six step labels and twelve bars; the counts exist only in the `aria-label` of each `<meter>` ("calm, Landing: 2,414 visitors", "urgent, Activation: 185 visitors", and so on). A sighted reader gets bar length against an unlabelled scale; a screen-reader user gets the numbers. At the Activation step the two bars are ~18px and ~24px wide at 1280 against a ~520px plot, and the difference the whole page is about is carried by those six pixels with no number beside them.
- The banner renders as a neutral grey block (`rgb(238, 242, 245)`) on the white lift card, with near-black text — visually it reads as a muted/inert panel rather than a warning, which is what the measured class defect above predicts.
- The progress bar inside the banner renders a dark olive fill on a near-white track. Source: `RecommendationBanner.module.scss:49-52` paints `::-webkit-progress-value` with `tokens.$color-warning` `#423000` over `rgba(255, 255, 255, 0.5)`. Because the banner's warm tint never applied, that fill sits on grey rather than the `#f7e6c3` it was specified against.
- No clipped or truncated text at any of the three viewports; no ellipsis, no overlapping content, no broken image (there are no images), no font-loading flash observed on the `ignoreCache` reload (the font is self-hosted), no element rendering as though disabled.
- The `+32.2%` figure renders dark green and is the largest type on the page; the CI/p-value line below it renders grey at 16px.

=== UNCERTAIN ===

- I could not read the painted color of the `<meter>` and `<progress>` fills from the DOM: `getComputedStyle(el, '::-webkit-meter-optimum-value')` returned `rgba(0, 0, 0, 0)` and the progress pseudo returned the host's `rgba(255, 255, 255, 0.5)`, so the pseudo-element backgrounds do not resolve through that API. The color values I quote for those fills come from the stylesheets (`FunnelBars.module.scss` `.series1`/`.series2`, `RecommendationBanner.module.scss:50`) and from the legend swatches, which use the same tokens on ordinary elements and did measure (`rgb(0, 82, 86)`, `rgb(139, 32, 0)`). The bar fills themselves are unmeasured.
- Non-text contrast (WCAG 1.4.11) of the bars against the card and of the progress fill against its track is **not** measured — Lighthouse's `color-contrast` audit covers text only, and the fills would not resolve per the point above.
- Reduced motion: I established what the served stylesheets contain and that nothing is currently animating. I did **not** exercise the real `prefers-reduced-motion` media feature — the `emulate` tool exposes `colorScheme` but no reduced-motion parameter.
- Only the one data state was reviewed: the `KeepRunning` recommendation with a partially-filled sample bar. The `ShipVariant` and `KeepControl` banner states, the "no significant difference yet" wording, the loading state (`Dashboard.tsx:90`), and any error/empty state were not rendered and are unmeasured — though the class-map defect above is mechanical and applies to all three tones.
- Interaction states are unmeasured because there is nothing to interact with; hover, active and focus were not exercised.
- The two mobile viewports were captured with touch/mobile emulation (`hoverNone: true` at 390, `false` at 768 and 1280) — real-device rendering is not covered.

Environment: I changed nothing that needs undoing. No rebuild was run (the change was already live). The `focusin` listener and the temporary `tabindex` on `<body>` were in-page only and were discarded by the next `emulate`, which reloads the document. I opened one extra tab on `/dashboard` (pageId 6, alongside the pre-existing pageId 5) and left it at 1280x800x1 emulation; the other tabs (`/signup`, `/protected`, `/dashboard`) were already open and were not touched. All three screenshots were `fullPage: true`, the same mode at every viewport.

## Run 3 report, verbatim (`b9d0718`, banner re-measure)

RE-MEASURE — recommendation banner only, http://localhost:5173/dashboard, at 390 and 1280. Reloaded with `ignoreCache: true` before measuring. The earlier defect (V9) is closed.

CHANGE CONFIRMED LIVE — the emitted class is now hashed. Full class attribute, identical at both viewports:
`_column_17g6y_8 _banner_rmbaa_17 _wait_rmbaa_42`
The tone class is `_wait_rmbaa_42` (hashed), where the previous build emitted the raw, unmatched `wait`. Source side, `frontend/src/components/RecommendationBanner.tsx` now routes the enum through the module: a new `toneClassMap: Record<BannerClass, string | undefined>` holding `styles.ship` / `styles.stop` / `styles.wait`, applied as `joinClassNames(styles.banner, toneClassMap[bannerClassMap[result.recommendation]])`. `bannerClassMap` in the utils file is unchanged and still returns the `BannerClass` enum; the new map is the indirection between the enum and the hashed class.

=== MEASURED ===

At **1280** (1280x800x1):
- class attribute: `_column_17g6y_8 _banner_rmbaa_17 _wait_rmbaa_42`
- computed background: `rgb(247, 230, 195)` — composited over ancestors `#f7e6c3`, which is `tokens.$color-warning-tint` exactly
- computed color: `rgb(66, 48, 0)` — `#423000`, which is `tokens.$color-warning` exactly
- title text "Keep running — 1,885 of 4,921 required per arm", 16px, weight 600, color `rgb(66, 48, 0)`
- **contrast ratio, title text vs banner background: 10.31:1** — passes WCAG AA for normal text (≥4.5) and AAA (≥7)

At **390** (390x844x3, mobile, touch):
- class attribute: `_column_17g6y_8 _banner_rmbaa_17 _wait_rmbaa_42` — identical
- computed background: `rgb(247, 230, 195)`, composited `#f7e6c3` — identical
- computed color: `rgb(66, 48, 0)` — identical
- title 16px, weight 600
- **contrast ratio, title text vs banner background: 10.31:1** — identical, passes AA and AAA
- banner box 316×96 (the title wraps to two lines at this width)

The banner background carries no alpha at either viewport (`rgb(...)`, not `rgba(...)`), so the composited value equals the raw computed value; I composited through the ancestor chain anyway and it did not move.

=== OBSERVED ===

- The banner now renders as a warm cream panel with dark brown text, visually distinct from the white lift card it sits in — where the previous build rendered it neutral grey. This matches the measured `#f7e6c3` / `#423000`.
- The progress bar inside it now reads as intended: the dark olive `#423000` fill sits on the near-white track against the warm tint, rather than on grey. The fill occupies roughly the left 38% of the track, consistent with 1,885 of 4,921.
- No clipping or overflow introduced at 390 — the title wraps to two lines inside the banner and the progress bar sits below it at full banner width.

=== UNCERTAIN ===

- Only the `wait` tone was rendered, because the live data still yields `KeepRunning`. `styles.ship` and `styles.stop` now go through the same `toneClassMap`, so the mechanism is fixed for all three, but the `ship` and `stop` banners remain **unmeasured** — I did not render them.
- Non-text contrast of the progress fill against its track and against the banner tint is still not measured; the `::-webkit-progress-value` background does not resolve through `getComputedStyle` on the pseudo-element (same limitation as the first pass).
- Per your instruction I re-ran nothing else: no measurement script, no Lighthouse, no console read, no 768 viewport. Every other finding in my first report stands as written, unverified against this build.

Environment: nothing changed that needs undoing. The tab (pageId 6) is left at 390x844x3 mobile/touch emulation — my previous report noted it at 1280, so that is the one difference from the state I described earlier.
