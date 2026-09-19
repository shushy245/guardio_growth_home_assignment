# S6 — visual review (2026-09-19)

Two independent `visual-reviewer` runs against the rebuilt compose bundle, each told only the
changed paths, the URLs and procedural steps (how to reach `/protected`, which states to hold).
Run 1 covered `/signup` and `/protected` with pass A + B, including the leaked-password,
empty-submit and duplicate-email states at 390. Run 2 (pass A) covered the same screens on the
bundle carrying run 1's and the code review's fixes, and was asked to hold the submit-in-flight
state and measure the button and spinner colours.

## Run 1 — measured

- No horizontal overflow on either screen at 390/768/1280; no text under 16px; no line over 75ch.
- `/signup`: **two tap-target failures** at every viewport — the plan radios measure 20×20 on
  their own box (the wrapping label is 400×158 at 1280 and toggles them). Empty-submit: the
  email input is `aria-invalid` but its message has no `id` and `aria-describedby` is null; focus
  stays on `body`. Duplicate-email: banner between the password and the button, the email field
  not marked invalid. DevTools: "A form field element should have an id or name attribute (2)".
  After the duplicate submit the console carries a 409 and the app's own `handleSubmit` error.
- `/protected`: no tap-target, text-size or overflow failure; three step labels under 45ch
  (single-line labels, not prose). Survives a reload with the plan intact.
- Pass B: **Accessibility 100** on `/signup` (navigation mode) and on the leaked, duplicate and
  `/protected` snapshots; `color-contrast` 1 in every state. One `h1` per screen, one `main`.
  Every control named by its label; tab order matches visual order (1280, with the grep proving
  one DOM tree and no reordering); every focused control changes its outline. `getAnimations()`
  empty at rest; each of the three infinite animations sits above a reduced-motion `animation:
  none` block in the served CSS.

## Triage

| # | Finding (run 1) | Class | Outcome |
|---|---|---|---|
| V1 | Plan radios measure **20×20** on their own box at every viewport | measured, tap target | **Fixed** (`cc87578`): the input is a 44×44 box with the design's 20px ring painted at its centre by a radial gradient; the layout does not move. Run 2 measures it |
| V2 | The inline error is not associated with its field (`aria-describedby` null); focus not moved | measured (pass B) | **Fixed** (`18b237d`, F17): each error span carries an id the input names; red first. Focus is not moved — the message is announced as `role="alert"` and the field is marked invalid; moving focus on submit is a decision for a later story |
| V3 | Duplicate-email banner sits between password and button; the email field is not marked invalid in that state | observed | **Recorded, design-conformant**: the mock draws the server error as a full-width banner above the button, not as a field error. Reopen if product asks for field-level attribution of a 409 |
| V4 | The 409 path logs at `error` level | measured (console) | **RF-backlog**: a `warn` level when the logger grows one |
| V5 | Inputs carry no `id`/`name` (DevTools issue) | measured | **Fixed** (`18b237d`): `name="email"`, `name="password"` |
| V6 | "Enter a valid email address" for a field left blank; no required markers | observed | **Recorded, design copy**: the mock has one message for the email field; the design shows no required marker on a two-field form |
| V7 | Three `/protected` step labels under 45ch | measured | **Recorded, not a defect**: single-line card labels, not paragraphs; the floor is for prose |
| V8 | Spinners never seen in motion; in-flight state not captured; interaction states measured at 390 only; Basic `/protected` unrendered; reduced motion inferred from CSS | unmeasured | **Stated**: run 2 holds the in-flight state; the rest stays unmeasured (`/visual-review-deep` on request) |

## Run 2 — confirmation (pass A, on the bundle carrying the fixes)

Measured with the script verbatim at 390/768/1280 on both screens, plus the empty-submit state
and a stalled submit at 390 and 1280:

- **V1 confirmed fixed:** the plan radio measures **44×44**; no tap target under 44 on either
  screen at any width. No horizontal overflow, no text under 16px, no line over 75ch.
- **R-3 confirmed fixed (the spinner-on-disabled contrast):** with `POST /api/signups` held in
  flight the submit button computes `background-color rgb(0, 59, 62)` (`#003b3e`, the calm
  accent), `color rgb(252, 252, 252)`, `opacity 1`, `disabled`, `cursor: progress`, label
  "Starting protection…"; the spinner's top arc is `rgb(252, 252, 252)` and its other arcs
  `rgba(252, 252, 252, 0.4)`, 2px, animating. Identical at both widths.
- **V2 / V5 confirmed on screen:** both inline messages are `role="alert"`, 16px,
  `rgb(163, 0, 24)`; the email input is `aria-invalid="true"` with the danger border.
- Console: **zero messages** on both screens across a hard reload. `/protected` reached by a
  real submit and measured after reload; the three short step labels stand (V7).
- Unmeasured, stated by the reviewer: contrast ratios (pass A computes none — pass B's 100 from
  run 1 stands for the states it reached), hover/focus appearance, the server-error and leaked
  states in this run, the Basic plan, the real slow-network in-flight state (held by an in-page
  stub). One real sign-up row (`visual2-…@example.com`) and one open browser tab were left behind.
