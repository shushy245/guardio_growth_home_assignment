# S7 — visual review of `/dashboard`

Run 2026-09-19 by the independent `visual-reviewer` agent (pass A and pass B), given only the
changed rendered files and the URL, against the compose stack rebuilt at `03319ac`, mid-way
through the first simulation run (279 of 4,921 per arm). The report is folded in verbatim
below; the triage follows it.

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
| V8 | Loading, error and zero-sample states unmeasured; real `prefers-reduced-motion` unmeasured; hover/active unmeasured | unmeasured, stated | The reviewer deliberately did not manipulate the shared stack. The states are driven by the page tests (F3, F4); `visual-review-deep` on request. |

Accessibility 100, Best Practices 100; zero overflow, zero tap-target and zero text-size
violations at 390, 768 and 1280; console clean on load and on a cache-ignoring reload.

## Report, verbatim

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
