# S3 review fixes — visual review, verbatim

Four passes by the independent `visual-reviewer` agent against the running compose stack while the
23 review fixes were being worked. The agent was given changed file paths and a URL and nothing
else — no commit messages, no story, no description of what the screens were meant to look like.

Recorded here because the measurements are the evidence behind every "responsive" and "accessible"
claim in S3's close, and because a later session would otherwise re-derive them. The findings are
verbatim; what was done about each is in `docs/plan.md` → "S3 — review fixes: execution order" and
in `git log`.

Sequence:

| pass | scope | outcome |
|---|---|---|
| 1 | `/admin`, pass A + pass B, after Phase 5 | 2 defects found, both fixed |
| 2 | `/` and `/admin` save-result states — the surfaces pass 1 could not reach | 4 defects found, all fixed; both pass-1 fixes confirmed at runtime |
| 3 | confirmation on the rebuilt app | pass-2 fixes confirmed; 1 regression found (the body reset) |
| 4 | narrow re-check of the landing box | regression confirmed fixed |

Three findings are **not** fixed here and are carried to D1 as exit criteria: 14px body text, the
2.58:1 disabled Save, and the 96–101 character measure at 768/1280. They are presentation on a
deliberately barely-designed page, and the design tokens land at D1 — fixing them now means fixing
them twice.

---

## Pass 1 — `/admin`, pass A + pass B

**Step 0 — change confirmed live, no rebuild performed.** The served DOM contains hashed CSS-module
classes `_variants_`, `_toggle_`, `_checkbox_1w42a_32`, `_message_1w42a_94`; the test ids
`AdminTestIds.Flag.result_screen_tone.{Enabled,Save,SaveMessage}` and the eight
`…Variant.{calm,urgent}.{weight,headline,subheadline,ctaLabel}` ids; a `<main>` landmark; and
`role="status"` on the save message. The served bundle `/assets/index-D0AFDqlk.js` contains
`e.scrollIntoView({block:"nearest",behavior:"smooth"})`, i.e. `frontend/src/ui/scroll.ts`. The build
under review is the one on disk.

All three viewports ran. Console read twice (initial + hard reload).

### PASS A — MEASURED

**Horizontal overflow — clean at all three.** `scrollWidth === visualViewport.width` at 390 (390/390),
768 (768/768) and 1280 (1280/1280). `offenders` array empty at every viewport.

**Tap targets under 44×44** — one element, identical at all three viewports:
- `input[type=checkbox]` (`…result_screen_tone.Enabled`) is **24×24 at 390, 768 and 1280**.
- Its wrapping `<label>` measures **308×52 at 390** and **686×52 at 1280** — the hit area a pointer
  gets is the label, not the box.

**Everything else at 44+**: all nine text/number/password inputs are 44px tall at 390 (342×44 for the
admin token, 282×44 for the eight variant fields). Save is 308×48 at 390, 686×48 at 1280.

**Body text under 16px — five blocks, 14px, at every viewport:** the intro note, the flag
description, "Running — assign new visitors to a variant", "Traffic split: 100% assigned." and
"Paste the admin token above before saving."

**Line length outside 45–75 characters:**
- **390**: flag description 43 · checkbox label 37 · traffic split 43 · token hint 43. (Intro note 48 — inside the band.)
- **768**: intro note **99** · description **94** · split **94** · hint **94** · checkbox label 38.
- **1280**: intro note **101** · description **96** · split **96** · hint **96** · checkbox label 38.

**Page gutter at 390**: `<main>` left edge 8px, right gutter 8px, main width 374 of 390.
**Content width cap**: `<main>` is 768px wide at 1280 (left offset 256px).

**Console — read on first load and again after a hard reload.** No errors, no warnings, no uncaught
exceptions on either load. Two DevTools-generated entries each time:
`[DOM] Password field is not contained in a form` and `A form field element should have an id or
name attribute (count: 9)`.

### PASS A — OBSERVED

- **A reflow path exists.** At 390 the `calm` and `urgent` cards stack full width; at 768 and 1280
  they sit side by side. The layout at 390 is not a narrowed copy of the desktop one.
- **768 and 1280 render identically in content**, because `<main>` caps at 768px.
- **Input values are cut at the input's right edge** where they exceed it — an `<input>` scrolling
  its value, not clipped static text.
- **Save renders as disabled on load**: white on flat grey, with "Paste the admin token above before
  saving." directly beneath. After typing a token the fill becomes `rgb(22,80,143)`.
- No font-loading flash, no broken images, no z-index artefacts; borders and radii consistent.

### PASS A — UNCERTAIN

- `Landing.tsx` and `App.tsx` are in the changed-file list, but only `/admin` was given as a URL.
  **The landing route was not rendered, measured or captured at any viewport.**
- Only the default page state was measured. The saving / saved / conflict / failed states were not
  captured at any viewport (the save posts to a live backend and would have mutated flag state).
- Screenshots are desktop Chrome under CDP device emulation — not iOS Safari.

### PASS B — MEASURED

**`lighthouse_audit` (navigation, mobile) — Accessibility 100.** Every applicable audit scored 1:
`color-contrast`, `label`, `heading-order`, `landmark-one-main`, `button-name`, `target-size`,
`html-has-lang`, `html-lang-valid`, `document-title`, `meta-viewport`, `autocomplete-valid`,
`aria-roles`, `aria-required-attr`, `aria-deprecated-role`, `aria-hidden-body`. The three failing
audits are outside accessibility: `meta-description`, `robots-txt`, `llms-txt`.

Note on coverage: `target-size` passed while the checkbox input measures 24×24, and `color-contrast`
passed while Save is disabled — axe excludes disabled controls from contrast.

**Keyboard traversal** — 14 `Tab` presses from `document.body`: admin token → running checkbox →
calm weight/headline/subheadline/button label → urgent weight/headline/subheadline/button label →
wraps back to admin token. **No focus trap**; **tab order matches the visual order**.

**The Save button is never reached in the page's default state.** It is `disabled` on load, and a
disabled `<button>` is not focusable. After setting the admin token, `save.focus()` succeeds. No
`div`/`span` with a click handler and no `tabindex` was found.

**Visible focus indicator** — all ten enabled controls change from `rgb(0,0,0) none 3px` to
`rgb(0,95,204) auto 1px`. **No `outline: none` appears anywhere.**

**Heading order** — `h1 "Feature flags"` → `h2 "result_screen_tone"` → `h3 "calm"` → `h3 "urgent"`.
Exactly one `h1`, no level skipped.

**Accessible names** — all eleven controls have one, from a wrapping `<label>` or text content. No
control is named only by its `placeholder`; no `placeholder` attribute is present on any input.

**Contrast, measured by hand where lighthouse excludes the element:** Save **disabled**
`rgb(147,163,181)` under white → **2.58:1**. Save **enabled** `rgb(22,80,143)` under white →
**8.15:1**.

**`prefers-reduced-motion`** — the served stylesheet contains zero `@media (prefers-reduced-motion`
blocks, zero `@keyframes`, zero `transition`, zero `animation` and no `scroll-behavior: smooth`;
`document.getAnimations()` is empty. However the served JS contains **one unconditional motion**:
`e.scrollIntoView({block:"nearest",behavior:"smooth"})`, and the string `prefers-reduced-motion`
does not appear anywhere in the served JS or CSS.

### PASS B — OBSERVED

- **Eight of the ten field names are duplicates in pairs.** "Share of traffic (%)", "Headline",
  "Subheadline" and "Button label" each name two different inputs; only the `h3` above the card
  distinguishes calm's from urgent's, and it is not part of either accessible name.
- All labels are the **wrapping** kind, not `for`/`id` pairs.
- The save-result message is `<p role="status">`.

### PASS B — UNCERTAIN

- `matchMedia` was not emulated — the `emulate` tool has no reduced-motion parameter.
- The smooth scroll was **not observed firing**; its presence is established from the bundle.
- Keyboard traversal covers only the default page state, run at 1280 only.
- The admin token was set programmatically, not typed.
- Screen-reader announcement was not tested with an actual screen reader.

---

## Pass 2 — the landing route, and the admin save-result states

**Step 0 — served build re-confirmed as the rebuilt one.** JS bundle hash `index-D0AFDqlk.js` →
`index-yLP7PgjR.js`. Both named changes present in the served bundle:
`Go=()=>window.matchMedia(...prefers-reduced-motion: reduce...).matches` with
`behavior:Go()?'auto':'smooth'`, and `aria-labelledby` on all eight variant inputs.

### 1. Landing route — MEASURED

**Horizontal overflow — clean at all three** (390/390, 768/768, 1280/1280).

**Tap targets, body text, line length — all arrays empty, but the page has nothing to measure.**
Zero interactive elements; no text node over 20 characters. **Vacuous passes, not evidence of
correct sizing.**

| | 390 | 768 | 1280 |
|---|---|---|---|
| `<main>` left | 8px | 8px | 8px |
| `<main>` width | 374 | 752 | 1264 |
| `h1` font-size | 32px | 32px | 32px |

**No max-width cap** on this route. The 8px inset at every width is the UA default
`body { margin: 8px }`, not a page gutter.

**Console — clean.** Zero messages on first load and after a hard reload.

**`lighthouse_audit` — Accessibility 100**, eight applicable audits. One `h1`, one `<main>`,
`lang="en"`, title "Breach Scan", `getAnimations()` empty. Keyboard traversal, focus indicators and
accessible names have **no controls to test** — zero interactive elements exist.

### 1. Landing route — OBSERVED

- The entire route is one heading on white.
- **It renders in Times, not the sans-serif of `/admin`.** Computed `font-family` on `body` and `h1`
  is `Times`; `body` background computes to `rgba(0,0,0,0)`. The landing `<main>` carries only the
  layout primitive class, whereas the admin `<main>` also carries `_page_`. The screenshots show the
  serif difference plainly at all three widths.
- **No reflow path, because there is nothing to reflow.**

### 2. Save-result states — MEASURED

**The message node is always in the DOM.** Empty it measures **0px tall**. It is `<p role="status">`;
Chrome's a11y tree reports `status atomic live="polite"`. It is the **last element** in the card, so
its growth displaces nothing below it.

| state | 390 | 768 | 1280 |
|---|---|---|---|
| **saving** | 0px (cleared) | 0px (cleared) | 0px (cleared) |
| **saved** | 1 line, 308×21, 43 ch | 1 line, 670×21, 94 ch | 1 line, 686×21, 96 ch |
| **conflict** | 3 lines, 308×63, 43 ch | 2 lines, 670×42, 94 ch | 2 lines, 686×42, 96 ch |
| **failed** | 3 lines, 308×63, 43 ch | 1 line, 670×21, 94 ch | 1 line, 686×21, 96 ch |

Message text is **14px** in all four states at all three viewports, `rgb(20,32,46)`, **15.61:1** on
the card. **No horizontal overflow in any state at any viewport.**

**The saving state**: the button's label stays **"Save"** (no "Saving…"), it becomes `disabled`, its
fill becomes the **2.58:1** grey, and the message slot is **cleared to 0px**. There is **no
`aria-busy`**, no spinner, no progress element. **Duration measured with the backend stopped: 38,898
ms from click to the failure message at 1280.** For that entire window the screen showed a greyed
button and an empty message slot.

**The scroll on each answer** — `block: 'nearest'` lands the message's **bottom edge exactly on the
viewport's bottom edge**: 390 saved scrollY 383, message bottom 844, viewport 844; 1280 saved
scrollY 56, bottom 800, viewport 800. At 768 the whole page fits, so nothing scrolls.

**Recovery and logging** — Save re-enables after every answered state. On failure the app logs
`FlagEditor.handleSave: the save failed` with two arguments. The 409 produces **no app-level console
entry**.

### 2. Save-result states — OBSERVED

- **Success, conflict and failure are typographically identical.** Same class, same colour, same
  14px, same position. Nothing but the words distinguishes them. The stylesheet defines a `.warning`
  variant at `#8a4b00`, but no state reached applies it.
- **At 1280 and 390 the scroll pushes the page header out of view**; the card's bottom border sits
  below the fold in every scrolled case.
- **Bonus surface, backend down at page load:** the page shows the heading, intro, admin-token field,
  the line **"Could not load the flags: request failed with status 502"** and a "Try again" button.
  **The raw upstream status code is surfaced verbatim in operator-facing copy.**

### 3. Re-checks of the two changed findings

**Reduced motion — branch verified at runtime.** With `prefers-reduced-motion: reduce` not matching,
the recorded call is `{"block":"nearest","behavior":"smooth"}`; matching, `{"block":"nearest",
"behavior":"auto"}`. **The previous finding no longer holds against this build.**

**Variant field names — duplicates resolved.** All eight inputs carry `aria-labelledby` pointing at
two ids; **every referenced id resolves**. Chrome's accessibility tree reports eight distinct names:
`calm Share of traffic (%)`, `calm Headline`, `calm Subheadline`, `calm Button label`, and the four
`urgent` equivalents. **Zero duplicates. The previous finding no longer holds.** `lighthouse_audit`
on `/admin` after the change: **Accessibility 100**, 46 audits passed.

**Still present and unchanged:** the DevTools issue `A form field element should have an id or name
attribute (count: 9)` — the new ids were added to the label elements, not the inputs. And the
`Enabled` checkbox input still measures **24×24** at all three viewports.

### UNCERTAIN

- The saving state was measured at all three viewports but **screenshotted at none**.
- Only `result_screen_tone` exists, so every state was exercised on a single card.
- The 409 was produced by an out-of-band `curl`, not a second browser session.
- Real OS `prefers-reduced-motion` was stubbed, not emulated.

---

## Pass 3 — confirmation on the rebuilt app

**Step 0 — both hashes changed**; the new work is present in the served artifacts: `body` computes
to `margin: 0` / `system-ui, sans-serif` / `rgb(255,255,255)` with `color-scheme: light`; the Save
button carries `aria-busy`; the served CSS defines `scroll-margin-block:24px`, `_saved_{color:#14202e}`
and `_unsaved_{color:#8a4b00}`.

### 1. Landing route

**HOLDS — the typography is fixed.** `body` and `h1` font-family `Times` → **`system-ui,
sans-serif`**; background `rgba(0,0,0,0)` → **`rgb(255,255,255)`**; colour **`rgb(20,32,46)`**;
`color-scheme: light`. The landing route and `/admin` now render in the same face.

**DOES NOT HOLD — the body box lost its only inset.** `body { margin: 0 }` removed the UA's 8px and
nothing replaced it on this route. `<main>` left offset **0**, computed padding **0px**, `h1` left
edge **0**, right gutter **0**, at all three viewports. The heading touches the left edge of the
viewport at every width.

### 2. Admin save-result states

**Distinguishable by something other than their words? — YES, three ways now.**

| state | message | class | ink | `aria-busy` |
|---|---|---|---|---|
| saving | "Saving…" | `_message_` | `rgb(20,32,46)` | **`true`** |
| saved | "Saved." | `_message_ _saved_` | `rgb(20,32,46)` | `false` |
| conflict | "This flag changed somewhere else…" | `_message_ _unsaved_` | **`rgb(138,75,0)`** | `false` |
| failed | "The flag could not be saved…" | `_message_ _unsaved_` | **`rgb(138,75,0)`** | `false` |

Contrast: `#14202e` on the card **15.61:1**; `#8a4b00` on the card **6.45:1** (both above 4.5:1). The
two inks against **each other** measure 2.42:1 — conflict and failed remain indistinguishable from
each other by colour. **The previous finding no longer holds.**

**The scroll — HOLDS, the flush-to-the-edge problem is fixed.** Gap below the message after the
smooth scroll settles: 390 saved **24px**, conflict **24px**, failed **33px**; 1280 saved **24px**,
conflict **24px**, failed **45px**; 768 no scroll (the page fits). Previously every scrolled case
landed on the last pixel row (gap 0).

*Timing note:* the settled position is only correct **after** the smooth scroll finishes. Sampled two
animation frames after the state change, the message read below the fold; it is in place ~1.2s later.
The earlier reading is the animation in flight, not a defect.

**The saving state is captured as an image at all three viewports** this time: greyed Save button
with "Saving…" beneath it. Duration held 3,008 ms at 390 and 8,520 ms at 1280.

### 3. What the changes introduced

The admin `<main>` now spans the full viewport with `padding: 16px`, so the content gutter went 8px →
**16px**. Line length moved in opposite directions: at 390 the wider column pushed four short lines
**into** the band (43 → 45–50 ch, leaving only the 38-ch checkbox label outside); at 768/1280 it
pushed them **further out** (94 → **96**, intro note 99 → **101**).

**Unchanged, and still failing their thresholds:** body text still **14px** (five blocks, all three
viewports); the `Enabled` checkbox input still **24×24**; the disabled Save still **2.58:1** — and it
is now shown in that state during every save, so **the lowest-contrast element on the page is the one
carrying the in-progress signal.**

`lighthouse_audit` — **Accessibility 100 on both routes**.

---

## Pass 4 — narrow re-check of the landing box

**Step 0 — served build changed**; `<main>` now carries a Landing-scoped page class distinct from the
admin page's.

| | 390 | 768 | 1280 |
|---|---|---|---|
| `<main>` left / width | 0 / 390 | 0 / 768 | 0 / 1280 |
| `<main>` computed `padding` | **16px** | **32px 24px** | **32px 24px** |
| `h1` left edge | **16** | **24** | **24** |
| gutter left / right | **16 / 16** | **24 / 24** | **24 / 24** |
| horizontal overflow | no | no | no |

**IT HOLDS.** The zero-gutter finding is resolved at all three viewports. `<main>` still spans
edge-to-edge, which is what a padded full-bleed container is expected to do — the gutter is inside
it, and nothing overflows.

**OBSERVED:** `max-width` computes to **`none`**, so the content box grows without a cap — the `h1`
box is 1232px wide at 1280, where `/admin` caps its column at 768. With one 11-character heading this
produces no long measure today, but the route has no width ceiling of its own. **Carried to S5**,
which replaces this placeholder with the real landing screen.

The line-length and body-text checks remain empty on this route because it contains no text node over
20 characters and zero interactive elements — **vacuous, not passing**.
