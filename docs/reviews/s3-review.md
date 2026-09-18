# S3 — feature-flags: review findings

Review of `git diff story/S3..HEAD` (14 commits, 79 files, +3754/-20), run at story close on
2026-09-18 as four independent agents on Opus (never a fork — see the `no-fable-for-code-reviews`
project memory):

1. **backend** — correctness + backend conventions (read `backend-conventions.md`,
   `lint-index.md`, `docs/python-conventions.md`; untooled-repo override applied, since ESLint
   does not run on Python and the review is therefore the enforcement)
2. **frontend** — frontend + testing conventions + frontend correctness (read
   `frontend-conventions.md`, `testing-conventions.md`, `lint-index.md`)
3. **conventions** — named principles + comment/doc accuracy + git history (read
   `intellectual-references.md`, `lint-index.md`)
4. **visual** — the independent `visual-reviewer` agent, pass A + pass B (accessibility), over
   `http://localhost:5173/admin` and `/`, given only the changed paths and the URL

Each agent's report is pasted below **verbatim** as it arrives, before any triage, so that a lost
session costs the triage and not the review. Triage decisions follow in `docs/plan.md` under
"S3 — review triage".

## Status

- [ ] backend
- [ ] frontend
- [ ] conventions
- [x] visual — arrived, pasted verbatim below

**If this file still shows unchecked boxes and no session is running, the review did not finish.**
Re-run it from the tag: the diff is `story/S3..HEAD` and nothing about it is lost. An unfinished
review is not a clean one.

---

## 4. visual — `visual-reviewer` agent, pass A + pass B (arrived first)

## Visual review — pass A + pass B

**Step 0 (change is live):** confirmed without a rebuild. `/admin` DOM carries hashed `Admin.module.scss` classes (`_page_1hx3n_1`, `_flag_1hx3n_46`, `_variants_1hx3n_120`, `_save_1hx3n_85`) and the flag console content; `/` carries `breach-scan.visitorId` in `localStorage` (from `frontend/src/storage/visitor-id.ts`). I did **not** run `docker compose up -d --build`, so no sibling containers were recreated and no backend state was disturbed.

Screens reviewed: `http://localhost:5173/admin` and `http://localhost:5173/` at 390x844x3 mobile/touch · 768x1024x2 · 1280x800x1. All three viewports ran on both screens; none skipped.

---

## PASS A

### MEASURED

**Horizontal overflow — passes everywhere.** `/admin`: `scrollWidth` 390/768/1280 against `visualViewport.width` 390/768/1280 → FAIL false at all three; `offenders` array empty at all three. `/` : same, 390/768/1280, no overflow.

**Tap targets < 44x44 — one, at every viewport.** `/admin` `input._checkbox_1hx3n_80` measures **20x20 at 390, 20x20 at 768, 20x20 at 1280** (served CSS: `._checkbox_1hx3n_80{width:20px;height:20px}`). Its wrapping `._toggle_` row is `min-height:44px`, but the hit area of the input itself is 20x20. Every other control passes: all nine `._input_` fields are 44px tall (`min-height:44px`), the Save button is 48px tall (`min-height:48px`). `/` has zero interactive elements, so nothing to measure.

**Body text < 16px — four blocks, at every viewport.** All are **14px** on `/admin`:
- "Changes take effect immediately for visitors arriving..." (`._note_`) — 14px at 390, 768, 1280
- "Tone of the result screen: calm framing vs urgent framing..." (`._note_`) — 14px at 390, 768, 1280
- "Running — assign new visitors to a variant" (`._toggle_`) — 14px at 390, 768, 1280
- "Traffic split: 100% assigned." (`._message_`) — 14px at 390, 768, 1280

Field labels ("Admin token", "Headline", "Share of traffic (%)") are also 14px (`._field_{font-size:14px}`) but fall below the script's 20-char text-node threshold, so they are not in the returned array — reporting them for completeness. `/` body text is 16px (UA default); its only content is a 32px `h1`.

**Line length outside 45-75 characters — at every viewport.**
- 390: "Tone of the result screen..." **43 chars**; "Running — assign new visitors to a variant" **38 chars**; "Traffic split: 100% assigned." **43 chars**. ("Changes take effect..." is 48 — inside the band.)
- 768: "Changes take effect..." **99 chars**; "Tone of the result screen..." **94**; "Traffic split..." **94**; "Running —..." **38**.
- 1280: "Changes take effect..." **101 chars**; "Tone of the result screen..." **96**; "Traffic split..." **96**; "Running —..." **38**.

**Variant card geometry at 390.** `._variants_` computes `flex-direction: row` at 390 (it carries the `Row` primitive class `_row_17g6y_3`, and the served CSS has **no** base rule for `._variants_` — its only rule sits inside `@media (width>=768px)`). Result at 390: two cards **154px wide each**, their inputs **128px wide**. Four of the eight variant inputs have `scrollWidth > clientWidth` — content clipped at rest: `"Known breaches"`, `"Here's the public re..."`, `"You're exposed!"`, `"17.7B accounts have ..."`. The "Share of traffic (%)" label wraps to two lines (33px tall vs 17px for the single-line labels) at 390.

**Media query form.** The one media query in the served bundle is `@media (width>=768px)` — min-width form, mobile-first. It sets `._page_{max-width:720px;padding:32px 24px}`, `._variants_{flex-direction:row;gap:16px}`, `._variant_{flex:1 1 0}`. No `max-width` query anywhere. No `100vh` in the served CSS.

**Page width at 1280.** `._page_` measures **768px** on a 1280px viewport (720px max-width + 48px padding), centred.

**Console — read, then reloaded with `ignoreCache` and read again.**
- `/admin`, both loads, identical: `[verbose] [DOM] Password field is not contained in a form` and `[issue] A form field element should have an id or name attribute (count: 9)`. **No errors, no warnings.**
- `/`, both loads: **no console messages at all.**

### OBSERVED

- **At 390 the two variant cards sit side by side, not stacked** — the same two-column arrangement as 768 and 1280, just narrower. The 768 media query changes padding, max-width and gap, but not the axis. At 390 the inputs render 128px wide with their values visibly cut mid-word ("Known breaches" shows as `Known breache`, "Here's the public record of data breaches." as `Here's the publi`, "17.7B accounts have leaked..." as `17.7B accounts `). The full value is only reachable by focusing and scrolling inside the field.
- **`/` is a single `h1` "Breach Scan"** on an otherwise empty page, rendered in **Times serif, 32px, black, with the 8px UA body margin** — the browser default stylesheet. `/admin` renders in `system-ui, sans-serif` from `._page_`. The two screens do not share typography; no reset or global font is applied at the document level, so `/` is unstyled output at all three viewports (identical at 390, 768 and 1280 apart from the h1's line box).
- **`/` has `data-testid="LandingTestIds.Page"`** in the DOM — the literal string `LandingTestIds.Page`, not a resolved value.
- Colours on `/admin` render as the tokens in the bundle: page text `#14202e`, secondary note text `#4a5a6a` on `#f7f9fc` card over white, Save `#16508f` with white text, input borders `#b6c2cf`. Save's disabled rule is `background:#93a3b5`; I did not reach the disabled state, so I did not see it rendered.
- No broken images (there are none), no z-index stacking artefacts, no font-loading flash observed — the bundle loads no web fonts.
- **The second variant's name changed under me mid-session**: the 390/768/1280 screenshots show `urgent`, and after the Lighthouse navigation the same `h3` reads `alarm` (`<h3 class="_variantName_1hx3n_67">alarm</h3>`). The flag's description text still reads "calm framing vs **urgent** framing of the same data." I performed no save and typed nothing. This is served data, not layout.

### UNCERTAIN (pass A)

- Whether the 390 side-by-side variant layout is the served CSS's intent or an artefact of `._variants_` having no base rule — I can report only that the rule exists solely inside the 768 query and that the `Row` primitive supplies `row` below it.
- Why the variant name flipped from `urgent` to `alarm` between page loads. I could not determine it from the browser and did not touch the backend.
- I did not exercise any interaction state: no save, no validation error, no conflict/saved/failed message, no disabled Save, no loading or failed-load state, no invalid admin token. The `._message_`/`._warning_` rules exist in the bundle but nothing rendered them during this review.
- iOS Safari behaviour (safe-area insets, `100dvh`, momentum scroll) — Chrome device emulation does not establish it.

---

## PASS B — accessibility

### MEASURED

**`lighthouse_audit`, navigation mode, mobile.**

`/admin` — **Accessibility 84**, 35 passed / 6 failed. Accessibility failures, in the audit's own words:
1. **`label` — "Form elements do not have associated labels."** Node: `div._column_17g6y_8 > div._column_17g6y_8 > div._row_17g6y_3 > input._checkbox_1hx3n_80`. Explanation: *"Element does not have an implicit (wrapped) `<label>`; Element does not have an explicit `<label>`; aria-label attribute does not exist or is empty; aria-labelledby attribute..."*
2. **`landmark-one-main` — "Document does not have a main landmark."** Node: `html`. Explanation: *"Document does not have a main landmark."*

`/` — **Accessibility 94**, 33 passed / 4 failed. One accessibility failure: **`landmark-one-main` — "Document does not have a main landmark."** on `html`.

**Contrast.** `color-contrast` scores **1 (pass)** on both `/admin` and `/`. No contrast failures reported by the audit.

**Other audits, for the record:** `heading-order` pass, `html-has-lang` pass, `document-title` pass, `button-name` pass, `target-size` **pass (score 1)** — note this contradicts nothing in pass A: Lighthouse's `target-size` applies the WCAG 2.2 24x24 threshold with spacing exceptions, while the pass A number is the 44x44 house threshold, and the checkbox is 20x20 against both. `image-alt`, `link-name`, `aria-allowed-attr`, `form-field-multiple-labels`, `tabindex`, `bypass` all **notApplicable** (no images, links, ARIA attributes, or positive tabindex on either page).

**Keyboard traversal (`/admin`, 1280).** Focus reset to `body`, then 14 `Tab` presses, focus recorded via a capturing `focusin` listener. Order:

| # | element | position |
|---|---|---|
| 1 | `INPUT[password]` "Admin token" `._input_` | top 157, left 280 |
| 2 | `INPUT[checkbox]` (no accessible name) `._checkbox_` | top 328, left 301 |
| 3 | `INPUT[number]` "Share of traffic (%)" | top 435, left 310 (calm column) |
| 4 | `INPUT[text]` "Headline" | top 508, left 310 |
| 5 | `INPUT[text]` "Subheadline" | top 580, left 310 |
| 6 | `INPUT[text]` "Button label" | top 653, left 310 |
| 7 | `INPUT[number]` "Share of traffic (%)" | top 435, left 661 (urgent column) |
| 8 | `INPUT[text]` "Headline" | top 508, left 661 |
| 9 | `INPUT[text]` "Subheadline" | top 580, left 661 |
| 10 | `INPUT[text]` "Button label" | top 653, left 661 |
| 11 | `BUTTON` "Save" `._save_` | top 752, left 297 |
| 12 | wraps to "Admin token" | — |
| 13 | "Running..." checkbox | — |

- **Unreachable interactive control: none.** The DOM holds 11 focusable elements; focus reached all 11. No `div`/`span` with a click handler and no `tabindex` exists on the page.
- **Focus trap: none.** Focus advanced past every element and cycled from Save back to the first control at press 12.
- **Tab order vs visual order: matches.** The traversal runs left column top-to-bottom (left 310) then right column top-to-bottom (left 661) then Save — which is the DOM order and the reading order of two side-by-side cards. Same column-then-column order applies at 390, where the cards are also side by side.
- `/`: **zero focusable elements**, so no traversal to report.

**Visible focus indicator — present on all 11 controls, and it is the UA default.** Unfocused computed `outline` is `rgb(0,0,0) none 3px` (i.e. `none`) on every control; focused it becomes **`rgb(0, 95, 204) auto 1px`** — Chrome's default focus ring. `box-shadow` stays `none` and `border` is unchanged on focus for every control. The checkbox additionally carries `outline-offset: 2px` when focused; the other ten are `0px`. **No `outline: none` anywhere** in the served CSS, and nothing overrides or suppresses the ring. Every control's appearance therefore does change on focus.

**Heading order (`/admin`, document order):**
- `h1` "Feature flags"
- `h2` "result_screen_tone"
- `h3` "calm"
- `h3` "alarm"

Exactly one `h1`; no level skipped. `/` : `h1` "Breach Scan", exactly one, no skip.

**Accessible names on controls (`/admin`, all 11):**

| control | accessible name | source |
|---|---|---|
| `input[password]` | "Admin token" | **wrapping `<label>`** |
| `input[checkbox]` | **none** | — no wrapping label, no `for`, no `aria-label`, no `aria-labelledby` |
| `input[number]` x2 | "Share of traffic (%)" | **wrapping `<label>`** |
| `input[text]` x2 | "Headline" | **wrapping `<label>`** |
| `input[text]` x2 | "Subheadline" | **wrapping `<label>`** |
| `input[text]` x2 | "Button label" | **wrapping `<label>`** |
| `button` | "Save" | text content |

Two findings to name explicitly: **the checkbox has no accessible name at all** (this is the same element Lighthouse's `label` audit flags, and the same 20x20 element from pass A — the visible text "Running — assign new visitors to a variant" sits in a sibling node, not in a label associated with the input). **No control is named only by its `placeholder`** — no control on either page carries a `placeholder` attribute at all.

**Landmarks.** `document.querySelectorAll('main,nav,header,footer,aside,[role]')` returns **zero elements** on `/admin` and on `/`. No landmark of any kind, and no explicit `role` attribute anywhere.

**`prefers-reduced-motion` — determined from the source, as the `emulate` tool has no reduced-motion parameter.** I fetched the served stylesheet `http://localhost:5173/assets/index-CgNIEGzh.css` (1688 bytes, the only stylesheet on either page) and read it in full:
- **0 occurrences of `@media (prefers-reduced-motion`**.
- **0 `transition` declarations and 0 `animation` declarations** — the string does not appear.
- `document.getAnimations()` on `/admin` returns **`[]`** — no running animations, so no `iteration-count` to report.

There is therefore **no running animation on a page whose CSS contains no reduced-motion query** — the pattern that would be a violation does not occur here, because there is no animation at all.

### OBSERVED (pass B)

- The checkbox's visible text "Running — assign new visitors to a variant" is rendered adjacent to the 20x20 box inside a 44px-tall row. Clicking that text does not focus or toggle the checkbox — there is no label association to carry the click — though I confirmed this from the DOM structure rather than by clicking.
- The focus ring rendered is Chrome's own blue `auto` ring; nothing in the page's own styling contributes to it, so its appearance is whatever the browser supplies and will differ across browsers.
- The page's whole content sits in nested `div`s from the layout primitives (`_column_`, `_row_`, `_fullColumn_`) with no sectioning element, which is what the zero-landmark measurement reflects.

### UNCERTAIN (pass B)

- **Reduced motion:** I established what the served stylesheet does and that nothing is animating — **not** what the browser does under the real `prefers-reduced-motion` media feature, which I could not emulate.
- **Contrast beyond the audit's scope:** Lighthouse checks rendered text against its computed background. It did not evaluate the disabled Save state (`#93a3b5` background, white text) because that state never rendered, nor the `._warning_` colour `#8a4b00` or `._message_`, which never appeared. Those three colour pairs are **unverified**.
- **Screen-reader announcement** of any control — I read accessible names from the DOM and from Lighthouse, not from an actual assistive technology.
- Keyboard **activation** (Enter/Space actually toggling the checkbox or submitting Save) was not tested; I tested reachability and order only.
- I ran the traversal at 1280 only. The DOM is identical at 390 (one tree, CSS-only reflow), so the order carries over, but I did not re-press Tab at 390 or 768 to confirm it empirically.
- Lighthouse's ten **manual** accessibility audits (`focusable-controls`, `logical-tab-order`, `visual-order-follows-dom`, `focus-traps`, `managed-focus`, `use-landmarks`, `offscreen-content-hidden`, `custom-controls-labels`, `custom-controls-roles`, `interactive-element-affordance`) are, by definition, not scored by the tool. My traversal above covers tab order, traps and reachability; the rest are unchecked.

---

## What I could not check, and why

- **Every interaction and data state on `/admin`**: saving, a save conflict (409), a failed save, a rejected admin token, the loading and failed-load states, a disabled Save, and the traffic-split warning. The review renders the default loaded state only; those states are in the CSS but never appeared, so nothing about them is backed by a capture.
- **The rest of the funnel.** `/` renders a bare `h1` — there is no funnel UI on it to review, and no other route was given to me.
- **`/admin` mobile Lighthouse ran at the tool's own emulation**, not at my 390x844x3 emulation; the reported audit numbers are the tool's, the pass A numbers are mine, and they should not be read as measurements of the same viewport.
- **Real-device behaviour** on iOS Safari.

