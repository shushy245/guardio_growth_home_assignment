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
| `Button` | primary · secondary · ghost; default · loading · disabled | D1 (mixins) · S5 | `button-primary` / `button-secondary` mixins in `_fields.scss`; ghost and the loading spinner arrive with S5 |
| `StickyCtaBar` | — | S5 | One CTA node; sticky at 390, inline in the header at 768+ by CSS only (F19, F20) |
| `SummaryTile` | loaded · skeleton | S5 | 2×2 at 390, one row of four at 768+ (flex-wrap, no grid) |
| `SearchField` | idle · focus | S5 | |
| `FilterChip` | idle · selected | S5 | 44px tall, single-select, selected chip clears on tap (F9) |
| `ToggleField` | off · on | S5 | Verified only |
| `SegmentedControl` | one selected | S5 | Sort: Newest · Most accounts · Name (F8). Segments 44px tall, not the design's 36 (deviation 3) |
| `ResultsLine` | with / without Clear | S5 | "Showing 20 of 1,031" (F15) |
| `BreachRow` | collapsed · expanded · skeleton · no-logo | S5 | Expanded reveals the description (F21, new) |
| `DataClassBadge` | plain · passwords | S5 | Passwords in the danger pair (F17) |
| `VerifiedMark` | — | S5 | |
| `LoadMoreButton` | idle · loading | S5 | F10 |
| `EmptyFilterState` | — | S5 | Dashed border, circle mark; distinct from the error state (F16) |
| `ErrorState` | with retry | S5 | Sunken fill, square danger mark (F4, F11) |
| `PlanCard` | idle · selected | S6 | F7 |
| `TextField` | idle · focus · error | D1 (mixin) · S6 | `input` mixin |
| `PasswordField` | idle · checking · leaked · unchecked | S6 | F3–F6 |
| `StatusMessage` | info · success · warning · error | D1 (mixins) | `message` + `message-success/warning/error` mixins. **`message-error` is defined and used by nothing** — a failed load renders as the neutral chip and a save failure shares `message-warning` with a lock conflict (BF51) |
| `Skeleton` | — | S5 | Shimmer with a reduced-motion static state |
| `ProgressIndicator` | — | S5 | The scan moment's bar (F3) |
| `HypothesisCard` · `FunnelChart` · `LiftCard` · `RecommendationBanner` | ship · keep-control · keep-running · error | S7 | F2–F4 |

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
   (S5 F20).
3. **Sort segments are 44px tall,** not the design's 36px inside a 44px track: every
   interactive element meets the tap-target floor on its own box.
4. **The "Largest breach" tile names the breach.** The design shows only the count (`1.96B`);
   the plan's product bar asks for the name, so the tile carries the title with the count as
   its support line.
5. **Colours are sRGB hex,** not oklch (see Token translation). A later move to oklch is a
   one-line change per token; the source values are in the comments.
6. **Admin keeps its 720px page width** at 768+ rather than the design's 65ch frame, so the two
   variant cards can sit side by side with their inputs intact; prose inside is capped at the
   measure. The admin copy stays ours (`result_screen_tone`, "Admin token"), and the variant
   cards are not yet tinted by tone: that needs `toneClassMap`, which S5 introduces, and the
   admin page adopts it then.
7. **Message radius is `$radius-md` (12px)** where the design's StatusMessage used 10px, a
   value outside its own radii scale.
8. **Placeholder copy stays placeholder.** Plan prices, "4 seats left", the 3,120,000-leak count
   and the dashboard's lift numbers are the design's illustrations; S6 and S7 render live
   values.
9. **The landing lead names no count.** The design's "against 1,031 known breaches" is a live
   number the landing page does not have (the catalog is loaded by the scan moment, not before
   it), and a literal would go stale the day the record grows. The lead reads "against the public
   record of known data breaches" instead; the count is on the result screen, where it is live.

## Decisions taken at translation (Shalev said "go ahead"; flagged in chat)

- Self-host the font (above).
- Row expansion joins S5 as case F21 rather than being dropped: the description field already
  exists on the model and the design gives it its only home on the screen.
- The design export is committed verbatim so a reader of the take-home can open the design
  without a claude.ai login.
