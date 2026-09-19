# Component inventory and design translation (D1)

Written 2026-09-19 from the Claude Design handoff. Source of truth for what the design says:
`docs/design/claude-design-export/` (the project's 16 files, verbatim; open `Index.dc.html` for
the map). Source of truth for what the code does: `frontend/src/styles/tokens.scss`. When the
two disagree, the difference is listed under **Deviations** below, never left silent.

## What the handoff contained

| Asked for in the prompt | Delivered | Where |
|---|---|---|
| Token list, tone sets sharing names | Yes — colour (core, calm/urgent sets, semantic, disabled), type scale from 16px, weights, leading, spacing, radii, elevation, measure, content cap, gutters, breakpoints, focus ring | `Tokens.dc.html` |
| Component inventory with states | Yes — 24 components, each with its states | `Components.dc.html` |
| Every screen at 390 / 768 / 1280 | Default state at all three widths on every screen; secondary states once (390, or 1280 for the dashboard); the result screen in both variants at each width | `S1`–`S7` |
| Exported HTML/CSS | Yes — inline-styled HTML, with the result, scan, sign-up and dashboard bodies as live components (`*Body.dc.html`) | same |
| Decisions the designer made unprompted | Ten, listed | `Decisions.dc.html` |

## Token translation

The design writes colours in `oklch()`. Most of its saturated values sit outside the sRGB gamut
(calm accent-strong asks for chroma 0.13; sRGB holds 0.054 at that lightness and hue). Chrome on
an sRGB display gamut-maps them by reducing chroma at constant lightness and hue, and that is
what `tokens.scss` records, as hex, with the oklch source beside each value. Two reasons for hex
rather than pasting the oklch: the review tooling measures contrast from computed `rgb()`, and a
display-P3 laptop would otherwise show a richer teal than the one measured. Every text-on-fill
pair the screens use was computed at translation:

| Pair | Ratio |
|---|---|
| disabled text on disabled fill (the S3 finding, was 2.58:1) | 7.68:1 |
| on-accent on calm accent-strong (primary button) | 10.72:1 |
| on-accent on urgent accent (urgent CTA) | 8.90:1 |
| secondary text on page background | 6.98:1 |
| warning on warning tint · danger on danger tint · success on success tint | 10.38 · 6.68 · 7.89 |
| calm accent on calm tint (selected chip) | 6.93:1 |

The three findings carried from the S3 visual review are answered by a token each, not a
per-page override:

- **BF36, disabled Save at 2.58:1** → `$color-disabled-fill` / `$color-disabled-text` in the
  `button-primary` mixin's `:disabled` rule. The text pair measures 7.68:1 and the finding is
  closed. The border the design asked for as a *second* signal is drawn in `$color-border` on
  `$color-disabled-fill` — **1.13:1, not perceptible** (BF52); today the fill carries the signal
  alone.
- **BF42, 14px body text** → `$text-100` is 16px and the floor; the `field`, `note` and
  `message` mixins use it; nothing in the app sets a smaller size.
- **96–101 character measure at 768/1280** → `$prose-measure: 65ch`, applied to every `p` in
  `global.scss`.

The type family is `Source Sans 3`, self-hosted from `@fontsource-variable/source-sans-3` and
imported once in `main.tsx`. Self-hosted rather than Google Fonts because the stack is loopback
only, a security product's page should not call a third-party origin to draw text, and offline
development keeps the real face.

## Component inventory

Names are the design's, and they are what S5–S7 name their components and drivers after
(`BreachRow.tsx` / `BreachRow.driver.tsx`, and so on). The story column is where each is built.

| Component | States | Story | Notes |
|---|---|---|---|
| `Button` | primary · secondary · ghost; default · loading · disabled | D1 (mixins) · S6 | `button-primary` / `button-secondary` mixins in `_fields.scss`; the loading spinner is the `button-spinner` mixin (S6, the sign-up's submit). **Ghost is not built:** no screen uses it ("Skip for now" appears on none of the seven), so it waits for a consumer (YAGNI) |
| `StickyCtaBar` | — | S5 | One CTA node; sticky at 390, inline in the header at 768+ by CSS only (F19, F20) |
| `SummaryTile` | loaded · skeleton | S5 | 2×2 at 390, one row of four at 768+ (flex-wrap, no grid) |
| `SearchField` | idle · focus | S5 | |
| `FilterChip` | idle · selected | S5 | 44px tall, single-select, selected chip clears on tap (F9) |
| `ToggleField` | off · on | S5 | Verified only |
| `SegmentedControl` | one selected | S5 | Sort: Newest · Most accounts · Name (F8). Segments 44px tall, not the design's 36 (deviation 3) |
| `ResultsLine` | with / without Clear | S5 | "Showing 20 of 1,031" (F15) |
| `BreachRow` | collapsed · expanded · skeleton · no-logo | S5 | Expanded reveals the description (F21, new). The no-logo state is not built: the design's mock renders an initial in a square rather than the HIBP image, and every record carries a title, so the `?` case for an unnamed source cannot arise from the data (S5, YAGNI) |
| `DataClassBadge` | plain · passwords | S5 | Passwords in the danger pair (F17) |
| `VerifiedMark` | — | S5 | |
| `LoadMoreButton` | idle · loading | S5 | F10 |
| `EmptyFilterState` | — | S5 | Dashed border, circle mark; distinct from the error state (F16) |
| `ErrorState` | with retry | S5 | Sunken fill, square danger mark (F4, F11) |
| `PlanCard` | idle · selected | S6 | `PlanPicker`: two cards as one radio group, the whole card the target, the ring drawn on the real radio (F7) |
| `TextField` | idle · focus · error | D1 (mixin) · S6 | `input` mixin; the error state is a danger border and an inline message (`Signup`, F14) |
| `PasswordField` | idle · checking · leaked · unchecked · error | S6 | F3–F6, F11, F16; the check runs in `usePasswordLeakCheck` and the field renders what it is handed (deviation 11) |
| `StatusMessage` | info · success · warning · error | D1 (mixins) | `message` + `message-success/warning/error` mixins. `message-error` has two consumers — the sign-up's inline error and the dashboard's keep-control banner — and **the admin surfaces are still the exception**: a failed flag load renders as the neutral chip, byte-identical to the one that says "Loading flags…", and a save failure shares a tone with a lock conflict (BF51) |
| `Skeleton` | — | S5 | Shimmer with a reduced-motion static state |
| `ProgressIndicator` | — | S5 | The scan moment's bar (F3) |
| `HypothesisCard` · `FunnelBars` · `LiftCard` · `RecommendationBanner` | ship · keep-control · keep-running · error | S7 | F2–F4. `FunnelBars` is the design's `FunnelChart`, built as CSS bars behind `frontend/src/charts/` with a chart-library-agnostic prop contract (S7 design call 2 in `docs/plan.md`); the series colours are `$series-1` / `$series-2` (deviation 14). The lift card leads with the **primary** metric, activation, where the mock's illustration reads "Lift on CTA click" (deviation 8) |

Screens: `Landing` (S5), `Scan` (S5), `Result` (S5, `toneClassMap` selects the `tone-calm` /
`tone-urgent` mixin's custom properties), `Signup` and `Protected` (S6), `Dashboard` (S7),
`Admin` (re-tokened in D1).

## Deviations from the design

1. **Reflow is CSS-only at 768 and 1280.** The design's live mocks switch layout in JavaScript
   at 480 and 1200 (`isMobile = width <= 480`, `isDesktop = width >= 1200`), which is how the
   design tool renders one component at three widths. The app reflows in `.module.scss` media
   queries on the three named breakpoints and never branches on width in a component
   (responsive contract).
2. **One CTA node on the result screen.** The mock renders two buttons (a header one under
   `isNotMobile`, a sticky one under `isMobile`). The app renders one and moves it with CSS
   (S5 F20). **Precondition:** the node sits first in the DOM (inside the header), so at 390,
   where the stylesheet fixes it to the bottom of the viewport, the first `Tab` from the top of
   the document lands on it before the search above it. One node, two placements means one width
   tabs it out of visual order whichever end it sits at; first was chosen so the primary action is
   reached first (S5 visual review, V8).
3. **Sort segments are 44px tall,** not the design's 36px inside a 44px track: every
   interactive element meets the tap-target floor on its own box.
4. **The "Largest breach" tile names the breach.** The design shows only the count (`1.96B`);
   the plan's product bar asks for the name, so the tile carries the title with the count as
   its support line. The name reads at `$text-300`, not the tile's `$text-500`: a name is not a
   number, and at 28px a long title needed six lines in a 768 tile and broke mid-word (S5 visual
   review, V2).
5. **Colours are sRGB hex,** not oklch (see Token translation). A later move to oklch is a
   one-line change per token; the source values are in the comments.
6. **Admin keeps its 720px page width** at 768+ rather than the design's 65ch frame, so the two
   variant cards can sit side by side with their inputs intact; prose inside is capped at the
   measure. The admin copy stays ours (`result_screen_tone`, "Admin token"), and the variant
   cards are **not tinted by tone**. That was written as "S5 introduces `toneClassMap` and the
   admin page adopts it then"; S5 came and went and the admin page did not (DD-12). It stands as
   a deviation, not a plan: the tint would say which variant is which on a page whose two cards
   are already labelled by their keys, and the tone lives in the variant's own config where an
   operator edits it.
7. **Message radius is `$radius-md` (12px)** where the design's StatusMessage used 10px, a
   value outside its own radii scale.
8. **Placeholder copy stays placeholder.** Plan prices, "4 seats left", the 3,120,000-leak count
   and the dashboard's lift numbers are the design's illustrations; S6 and S7 render live
   values.
9. **The landing lead names no count.** The design's "against 1,031 known breaches" is a live
   number the landing page does not have (the catalog is loaded by the scan moment, not before
   it), and a literal would go stale the day the record grows. The lead reads "against the public
   record of known data breaches" instead; the count is on the result screen, where it is live.
10. **The chip scroller fades at its right edge at 390.** The design's row simply clips; the
   fade is the cue that it scrolls, added after the visual pass found the fourth chip cut with no
   affordance (V4). Gone at md+, where the chips wrap.
11. **The password field's notices sit under the box, not inside it.** The design's mock draws
   "Checking against known leaks…" inside the field, which is empty in the mock; in the app the
   box holds the password being typed, so the checking, leaked and couldn't-check notices render
   beneath it in the same order the mock lists them.
12. **The Basic plan's second next step is ours.** The design shows the confirmation for Family
   only ("Add a family member · 4 seats left"); Basic gets "Turn on breach alerts" in the same
   slot, since a one-device plan has no seats to fill.
13. **The sign-up form is capped at 400px at 768+**, not the mock's 340px card, so the leaked
   warning and the email keep a longer line at the wider widths. Chosen at build time, not
   measured; the S6 visual pass is what confirms it. Single column at every width, as stated.
14. **The funnel series keep the design's tone accents against the dataviz validator.** The
   `dataviz` skill's palette check (2026-09-19) passes `#005256` / `#8b2000` on CVD separation
   (protan ΔE 11.7, tritan 24.5), normal-vision separation (21.4) and contrast, and fails them on
   the light-mode lightness band (L 0.40 / 0.42, the band starts higher) and the calm chroma floor
   (0.068). The colours stay: each series is an arm and each arm is a tone, so the bar wears the
   ink its result screen wears, and the legend and the per-bar labels carry identity beside the
   colour. A brighter pair would pass the band and stop naming the arms.

15. **Controls get a darker border than the design's token.** `$color-border` (#d0d5d9) is
   1.48:1 on white and 1.40:1 on the page; WCAG 2.2 SC 1.4.11 asks 3:1 of the boundary that
   identifies a control, and an input's border is its only boundary (BF52, found in D1's own
   review and carried until the audit fix pass). `$color-border-control` (#868f96, measured
   3.29:1 on `$color-surface` and 3.11:1 on `$color-bg`) is used by the input mixin, the filter
   chips, the plan cards and their radio ring, the password field's spinner track and the
   disabled button's edge. Separators and card edges keep the design's lighter value: a card is
   identified by its fill and its content, not by its outline.

## Decisions taken at translation (Shalev said "go ahead"; flagged in chat)

- Self-host the font (above).
- Row expansion joins S5 as case F21 rather than being dropped: the description field already
  exists on the model and the design gives it its only home on the screen.
- The design export is committed verbatim so a reader of the take-home can open the design
  without a claude.ai login.
