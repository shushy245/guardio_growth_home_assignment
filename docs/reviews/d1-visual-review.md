# D1 visual review — verbatim

One pass (A + B) by the independent `visual-reviewer` agent against the running compose stack,
after `f12c1bc` translated the Claude Design handoff into `frontend/src/styles/tokens.scss` and
re-tokened `/admin` and the landing route. The agent was given the eight changed frontend paths
and the two URLs and nothing else — no commit message, no story, no description of what the
screens were meant to look like.

Recorded here because D1's exit criteria are three *measurements*, and this is the evidence
behind them. Verbatim below; the triage follows the report.

## The three carried S3 findings — all answered by a token, all confirmed

| Carried finding | Token that answers it | Measured at 390 / 768 / 1280 |
|---|---|---|
| **BF36** disabled Save at 2.58:1 | `$color-disabled-fill` / `$color-disabled-text` in the `button-primary` `:disabled` rule | Lighthouse `color-contrast` **passes with 0 items** on `/admin` with Save rendered disabled |
| **BF42** 14px body text | `$text-100` = 16px, the floor; used by the `field` / `note` / `message` mixins | `bodyTextUnder16` **empty at all three viewports**, both screens |
| 96–101 character measure at 768/1280 | `$prose-measure: 65ch` on every `p` in `global.scss` | **nothing over 75ch at any viewport**; the finding does not reproduce |

`/admin` and `/` both score **Accessibility 100** in Lighthouse, 0 accessibility audits failed.

## Triage — 4 observations, 0 blockers, 0 code fixes

| # | Observation | Class | Disposition |
|---|---|---|---|
| DV1 | `input[type=checkbox]` measures 24×24, under the 44px floor, at all three viewports | precondition | **Not a defect.** The wrapping `<label>` is 686×52 (`min-height: $tap-target` at `FlagEditor.module.scss:30–31`) and is the clickable region; the script measures the input box, which is `accent-color`-painted decoration inside it. Recorded so the next reviewer does not re-file it. |
| DV2 | Input values clip mid-word with no ellipsis ("…data breache") at all three viewports | not a defect | An `<input>` clipping its own overlong value is native behaviour, not layout overflow — the overflow check is correctly clean. The value is fully reachable by caret. |
| DV3 | At 768/1280 the status `<p>` and the Save button do not share a right edge — the global `p { max-width: 65ch }` caps the message, the button is uncapped | nit | **Recorded, not fixed.** The 65ch cap is the token that answers the measure finding; narrowing Save to match would trade a measured criterion for an alignment preference on a page the plan calls barely designed. Revisit if the admin page is ever designed properly. |
| DV4 | Console `[issue] A form field element should have an id or name attribute (count: 9)` on `/admin` | pre-existing | Predates D1 (no `.tsx` changed in `f12c1bc`). Every control has an accessible name via a wrapping `<label>` or resolving `aria-labelledby`, and Lighthouse `label` passes with 0 items — so this is a devtools hygiene note, not an accessibility failure. |

**Unmeasured, stated as such:** every authenticated `/admin` state (saved / conflict / error
messages, the enabled Save button) — the reviewer had no `ADMIN_TOKEN` and did not attempt one, so
the `.saved` / `.unsaved` / `.warning` tone pairs are unverified as rendered. Also unmeasured: the
real `prefers-reduced-motion` media feature (no tool parameter; answered from source — no CSS
animation exists on either screen and the one JS motion is gated) and iOS Safari `100dvh`.

---

## The report, verbatim

VISUAL REVIEW — pass A + pass B. Two screens: **/admin** and **/** (landing), each at 390×844×3 (mobile,touch) · 768×1024×2 · 1280×800×1. No viewport skipped. Screenshot mode `fullPage: true` at all three on both screens.

## Environment — nothing left changed

- **No rebuild was needed or performed.** The change was confirmed live on first load, so `docker compose` was never touched and no sibling container restarted. Anyone holding backend state still has it.
- During the pass-B traversal I set `tabindex="-1"` on `<body>` and attached a `focusin` listener on /admin. **Undone immediately after the traversal** by an `ignoreCache` reload; verified after: `body[tabindex]` is `null`, `window.__focusLog` and `window.__baseline` are `undefined`.
- No throttling, no container stopped, no `localStorage` writes. Lighthouse reports went to the session scratchpad only. Nothing written to the repo.

## Proof the running app contains the change

- **/admin**: `body` computes `font-family: "Source Sans 3 Variable", …` and `background-color: rgb(246, 249, 251)` (= `$color-bg` `#f6f9fb`) — both introduced by `frontend/src/styles/global.scss` + `tokens.scss`.
- **/ (landing)**: `main` computes `max-width: 1120px` (= `$content-max`) and `padding: 64px` (= `$gutter-lg`) at 1280; body font as above.
- Caveat worth knowing: the browser tab already open at `/` was serving a **pre-change document** (`font-family: system-ui, sans-serif`). Every landing number below was taken only after an `ignoreCache` reload.

---

# MEASURED

All numbers below came from the script in `~/.claude/docs/visual-review.md`, run verbatim at each viewport.

### /admin — horizontal overflow
`scrollWidth` = `visualViewport.width` at all three: 390/390, 768/768, 1280/1280. `FAIL: false`, `offenders: []` at every viewport.

### /admin — tap targets < 44×44
One, at **all three viewports**: `input[type=checkbox]._checkbox_uh64f_32` measures **24×24**. Its wrapping `<label>` measures **686×52** at 1280 (`min-height: $tap-target` + `padding: $sp-1 0` at `FlagEditor.module.scss:30–31`), so the clickable region is the label; the script measures the input box itself.

### /admin — body text < 16px
**None**, at any viewport. Empty array at 390, 768 and 1280.

### /admin — line length outside 45–75 characters
All offenders are **under** the 45 floor; **nothing exceeds 75 at any viewport**.
- At 390, four blocks, all 16px: `"Tone of the result screen: cal…"` 44 ch · `"Running — assign new visitors…"` 38 ch · `"Traffic split: 100% assigned."` 44 ch · `"Paste the admin token above be…"` 44 ch.
- At 768 and 1280, one block: `"Running — assign new visitors…"` 38 ch @ 16px.
- The S3 carry-over of 96–101 characters at 768 and 1280 **does not reproduce** — no block measures over 75 at any viewport.

### / (landing) — all four checks
Overflow 390/390, 768/768, 1280/1280, `offenders: []`. `tapTargetsUnder44: []`, `bodyTextUnder16: []`, `lineLengthOutside45to75: []` — empty at all three. The page holds 0 interactive controls and one `h1` (computed 32px); there is no running-text block for the measure to apply to.

### Console — read, `ignoreCache` reload, read again (once per screen)
- **/admin**: identical both times, 2 messages, **no errors and no app-code warnings** — `[verbose] [DOM] Password field is not contained in a form`; `[issue] A form field element should have an id or name attribute (count: 9)`.
- **/**: **no console messages at all**, both times.

### Step 5 — source facts from the changed files

- **No `max-width` media query anywhere.** All four `@media` blocks are `min-width` over breakpoint tokens: `frontend/src/components/FlagEditor.module.scss:105`, `frontend/src/pages/Landing.module.scss:15` and `:21`, `frontend/src/pages/Admin.module.scss:54`. No breakpoint literal — every query names `tokens.$breakpoint-md` or `$breakpoint-lg`.
- **No width branch in the components.** `matchMedia` appears 4× in `frontend/src/`, none a width read: `ui/scroll.ts:6` (reduced motion), `testkit/setup.ts:21`, `testkit/media-query.ts:1`, `components/FlagEditor.driver.tsx:194` — the last three are test scaffolding. No `isMobile`, no `innerWidth`, no `useMediaQuery`.
- **One hardcoded px width on a container, not a token** — `frontend/src/pages/Admin.module.scss:56`: `max-width: 720px;` inside the md query. 720 is not `$content-max` (1120), not a `$breakpoint-*`, not a `$sp-*`. The file's own comment at lines 4–8 records it as a deliberate deviation.
- **`100dvh`, not `100vh`** — `frontend/src/pages/Landing.module.scss:9`: `min-height: 100dvh;`. I searched every `.scss` under `frontend/src`; there is **no `100vh` anywhere**.

### Pass B — Lighthouse (navigation, desktop)

- **/admin**: Accessibility **100**, Best Practices 100, SEO 82, Agentic Browsing 67. 46 audits passed, 3 failed. **Zero accessibility audits failed.** `color-contrast` score 1 / 0 items · `label` 1 / 0 items · `target-size` 1 · `heading-order` 1 · `landmark-one-main` 1 · `html-has-lang` 1 · `document-title` 1 · `button-name` 1 · `aria-allowed-attr` 1. The 3 failures are all outside accessibility: `meta-description` (SEO), `robots-txt` (SEO), `llms-txt` (agentic browsing).
- **/**: Accessibility **100**, Best Practices 100, SEO 82, Agentic 67; the same 3 non-accessibility failures. `color-contrast`, `heading-order`, `landmark-one-main`, `html-has-lang`, `document-title` all score 1.
- On the S3-carried 2.58:1 disabled-Save finding: `color-contrast` passed with **0 items** on /admin with the Save button rendered in its disabled state.

### Pass B — keyboard traversal, run at **1280** on /admin

14 `Tab` presses from `<body>`. Order reached: **1** Admin token (`input[type=password]`) → **2** the "Running" checkbox → **3–6** calm card: Share of traffic (%), Headline, Subheadline, Button label → **7–10** urgent card: Share of traffic (%), Headline, Subheadline, Button label → **11** wraps to Admin token, **12** checkbox, **13** calm Share. Focus **cycles; no trap**.
- Tab order **follows the visual order**: token field at top, then the toggle, then the left card top-to-bottom, then the right card top-to-bottom.
- **One of the 11 controls is never reached: `button._save_uh64f_80` ("Save").** It is `disabled` in the page's initial state (no admin token entered), and a disabled button is not in the tab order. Every other control is reached.
- **Not re-run at 390, and here is why:** grepping `frontend/src/**/*.scss` finds no `order:`, no `row-reverse`/`column-reverse`, no `grid-area`/`grid-row`/`grid-column`, and no `position: absolute` on a flow child. One DOM tree, no reordering — so the order at 390 is the order measured at 1280.

### Pass B — focus indicator
Unfocused, every control computes `outline-style: none`. Focused, every control computes `outline: rgb(0, 123, 171) solid 3px` (= `$color-focus-ring` `#007bab`, from `global.scss:44–47`, with `outline-offset: 2px`). **All 10 reachable controls change appearance on focus.** No `outline: none` left without a replacement anywhere.

### Pass B — heading order
- **/admin**: `h1 "Feature flags"` → `h2 "result_screen_tone"` → `h3 "calm"` → `h3 "urgent"`. Exactly one `h1`, no level skipped.
- **/**: `h1 "Breach Scan"` only. Exactly one `h1`, no skip.

### Pass B — accessible names (/admin, all 11 controls)
Every control has one; **none is placeholder-only, none is missing**.
- `input[type=password]` → "Admin token", from a **wrapping `<label>`**.
- `input[type=checkbox]` → "Running — assign new visitors to a variant", **wrapping `<label>`**.
- The 8 variant inputs → **`aria-labelledby` with two ids each, both resolving**, e.g. `flag-result_screen_tone-variant-calm-name` ("calm") + `…-calm-weight-label` ("Share of traffic (%)") → **"calm Share of traffic (%)"**. Every referenced id exists in the document, so each of the four repeated field labels is disambiguated by its variant.
- `button` → "Save", from **text content**.
- Landmarks: /admin has a `<main>` and a `<p role="status">`; / has a `<main>`. `/` has 0 controls.

### Pass B — prefers-reduced-motion (determined from source; see UNCERTAIN)
- **No `@media (prefers-reduced-motion` block exists in any SCSS** under `frontend/src`.
- There is also **no `animation`, no `transition` and no `@keyframes` in any SCSS**, and `document.getAnimations()` returned `[]` on /admin and `0` on `/`. **No animation is running on either screen**, so there is nothing for such a block to gate.
- The app's only motion is JS: `frontend/src/ui/scroll.ts:11` calls `scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })`, where line 6 reads `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. That motion **is** gated on the preference — in JS, not CSS.

---

# OBSERVED

- **/admin reorganizes rather than shrinking.** At 390 the two variant cards (`calm`, `urgent`) stack in one column; at 768 and 1280 they sit side by side, each taking half the card. Source agrees: `FlagEditor.module.scss:48–51` base `flex-direction: column` → `:105–113` `row` + `flex: 1 1 0`. The 390 and 1280 layouts are not the same layout.
- At 1280 the /admin column renders 720px wide and centred (x ≈ 280–1000) in the 1280 viewport.
- **Text truncated inside inputs, no ellipsis, at all three viewports.** The calm "Subheadline" field shows `Here's the public record of data breache` cut mid-word at the field's right edge; the urgent one shows `17.7B accounts have leaked. Yours coul` at 390 and 768, `…Yours could` at 1280. This is an `<input>` clipping its own value — not layout overflow, and the overflow check is correctly clean.
- **The status message and the Save button do not share a right edge** at 768 and 1280. At 1280 the message "Paste the admin token above before saving." ends at x ≈ 846 while Save ends at x ≈ 982. The message is a `<p>`, so the global `p { max-width: 65ch }` at `global.scss:31` caps it while the button is uncapped; the two stacked blocks end at different widths.
- The Save button renders as a light grey fill with dark grey text and a 1px border — reads as disabled, matching `:disabled` at `_fields.scss:80–85`. No admin token was entered.
- The checkbox renders as a dark-teal filled box with a white check (`accent-color`), vertically centred against its label text.
- No broken images (neither page loads any), no font-loading flash seen across reloads at any viewport, no z-index stacking artefacts.
- Landing at all three viewports is `<h1>Breach Scan</h1>` alone on the page background, top-left inside the gutter; the gutter grows 16 → 32 → 64px. There is nothing else on that screen to reflow.

---

# UNCERTAIN

- **Every /admin state I measured is the initial, unauthenticated one.** A save needs a valid `ADMIN_TOKEN`, which I did not have and did not attempt. So the saved / conflict / error message states are unmeasured, and the `.saved` / `.unsaved` / `.warning` tone classes at `FlagEditor.module.scss:92–103` are unverified as rendered. Lighthouse's passing `color-contrast` covers only text that actually rendered — the disabled-Save pair it tested is the S3-flagged one, but the success and error message pairs were never on screen.
- **The Save button is unreachable by keyboard only because it is disabled.** Whether it enters the tab order and takes the focus ring once enabled is untested, same cause.
- **Reduced motion**: I established what the stylesheet and the source do, **not what the browser does under the real media feature**. `emulate` has no reduced-motion parameter, so the JS branch at `ui/scroll.ts:11` was never exercised under `reduce` — and the smooth-scroll path never fired at all, since it triggers on a save response.
- **Line length**: the sub-45-character blocks reported are short single sentences (a 38-character toggle label, a 29-character "Traffic split" line). The 45–75 band is a measure for running prose; whether it is the right threshold for a one-line label is not something the measurement answers, and I do not judge it.
- `min-height: 100dvh` at `Landing.module.scss:9` was measured in desktop Chrome under CDP device emulation, **not iOS Safari** — the collapsing-URL-bar behaviour it exists for is not proven here.
- `emulate` does not change `navigator.userAgent`, so all three viewports ran under the desktop Mac UA string.
- The `[issue] A form field element should have an id or name attribute (count: 9)` console item: I did not determine which 9 fields, beyond noting that all 11 controls report no `id` and are named by wrapping labels or `aria-labelledby`.

## What I could not check, and why

1. All authenticated /admin states (saved, conflict, error) and the enabled Save button — no `ADMIN_TOKEN`.
2. The real `prefers-reduced-motion` media feature — the tool has no parameter for it; answered from source instead.
3. iOS Safari `100dvh` / safe-area behaviour — needs a real device.
4. Keyboard traversal at 390 — deliberately not run, with the grep evidence above showing the DOM order is unchanged between the two widths.

---

# Confirmation pass — after the code-review fixes (`d916968`)

Pass A only, on the rebuilt bundle `index-Do51A4uQ.css`, same two URLs and three viewports. Run
because wiring the tone seam changed what the CSS says a button's fill *is*, and "it resolves to
the same colour through the fallback" is a claim that needed a measurement rather than an argument.

**The seam resolves as intended, measured at all three viewports.** The served stylesheet carries
`background:var(--tone-accent-strong,#003b3e)`; with no ancestor setting a tone class, the Save
button computes:

| state | background | colour | contrast |
|---|---|---|---|
| disabled (what renders on load, no token pasted) | `rgb(222,226,229)` `#dee2e5` | `rgb(62,67,71)` `#3e4347` | **7.8:1** |
| enabled (attribute removed, restored in the same call) | `rgb(0,59,62)` `#003b3e` | `rgb(252,252,252)` `#fcfcfc` | **12.2:1** |

Identical at 390, 768 and 1280 — the pre-fix values, unchanged. Every other measurement matches the
first pass: no overflow at any viewport, no text under 16px, nothing over 75ch, console clean on
both screens across an `ignoreCache` reload, `/admin` still reflows one column → two at 768.

**The precondition this confirmation does *not* cover, stated plainly:** `--tone-accent-strong` was
never observed being *re-pointed*. Neither screen sets a tone class, so what this pass proves is
that the fallback works — not that a `tone-urgent` ancestor produces the urgent colour. That is
S5's to prove, and it is recorded as the precondition on the D1 triage's finding 1. Also unrendered
anywhere reachable: `button-secondary` and the three `message-*` tones (BF51).
