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

- [x] backend — arrived, pasted verbatim below
- [x] frontend — arrived, pasted verbatim below
- [x] conventions — arrived, pasted verbatim below
- [x] visual — arrived, pasted verbatim below

All four arrived in full and are recorded below. Each agent handed back its complete report and
only then hit the account's session rate limit, so nothing was cut short and nothing needs re-running.

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


---

## 1. backend — correctness + backend conventions (verbatim)

## Backend review — S3 (feature flags, visitors, admin gate, forwarded headers)

Suite state: `uv run --env-file ../.env pytest -q` → **146 passed**. Live compose stack probed throughout; the seeded flag's content was left exactly as found (only `updatedAt` advanced, plus a few throwaway `visitor` rows).

---

### 1. `docker-compose.yml:34-36` — the only auth gate on the flag write ships with a committed default token on a LAN-reachable port, and the comment justifying it is factually wrong. **CONFIRMED**

`ADMIN_TOKEN: ${ADMIN_TOKEN:-dev-admin-token}` with the comment *"the compose stack binds to localhost and is not a deployment."* It does not bind to localhost:

```
$ docker compose ps --format '{{.Service}}  {{.Ports}}'
backend   0.0.0.0:8000->8000/tcp, [::]:8000->8000/tcp
frontend  0.0.0.0:5173->8080/tcp, [::]:5173->8080/tcp
```

Failure scenario (executed against this machine, not hypothetical): from any host on the same Wi-Fi,
```
$ curl -X PATCH http://192.168.1.177:8000/api/feature-flags/result_screen_tone \
    -H 'X-Admin-Token: <token>' -d @payload.json
{"updatedAt":"2026-09-18T17:00:18.905829Z"}   → 200
```
On a clean clone with no `.env` that token is `dev-admin-token`, which is in the repo. An attacker on the network rewrites the headline/subheadline/CTA of a security product's result screen, or disables the experiment. CORS does not help — it is browser-only and `curl` ignores it.

This collides with the global HARD RULE *"Hardcoded credentials are forbidden. Always. No exceptions."* The comment's "same footing as the db password above" is not equivalent: the db password gates a port nothing routes to, the admin token *is* the authorization boundary.

Minimal fix: bind the published ports to the loopback (`"127.0.0.1:8000:8000"`, `"127.0.0.1:5173:8080"`) so the comment becomes true, and drop the `:-dev-admin-token` default so a missing `ADMIN_TOKEN` fails the boot loudly (`Settings` already enforces `min_length=1`). Correct the comment either way.

---

### 2. `frontend/nginx.conf:21` + `backend/Dockerfile:33` — `client_ip` in every log line is fully attacker-controlled *through nginx*, so the new forwarded-header wiring logs the forged value and discards the trustworthy one. **CONFIRMED**

nginx sends `X-Forwarded-For $proxy_add_x_forwarded_for`, which **appends** the real peer to whatever the client sent. uvicorn 0.53's `ProxyHeadersMiddleware` takes the **leftmost** entry — the client-supplied part.

```
$ curl -H 'X-Forwarded-For: 1.2.3.4, 5.6.7.8' http://localhost:5173/api/health
→ log: request: completed  client_ip=1.2.3.4  path=/api/health
$ curl http://localhost:5173/api/health          # no header
→ log: request: completed  client_ip=192.168.65.1
```

The Dockerfile comment scopes the risk to the published port 8000 (*"a deployment narrows it to the proxy's address, because port 8000 published to the host is reachable without going through nginx at all"*). The reproduction above went through nginx on 5173. So an attacker brute-forcing `X-Admin-Token` can attribute every attempt to an arbitrary IP, and `require_admin_token`'s refusal lines (which carry no path/method of their own) become unusable for incident response — the exact job the story added these fields for.

nginx already sets `X-Real-IP $remote_addr`, which is correct and unforgeable here, and nothing reads it.

Minimal fix: at the edge, overwrite rather than append — `proxy_set_header X-Forwarded-For $remote_addr;`. (`X-Forwarded-Proto` is already safe: nginx overwrites it with `$scheme`, verified — a forged `X-Forwarded-Proto: https` still logged `scheme=http`.)

---

### 3. `backend/app/visitors/router.py:29-54` — `POST /api/visitors` sets a `visitor_id` cookie and then ignores it on every subsequent request, so the endpoint is not idempotent and one human can be counted twice under *two different variants*. **CONFIRMED**

Nothing in `app/` ever reads `VISITOR_COOKIE` (grep: the only references are the three lines that write it in `router.py` and its definition in `cookie.py`), and it is `httponly=True`, so the page cannot read it either. `frontend/src/storage/visitor-id.ts` (localStorage) is the real identity; the cookie is write-only decoration.

```
$ curl -c jar -X POST /api/visitors
{"id":"vis_01M2TQCY9Y8QTZR74YY2APPHR3","assignments":{"result_screen_tone":"calm"}}
$ curl -b jar -X POST /api/visitors          # browser presents the cookie it was just given
{"id":"vis_01M2TQCYB272X0XN0VAMBW3HHN","assignments":{"result_screen_tone":"urgent"}}
```

Two visitor rows, two assignments, **different variants**, one person — which is precisely what `cookie.py:10-12` claims the max-age is there to prevent (*"a session cookie would re-bucket every returning visitor and double-count them in the funnel"*). Real trigger, not just a curl artifact: `loadVisitorSession` reads localStorage synchronously at effect time and the `inFlight` ref only dedupes within one component instance, so two tabs opened together both find nothing stored and both POST. Also a private window, cleared site data, or any retry of a POST whose response was lost. Every such duplicate contaminates the A/B numbers S6 will compute.

This also misses the `docs/python-conventions.md` HTTP row *"Idempotent consumer: `INSERT … ON CONFLICT DO NOTHING`"* — there is no server-side dedupe of any kind.

Minimal fix: read the `visitor_id` cookie at the top of `create_visitor`; if it names a visitor that exists, return that visitor's stored assignments with `200` instead of minting a new identity. That makes the cookie load-bearing and the endpoint idempotent in one move. If the cookie is not going to be read, delete it (*delete aggressively*) rather than leave a security-shaped no-op with a docstring claiming a property it does not have.

---

### 4. `backend/app/visitors/models.py:29` — a PATCH that renames a variant key orphans every stored `visitor_assignment`, and nothing detects it. **CONFIRMED**

`variant_key` is bare `Text` with no FK and no reconciliation (`\d visitor_assignment` confirms: FKs on `visitor_id` and `flag_key` only). `FeatureFlagUpdate` freely accepts a changed set of variant keys.

```
visitor before:                    {"result_screen_tone":"urgent"}
PATCH renames urgent → alarm  →    200
flag variant keys now:             ['calm', 'alarm']
visitor after:                     {"result_screen_tone":"urgent"}   ← names a variant that no longer exists
```

Consequence is graceful rather than crashing — `variantFor` in `VisitorProvider.utils.ts:44-52` returns `undefined` for an unfindable key — so the visitor **silently falls out of the experiment** and, in S6, contributes events under a variant label the flag no longer defines. No log, no error, no 409.

The existing test `test_a_visitor_keeps_the_assignment_made_at_creation_after_the_weights_change` covers only a *weight* change (0/100), not a key change, so this path is untested.

Minimal fix: reject a `FeatureFlagUpdate` whose variant keys are not a superset of the keys already assigned for that flag (one `SELECT DISTINCT variant_key` in the handler, `409`/`400` with the orphan keys named) — or accept it deliberately and record the decision, since renames are otherwise a silent data-integrity event.

---

### 5. `backend/app/visitors/router.py:29,57` + `feature_flags/router.py:22` — logging-convention gaps in three of the four new handlers. **CONFIRMED (by reading; `update_feature_flag` is the one that gets it right)**

- `list_feature_flags` — **no log at all**. No entry line.
- `get_visitor` — logs only the 404 branch. No entry line, and the success branch is silent, so the refresh path leaves no trace. Violates *"Log at every branch — which path and why."*
- `create_visitor` — logs `"create_visitor: assigned"` before the write (correct instinct), but has no entry line carrying the identifiers, and nothing after the write.
- `update_feature_flag` — has entry + all three branches, but re-spreads `key=key, token=token` across four separate `log.info` calls. *"Context established once, reused"* — the structlog form is `log = log.bind(key=key, token=token)` once at the top.

Minimal fix: an entry line per handler with its identifiers, a line on the success branch of `get_visitor` and after `create_visitor`'s write, and one `bind` in `update_feature_flag`.

---

### 6. `backend/migrations/versions/75463482a98c_*.py:61-81` — no index on `visitor_assignment.flag_key`. **CONFIRMED**

The PK is `btree (visitor_id, flag_key)`, which serves `find_assignments` but not any lookup keyed on the flag. S6's per-variant funnel aggregation (`GROUP BY flag_key, variant_key`) and every FK check against `feature_flag` will seq-scan. Forward-looking, not a current defect. Minimal fix: a forward migration adding `ix_visitor_assignment_flag_key`, when S6 needs it.

---

### 7. Test-side DRY — three production constants re-declared as literals in drivers. **CONFIRMED**

- `tests/drivers/visitors_api.py:19` `VISITOR_COOKIE = "visitor_id"` duplicates `app/visitors/cookie.py:9`.
- `tests/drivers/feature_flags_api.py:18` `ADMIN_TOKEN_HEADER = "X-Admin-Token"` duplicates `app/feature_flags/admin.py:19` `ADMIN_HEADER_NAME`.
- `RESULT_SCREEN_TONE = "result_screen_tone"` declared independently in both drivers.

Same principle as the `noRawTestId` lint rule — Hunt & Thomas, DRY: one authoritative representation, and the grep invariant (constant name === access path) breaks when the string is re-typed. These fail loudly rather than silently, so it is low severity. Minimal fix: import from `app.visitors.cookie` / `app.feature_flags.admin`.

---

### 8. `backend/app/feature_flags/schemas.py:65` — a timezone-**naive** `updatedAt` token is accepted and silently interpreted in the database session's timezone. **PLAUSIBLE (latent; not currently wrong)**

What I tried: sent the current token with the offset stripped → `200`; sent the same instant spelled `+02:00` → `200`; sent a naive value shifted 3h → `409`. `SHOW timezone` on the container is `UTC`, so today naive == UTC and the behaviour is correct. The dependency is unstated: on a Postgres whose session `TimeZone` is not UTC, a naive token from a client that drops the offset would name a different instant. **I could not produce a wrong outcome** and will not claim one.

Minimal fix if you want the dependency gone: `AwareDatetime` instead of `datetime` on the field, so a naive token is a `400` rather than a silent reinterpretation.

---

### Lower-priority notes (no reproduction attempted, stated as such)

- `schemas.py:22` — `_wire` carries no `extra="forbid"`, so `FeatureFlagVariant`/`VariantConfig` silently drop unknown nested fields while the top-level `FeatureFlagUpdate` rejects them. Inconsistent boundary strictness; harmless today because every nested field is required.
- `admin.py:31,35` — `401` without a `WWW-Authenticate` header (RFC 7235 says MUST). Given it is not a standard auth scheme, `403` may be the more honest code.
- `visitors/repository.py:10` — `user_agent` is stored unbounded from a client-controlled header into a `Text` column.

---

### Categories where I found nothing

- **Optimistic locking**: no holes. Five concurrent PATCHes carrying the same token → exactly one `200`, four `409`; a stale token changes nothing (verified by re-reading the flag after); `404` vs `409` are discriminated correctly; the `Z` / `+00:00` round-trip is accepted; `clock_timestamp()` vs `now()` is the right call and is covered by a test that explains why.
- **Admin-gate ordering**: `require_admin_token` runs *before* body validation — `PATCH` with no token and `{"garbage":1}` returns `401`, not `400`, so an unauthenticated caller learns nothing about the schema. Constant-time compare via `hmac.compare_digest`, `SecretStr` on the setting, and no presented value in any log line.
- **Transactions**: a 4xx rolls back cleanly (confirmed live — the flag was byte-identical after a 409). One transaction per request, no handler commits.
- **SQL correctness**: `find_assignments`' outer join does what its name and docstring say (an existing visitor with zero assignments is `{}`, not `None`); `list_enabled_splits` orders by key so assignments are deterministic; everything is parameterized — no injection surface.
- **The pure assignment rule**: deterministic, `sha256` not salted `hash()` (with a pinned-bucket test that would catch the swap), modulo bias is ~1 part in 2^63 and not worth reporting, weights/duplicate-keys validated at the boundary before anything is written.
- **Type discipline**: zero `cast(` / `: Any` / `type: ignore` anywhere in `app/`.
- **Migrations**: forward-only with empty `downgrade`, one logical change each, and the seed is `ON CONFLICT DO NOTHING` so a re-run never resets product's copy.
- **Module DAG**: `visitors → feature_flags` only; `assignment.py` imports nothing from `app`. Functional core intact, no cycle.

---

## 2. frontend — frontend + testing conventions + correctness (verbatim)

FRONTEND / TESTING / CORRECTNESS review of `git diff story/S3..HEAD -- frontend/`.

Baseline: `pnpm vitest run` 59/59 green, `eslint . --max-warnings 0` exit 0, `pnpm -r typecheck` clean. I ran 6 implementation mutations and 4 ad-hoc repro tests (all temp files deleted; `git status` clean).

---

### 1. CONFIRMED — `frontend/src/pages/Admin.tsx:161` — a save silently discards every edit typed while it was in flight
`onChange(setLockToken(flag, lockToken))` closes over the `flag` prop captured at click time and hands the *whole snapshot* back to `replaceFlag`, so anything typed between click and response is overwritten by the pre-save value.

Scenario: operator pastes the token, edits the CTA to "SAVED VALUE", clicks Save, keeps typing "TYPED DURING FLIGHT" while the PATCH is in the air. On resolve the field reverts to "SAVED VALUE" — and the console says "Saved.", so the operator believes the newer text persisted.

Evidence: repro test gating the PATCH adapter behind a manual promise —
```
Expected the element to have value:  TYPED DURING FLIGHT
Received:                            SAVED VALUE
```
Minimal fix: the success path must apply only the token to *current* state, not replay a snapshot — e.g. give `FlagEditor` an `onSaved(flagKey, lockToken)` that the parent applies inside the functional `setState` (`replaceFlag(current.flags, setLockToken(findFlag(current.flags, key), token))`), instead of `onChange(setLockToken(flag, …))`.

### 2. CONFIRMED — `frontend/src/pages/Admin.tsx:162` — "Saved." persists over later, unsaved edits
`setSave({ status: SaveStatus.Saved })` is never reset when the flag changes, so the confirmation sits next to dirty fields.

Scenario: save succeeds, operator edits the headline, walks away reading "Saved." — the edit is not on the server.

Evidence: repro test typed into the CTA after a successful save and asserted the message no longer contains "Saved" — failed, element still read `Saved.`.
Minimal fix: `FlagEditor` resets `save` to `SaveStatus.Idle` whenever `flag` changes (reset in the change handlers, or key the save state off the lock token).

### 3. CONFIRMED — `frontend/src/main.tsx:17` — opening the flag console enrols the operator in the experiment, and double-fetches the flags
`VisitorProvider` wraps the whole `BrowserRouter`, so `/admin` runs the visitor session too.

Scenario: operator opens `/admin` in a private window → `POST /visitors` creates a real visitor with a real `result_screen_tone` assignment. Once S4 stores funnel events, operator traffic is inside the A/B numbers the dashboard reports. Separately the flag list is fetched twice per Admin render (provider + `Admin`'s own effect), i.e. two independent owners of the same list in one tree.

Evidence: rendering `<Admin/>` through `renderWithProviders` records 1 × `POST /visitors` and **2** × `GET /feature-flags` (asserted `toHaveLength(0)` on each, got 1 and 2).
Minimal fix: scope `VisitorProvider` to the funnel routes rather than the router root (the doc's "feature-level providers live closer to the features that need them"), and let `/admin` read the flag list once.

### 4. CONFIRMED — `frontend/src/pages/Admin.module.scss:125` — the mobile-first reflow is inverted; the md media query is dead
`.variants` has **no base rule at all** — it exists only inside `@media (min-width: 768px)`. The element is a `<Row>`, and `.row` is already `flex-direction: row`, so the md override is a no-op and there is no base `gap`.

Scenario: at 390 px the two variant editors sit side by side, ~half of a 358 px content box each, holding 44 px-tall inputs inside 12 px-padded cards, with the cards touching (gap only arrives at 768). The intent was clearly column→row.
Evidence: read `Admin.module.scss` (no `.variants` outside the query) against `ui/primitives.module.scss` (`.row { display:flex; flex-direction:row }`).
Minimal fix: make the base a `<Column>` (or add `.variants { flex-direction: column; gap: 12px }` outside the query) and keep the md override as the actual change.
Note: this is a code-level proof only — HARD RULE 5 still requires the independent `visual-reviewer` pass at 390/768/1280 before sign-off; I did not run it and nothing here substitutes for it.

### 5. CONFIRMED — `frontend/src/pages/Admin.tsx:104, 248, 297` — raw `<label>` used as a layout container, and its `gap` is inert
`.field { gap: 6px }` is applied to a bare `<label>`, which is `display: inline` — `gap` applies only to flex/grid, so the label/input spacing silently does nothing. This is also the layout-primitive ban (frontend-conventions §Layout primitives: never raw elements with layout styles).
Minimal fix: `<Column as/inside label>` or add `display:flex; flex-direction:column` to `.field`; prefer the primitive.

### 6. CONFIRMED — `frontend/src/testkit/builders/featureFlag.ts:9-38`, `visitor.ts:5-8` — builder defaults are hardcoded, and tests depend on the literals
testing-conventions §Builders: "Every field has a realistic random default via `Chance` — never hardcoded, **so tests can't accidentally depend on a specific value**." Both builders use fixed constants and eight assertions read them straight through:
`featureFlag.test.ts:25` (`'2026-09-18T08:00:00.123456Z'` with no `withUpdatedAt`), `:52` `'Protect me now'`, `:73` `'Protect me'`, `:83` `"You're exposed!"`, `:92` weight `50`, `:121` `100`; `VisitorProvider.test.tsx:19,84` `"You're exposed!"`.
Consequence: retuning the seeded copy — exactly what this story exists to enable — breaks unrelated tests, and no test states the value it actually depends on.
Minimal fix: `chance`-random defaults plus explicit `with*` in the tests that care (`withUrgentHeadline(…)`, `withUpdatedAt(…)`), and drop the literals from the assertions.

### 7. CONFIRMED — `frontend/src/pages/Admin.tsx:196-204, 236-239` — an invalid split is warned about but still sendable, and the weight input accepts out-of-range values
`disabled={isSaving(save)}` is the only guard; `hasCompleteSplit` drives copy only. `min={0} max={100}` on a controlled `<input type=number>` are not enforced on change.
Scenario: type `999` into the urgent weight → state takes 999, `SplitNote` warns, Save still fires, backend 400, the raw backend message surfaces as the operator-facing error. Clearing the field writes `0` (`Number.isNaN(weight) ? 0 : weight`) with no signal.
Evidence: repro asserted the weight field still held `50` after typing `999` — failed, value was `999`.
Minimal fix: `disabled={isSaving(save) || !hasCompleteSplit(flag)}` via a named predicate in `Admin.utils.ts` (`canSave({ save, flag })`), and clamp in `handleWeightChange`.

### 8. CONFIRMED — dead code and duplicated knowledge (Delete aggressively / DRY)
Verified by grep across `frontend/src`:
- `Admin.driver.tsx:36,48,30` — `type.urgentWeight`, `assert.weightsAre`, `given.theSaveFails` are declared, typed and implemented but **called by no test** (~30 lines of driver surface). The save-failure path (non-409) is consequently untested.
- `models/featureFlag/model.ts:34` `RESULT_SCREEN_TONE_FLAG` — exported, used nowhere, while the same literal `'result_screen_tone'` is hardcoded in `Admin.driver.tsx:15`, `VisitorProvider.driver.tsx:20` and `testkit/builders/featureFlag.ts:32`. The canonical home is the one copy nobody uses.
- `Admin.utils.ts:76,78` `CONFLICT_MESSAGE` / `SAVED_MESSAGE` — exported but used only in the same file; the driver instead asserts the literal substrings `'Saved'` (`Admin.driver.tsx:176`) and `'Reload the page'` (`:181`), so the operator copy has two homes.

### 9. CONFIRMED — `eslint.config.mjs:38-47` — this story added a lint exemption that is not needed (HARD RULE 3)
`'**/storage/visitor-id.ts'` was added to a block that sets `'no-restricted-syntax': 'off'` — turning off the whole composed rule (`noOptionalChaining`, `noNullLiteral`, `noRawTestId`, `jsxTextBackticks`, `noInlineJsxLambda`, `noBooleanParam`) for that file. The stated reason is "`getItem` returns null", but the file never writes a `null` literal (`?? undefined` handles it).
Evidence: I removed the entry and ran `pnpm exec eslint frontend/src/storage/visitor-id.ts --max-warnings 0` → **exit 0**. (Config restored; `git diff` clean.)
Minimal fix: delete the entry.
Adjacent, pre-existing (not this diff, flagging not fixing): the `frontend/src/models/**/*.test.ts` block at `:27-37` also uses `'off'` where `lint-index.md` says "Compose consumer globs from the exported `pureFunctionTestSyntaxSelectors`". I verified the sanctioned composition keeps those files green, so it is a free tightening.

### 10. CONFIRMED — `frontend/src/pages/Admin.tsx:56-71` — the unmount guard is untested production code
Mutation: deleted both `if (!cancelled)` checks → **59/59 still pass**. Five lines exist that no failing test justified (TDD contract). Note the inconsistency: the load effect guards against unmount, `handleSave`'s `.then` (`:158-171`) does not.
Minimal fix: either a test that unmounts mid-flight, or delete the guard and rely on React 19's no-op setState — but pick one and apply it to both async paths.

### 11. CONFIRMED — `frontend/src/models/featureFlag/featureFlag.test.ts:114-115` — the test body re-implements a production selector
`replaced.find((flag) => flag.key === 'b')` and `replaced.map((flag) => flag.key)`. The pure-function exemption explicitly says "Derived/computed assertions go through named functions, **production selectors first**" — `findFlag(flags, key)` exists in `selectors.ts:9` and is not used here.
Minimal fix: `expect(findFlag(replaced, 'b')?.isEnabled).toBe(false)`.

### 12. CONFIRMED (latent) — `testkit/builders/featureFlag.ts:41` — `{ ...RESULT_SCREEN_TONE }` is a shallow copy
Every default-built DTO across the whole run shares one `variants` array and the same nested `config` objects. Nothing mutates them today (the axios interceptor's `normaliseNulls` rebuilds every response body), so it is latent rather than live — but it is the same class of cross-test corruption the `with*`-reassigns rule exists to prevent, and the builder's own header comment claims immunity it does not have for nested fields.
Minimal fix: deep-copy the seed in the field initialiser, or build the default from a `make*`-style function.

### 13. Given/When/Then phase ordering — minor
- `Admin.test.tsx:46` — `await driver.assert.savedConfirmationIsShown()` is used as a synchronisation barrier before two more Whens (`type`, `click`). A Then mid-body doing double duty as a wait; better as a `driver.when.saveSettles()`.
- `VisitorProvider.test.tsx` — four `describe` blocks each repeating the identical `let driver / beforeEach`; one `describe` with the scenario stated in the `it` name reads the same and drops 18 lines.

### 14. Component-TDD trigger — `FlagEditor` (`Admin.tsx:131-213`) is not tested as a unit
It owns its own state (`SaveState`), the whole async save coordination and the optimistic-lock round trip — the substance of the story — yet it lives inline in `Admin.tsx` with no file, driver or test of its own. testing-conventions: "any component with meaningful logic (own state, effects, interaction-driven transitions, async coordination) gets a Vitest component test written *before* it"; frontend-conventions: "the moment a sub-component needs its own test, it becomes its own unit — extract to its own file." Findings 1, 2 and 7 all live in this untested component. `SplitNote` and `VariantEditor`'s weight parsing are likewise uncovered.

### 15. `frontend/src/testkit/setup.ts:15-21` — global default routes make Givens implicit — minor
Every test in the repo starts with a working `POST /visitors` and `GET /feature-flags`. `VisitorProvider.test.tsx:44` ("starts a new visitor…") never declares a flag route and passes on the global default, so the test's precondition is not readable from the test. Prefer declaring the routes the scenario needs and letting an undeclared route fail loudly (which `fake-http` already does well).

---

**Vacuous tests: none found.** 6 mutations, 5 killed by the suite: StrictMode single-flight ref (kills `VisitorProvider under StrictMode`), `setLockToken` round trip (kills `carries the token the previous save returned`), 404→create recovery, `storeVisitorId`, `toUpdatePayload` sending server-owned fields. The sixth (the `cancelled` unmount guard) survived — that is untested code, not a vacuous test, and is finding 10.

**Clean categories, explicitly:** the `.tsx`/`.utils.ts` boundary (`Admin.tsx` exports only the component; tests import the driver and builders, never the `.tsx`); the model-layer decomposition (`model`/`translator`/`selectors`/`setters`/`index`, namespace barrel, API layer typed with the wire DTO and mapped through `fromDTO`); discriminated unions over optional fields, with `is*` predicates in the right place; no prop drilling (every forwarded prop is used by its recipient); named `handle*` handlers with no inline JSX lambdas; optimistic update / don't-read-after-write on save (the mechanism is right — finding 1 is the snapshot, not the pattern); no `?.` anywhere in production code; fakes over mocks (`fake-http` is a genuine in-memory transport behind the axios seam, not a mock); every render through `renderWithProviders`; test names read as behaviour sentences; no `expect()`, DOM query or logic in any `.test.tsx` body.

**One naming defect worth a line:** `Admin.tsx:146` — `handleVariantChange = (variant: FeatureFlagModel) => onChange(variant)` is a no-op pass-through whose parameter is a `FeatureFlagModel` named `variant`. Delete the indirection and pass `onChange` down.

---

## 3. conventions — named principles + comment/doc accuracy + git history (verbatim)

Review of `story/S3..HEAD` (14 commits, 79 files) — named principles, comment/doc accuracy, git history. I did not run the app or the suites; every claim below is from reading the files at HEAD plus targeted greps.

Note: the working tree is dirty — `frontend/src/providers/VisitorProvider.tsx` was modified by something else *during* this review. All findings are against HEAD.

---

## ANGLE 1 — NAMED PRINCIPLES

**1. Stale closure: an edit made while a save is in flight is silently reverted.** `frontend/src/pages/Admin.tsx:150-172` (the discard is line 161).
`handleSave` closes over the render's `flag`; when the PATCH resolves, `onChange(setLockToken(flag, lockToken))` writes that *captured* flag back to the parent. The Save button is disabled during the save (line 200) but the inputs are not — so if the operator keeps typing, their edits vanish when the response lands, with a green "Saved." beside them. This is the Race Family's **stale closure** shape (`intellectual-references.md` → Concurrency & Interleaving), the one the pre-mortem is supposed to catch; F9's test only exercises two *sequential* saves, so nothing covers it.
*Fix:* don't echo the whole flag back. `onSaved(flag.key, lockToken)`, and let the parent apply it to its current copy with the same functional-updater form already used at line 78.

**2. A lint rule switched off where the documented mechanism exists to narrow it.** `eslint.config.mjs:32-35`.
`rules: { 'no-restricted-syntax': 'off' }` for `frontend/src/models/**/*.test.ts` disables the **whole** rule, not the `noRawExpect` selector the comment is about — it also lifts `noNullLiteral`, `noRawTestId`, `jsxTextBackticks` and `noInlineTestFactories` (the DRY rule against inline test factories). `lint-index.md` → noRawExpect, scope (adr-0004) says verbatim: "Compose consumer globs from the exported `pureFunctionTestSyntaxSelectors`", and the package does export it (verified: `['default','pureFunctionTestSyntaxSelectors','typeAwareRules']`); upstream `index.mjs:325` uses exactly that form. HARD RULE 3 territory — the rule was weakened rather than composed.
Worth stressing: the narrow form would have passed anyway. I checked both files in the glob — no inline factories, no `null` literal, no raw test id, no JSX; the `?.` at `featureFlag.test.ts:52,58,72,73,83,91,92,115` is fine because `noOptionalChaining` is *not* in the pure-function set. Nothing required the blanket off.
*Fix:* `rules: { 'no-restricted-syntax': ['error', ...pureFunctionTestSyntaxSelectors] }`, re-importing the named export.
*Same pattern, smaller:* `eslint.config.mjs:39-47` adds `**/storage/visitor-id.ts` to another blanket `'off'`. Its stated trigger ("getItem returns null") isn't in the file — `visitor-id.ts` has no `null` literal and no `?.`; `?? undefined` is not restricted syntax. Verify by removing the glob and running lint; it looks like an exemption for a violation that isn't there.

**3. DRY-as-knowledge: the flag key has three literals and the model's home has no consumer.** `frontend/src/models/featureFlag/model.ts:34` exports `RESULT_SCREEN_TONE_FLAG = 'result_screen_tone'` — grep finds **zero** references anywhere in `frontend/src`. Meanwhile `VisitorProvider.driver.tsx:20` and `Admin.driver.tsx:15` each declare their own `const RESULT_SCREEN_TONE = 'result_screen_tone'`. One piece of knowledge, three copies, and the one that was meant to be authoritative is dead.
*Fix:* delete the model constant, or import it in both drivers.

**4. A runtime guard for a case the table's own indexing rules out.** `frontend/src/pages/Admin.utils.ts:88`.
`[SaveStatus.Failed]: (state) => (state.status === SaveStatus.Failed ? state.error : undefined)` — line 91 indexes the map *by* `state.status`, so this entry only ever sees the Failed variant. The false branch is unreachable and silently yields no message, which is precisely the failure the comment at line 82 claims the table prevents ("a new SaveStatus member is a compile error here instead of a silently blank message"). Trust the Type System: the constraint belongs in the type.
*Fix:* type the map per-variant — `{ [S in SaveStatus]: (state: Extract<SaveState, { status: S }>) => string | undefined }` — and the ternary disappears.

**5. Middle Man, with a misleading parameter name.** `frontend/src/pages/Admin.tsx:146-148`. `handleVariantChange` forwards its argument to `onChange` unchanged, and names the parameter `variant` when its type is `FeatureFlagModel` — a whole flag, not a variant. A reader tracing the callback is told the wrong thing.
*Fix:* pass `onChange` directly to `VariantEditor`; if `jsx-handler-names` needs the `handle*` const, at least rename the parameter to `flag`.

**6. Production code with no test demanding it, and no reachable caller.** `backend/app/feature_flags/assignment.py:54-58`. The `ValueError` for uncovered buckets has no test — `grep -rn "unassigned\|weights of flag" backend/tests` returns nothing — and `FeatureFlagUpdate`'s validator makes it unreachable through every supported write path. Under the project's TDD contract it's either a deliberate fail-loud for hand-edited rows (which deserves a test) or Speculative Generality.

**7. Pure lookup data living in the `.tsx`.** `frontend/src/pages/Admin.tsx:44-50` — `HTTP_CONFLICT` and `copyLabelMap` are exactly what `Admin.utils.ts` exists for; `saveMessageMap` is already there. Consistency nit, but the boundary rule is explicit about pure logic and constants.

**8. Tokens named for no consumer.** `frontend/src/styles/tokens.scss:7,9` — `$breakpoint-sm` and `$breakpoint-lg` have no usage anywhere (`grep`); only `$breakpoint-md` is referenced, at `Admin.module.scss:119`. Beck Rule 4.

**9. Builder defaults are shared by reference across the process.** `frontend/src/testkit/builders/featureFlag.ts:41` — `private state: FeatureFlagDTO = { ...RESULT_SCREEN_TONE }` is a *shallow* copy, so every builder's `build()` hands back the same `variants` array and the same `CALM`/`URGENT` objects. The file's header comment carefully covers the `with*`/`build()` aliasing but not this deeper one. Nothing mutates them today; it's a tripwire of exactly the class the comment is warning about.

Clean on: enums over string literals, data-table lookups over branch chains (`copyLabelMap`, `saveMessageMap`, `_log_format_map`), discriminated unions with `is*` predicates (`AdminState`, `SaveState`, `VisitorState`), no boolean parameters (`toggleEnabled`'s comment at `setters.ts:35` explicitly reasons about it), no `as` casts anywhere in the diff (`Admin.driver.tsx:67` uses a type predicate and says why), immutable setters, keyword-only args throughout the backend.

---

## ANGLE 2 — COMMENTS AND DOCS

**1. Two documents cite a README paragraph that does not exist.** `docs/adr/adr-0003…md:79-82` — "This is deliberately short of authentication and **the README says so**"; `docs/changelog.md`, S3 → Trade-off — "a deliberate stopping point, **recorded in the README**, not an oversight."
`README.md` is **one line**. `grep -ci "admin"` → 0; no "token", "auth", "secret" either. The one claim that matters most for an evaluator — the security scope of the admin gate — is asserted as documented in the place an evaluator would actually look, and isn't there.
*Fix:* write the paragraph into `README.md`, or delete the claim from both docs.

**2. A mechanism the ADR describes cannot happen: nothing ever reads the visitor cookie.** `adr-0003…md:34-39` — "The cookie is the belt: it cannot be read by script, so it survives a hostile page."
`grep -rn "cookies" backend/app` finds nothing. `VISITOR_COOKIE` appears only in the `set_cookie` call at `backend/app/visitors/router.py:45-52`; `GET /api/visitors/{id}` takes the id from the path, and the page sources it from `localStorage`. A visitor whose localStorage is cleared gets a brand-new id and a fresh assignment while the cookie still names the old one. The belt is written and never worn. This is the same class as the impossible-mechanism comment a previous review found.
*Fix:* read the cookie as the fallback in the visitor handlers, or say in the ADR that it is written now and read in a later story.

**3. A docstring contradicted by the test three lines away.** `backend/app/middleware/correlation_id.py:70-72` — "`request.client` is None when the transport does not report a peer (**an in-process ASGI call**)". `backend/tests/unit/test_correlation_id.py:51` asserts `client_ip="testclient"` from exactly an in-process ASGI call. The example given for the None branch is the one case the suite proves is *not* None.
*Fix:* name the real condition (a scope with no `client` key) or drop the parenthetical.

**4. A test whose docstring describes a mechanism the test cannot reach.** `backend/tests/unit/test_correlation_id.py:45-53` — "The client and scheme are only true if uvicorn rewrote them from `X-Forwarded-For` / `X-Forwarded-Proto`". There is no uvicorn, no nginx and no forwarded header anywhere in this test; it pins `testclient`/`http`, which is what the harness reports with the proxy wiring entirely absent. Delete `--proxy-headers` from the Dockerfile and all three `proxy_set_header` lines from `nginx.conf` and this test still passes. The wiring is backed only by the manual run described in the commit body.
*Fix:* say the test pins the fields' *presence*, and that the rewrite is verified on the running stack — which is what `docs/plan.md`'s own "(recorded)" note already says correctly.

**5. A docstring that is true of one half of what it claims.** `backend/app/feature_flags/assignment.py:62-63` — "anything but 100 leaves buckets unassigned or double-assigned, and `assign_variant` would raise on the first visitor to land there." For weights summing **above** 100 nothing raises: the cumulative walk returns at the first variant whose upper bound exceeds the bucket, so buckets ≥ 100 are never reached and the trailing variants' share is silently truncated. Only the under-100 case raises.
*Fix:* "under 100 leaves buckets unassigned and `assign_variant` raises; over 100 silently truncates the later variants."

**6. "First-seen order" is not the order produced.** `backend/app/feature_flags/assignment.py:68` — `duplicated_variant_keys` appends a key when its *second* occurrence is seen, so the result is in first-*detection* order. For `["b","a","a","b"]` it returns `["a","b"]`; first-seen order of those keys is `b, a`. Untested either way (see Angle 3 #5).
*Fix:* "in the order each duplicate is first detected."

**7. A comment names the wrong narrowing point.** `backend/app/feature_flags/models.py:26-27` — "the repository narrows it through the variant schema, so nothing past the boundary ever works with an unvalidated dict." True of `list_enabled_splits` (`repository.py:27`), false of `list_flags` (`repository.py:33-34`), which returns raw rows; on the `/feature-flags` path the narrowing is the router's `FeatureFlagResponse.model_validate` (`router.py:27`). The invariant holds — the attribution doesn't.

**8. `nginx.conf` credits uvicorn with reading a header it ignores.** `frontend/nginx.conf:17-23` — "uvicorn reads **them** back into `request.client` and `request.url.scheme`" sits under three `proxy_set_header` lines, but uvicorn's `ProxyHeadersMiddleware` reads only `X-Forwarded-For` and `X-Forwarded-Proto`. The newly added `X-Real-IP` has no consumer in this stack.
*Fix:* drop `X-Real-IP`, or say it's set for a log/proxy consumer that doesn't exist yet.

**9. `Admin.tsx:159-161` states a property the code doesn't hold.** "Don't read after write: … the values on screen are the ones we just sent" — true only if nothing was typed during the round trip, which is exactly the bug in Angle 1 #1. The comment is what makes the stale-closure write read as deliberate.

**10. The plan's S3 commit list was reconciled everywhere except C8.** `docs/plan.md` — C1, C3, C7, C7b, C10, C11 and C12 were all rewritten to match what shipped, but `C8 [refactor] extract feature_flags/repository.py; router is a thin shell` never happened: no `refactor` commit exists in the range, and the repository was introduced inside `3fe3698` (a `test+impl`). The plan now reads as if that commit is in history. Separately, C7b lists `B10, B11, B12, B18, B19` while the commit closing it also claims `B4` — which C3's own note says belongs there.
*Fix:* strike C8 or mark it absorbed; add B4 to C7b's ids.

**11. Minor — the primer overstates a Pydantic failure mode.** `docs/python-primer.md`, "Added in S3": "a validator that falls off the end returns `None` and silently **empties** the field." An after-validator returning `None` sets the field *to* `None`, not to an empty list — for `list[FeatureFlagVariant]` the model then holds `None` where the declared type says list, which is worse than empty.

*Verified accurate, for the record:* the ADR's claim that only the pinned-bucket test catches a `hash()` substitution (the other three in `test_assignment.py` are same-process determinism, a distribution band and a single-100 variant — all pass under a salted hash); the `clock_timestamp()` reasoning and its harness precondition; the `17.7B` figure, which is now consistent across the seed migration, both test builders and the ADR — the carried item in the project CLAUDE.md's "What's next" is resolved.

---

## ANGLE 3 — GIT HISTORY

Trailers are clean: 14/14 commits carry `Story: S3`. Distribution: 2 `chore`, 11 `test+impl`, 1 hybrid, 0 `refactor`.

**1. `d466631` — a hybrid subject the contract does not allow, over three unrelated changes.** "test+impl B15 **+ chore**: forwarded headers, ADR-0003, primer and changelog" is both kinds at once and bundles a middleware/log change with its test, deployment wiring (`backend/Dockerfile` CMD, `frontend/nginx.conf`), and 152 lines of documentation. Worse, `docs/plan.md` — updated in this same story — explicitly classifies B15 as "a `[chore]`, verified on the running stack, **not a unit test**", so the commit's own `test+impl B15` label contradicts the plan shipping beside it, and the 9-line test it added cannot exercise B15's mechanism (Angle 2 #4).
*Fix:* three commits — `test+impl B15` (middleware + test), `chore` (Dockerfile + nginx), `chore` (ADR + primer + changelog).

**2. `31067e0 chore` carries product behaviour.** "chore: feature_flag, visitor and visitor_assignment tables **with the seeded flag**" — the seed migration writes the live experiment's copy, weights and enabled state: the text every visitor reads, and the data every later test's "seeded world" assumes. "No behaviour" is not true of it, and nothing in the range asserts the seeded flag's shape.
*Fix:* keep the DDL as `chore`, land the seed as `test+impl` with a test that reads it back through `GET /api/feature-flags` — or argue the exemption in the body.

**3. `21f0cc0 test+impl B20` carries config no test demands.** `.env.example` and the `docker-compose.yml` `ADMIN_TOKEN` default ride along with the settings test. Defensible (the stack won't boot without them, and the body says so) but it is chore content inside a `test+impl`.

**4. `29f6540 test+impl F5, F6, F9` introduces shared infrastructure no listed case needs.** `frontend/src/styles/tokens.scss` is a new design-token file whose own comment says D1 will fill it in, and two of its three tokens have no consumer (Angle 1 #8). The `/admin` route in `App.tsx` is load-bearing for the cases; the tokens file is chore/infra.

**5. `88c7aec test+impl B4, B17` adds two pure functions to `assignment.py` without extending `test_assignment.py`.** `weights_cover_every_bucket` and `duplicated_variant_keys` are covered only indirectly through the schema tests in the same commit — which is how the false ordering docstring (Angle 2 #6) and the overstated raise docstring (Angle 2 #5) both got in unchallenged.

**6. No `refactor` commit in the range at all**, against a plan that lists one (Angle 2 #10). Not a violation on its own — worth naming only because the plan was left claiming it.

**7. Cosmetic:** co-author trailers switch mid-story — `Claude Fable 5.1` on the first twelve commits, `Claude Opus 5` on the last two — so one story's history reads as two authors.

---

### Most severe, if only three get fixed
1. Angle 1 #1 — the stale-closure save silently discards an operator's work (and Angle 2 #9 is its comment).
2. Angle 2 #1 — two docs cite a README security note that doesn't exist.
3. Angle 1 #2 — a lint rule blanket-disabled where the documented narrow composition would have passed unchanged.


---

## 3b. conventions — completion pass (resumed with context intact, verbatim)

> NOTE: this pass matters. The first report was delivered complete in structure, but the reviewer
> had not finished reading 8 of the 79 files when it wrote it. Reading them produced new findings
> and upgraded one from minor to mid-severity with an execution proof.

S3 review — completion pass. Three things asked, plus the reading I had not finished.

---

## 1. Did my report end where I intended?

**Partly — I'll be plain about it.** All three angles were analysed and delivered; nothing was sitting half-written when I stopped, and no finding was dropped. But the brief said "read the full current content of the files the diff touches," and I had **not** read eight of the 79 in full when I wrote the report:

`backend/tests/drivers/feature_flags_api.py`, `backend/tests/drivers/visitors_api.py`, `backend/tests/integration/test_visitors_create.py`, `test_visitors_get.py`, `test_feature_flags_list.py`, `backend/migrations/versions/75463482a98c_…py`, `frontend/src/providers/VisitorProvider.test.tsx`, `frontend/src/testkit/builders/visitor.ts`, and `Admin.module.scss` past line 60.

I had greps and per-commit stats across them, which is why I was confident about the history angle, but that is not the same as having read them. **I have now read all of them.** They produced two new minor findings (§4 below), one hard piece of evidence that settles Angle 1 #6, and a sharpening of Angle 1 #3. **No finding changed severity and nothing was retracted.**

## 2. Working-tree contamination — confirmed clean

**No finding was derived from a mutated file.** Verified at the new HEAD:

- `frontend/src/providers/VisitorProvider.tsx` — `git show HEAD:` output is byte-identical to what I read, and `git diff af1d115 -- <file>` is empty. More to the point: **no finding of mine cites that file.** Angle 1 #3 cites `VisitorProvider.driver.tsx` (a different file), and §Angle 1 #1 cites `Admin.tsx`.
- `eslint.config.mjs` — this is the one where I saw two different contents during the run. My `cat` showed a `pureFunctionTestSyntaxSelectors` version; the committed state was and still is `'no-restricted-syntax': 'off'`. **I built Angle 1 #2 from `git show HEAD:eslint.config.mjs`, not from the working-tree read** — confirmed again just now at HEAD. The finding stands against committed state.
- Range is as you describe: the same 14 code commits, now plus `af1d115`, `5b7f049`, `f22a1cf` (doc-only `chore` commits landing review reports). Those three are outside what I reviewed and I have no findings on them.

**One new hygiene item:** `frontend/src/pages/ZZopen.test.tsx` is sitting **untracked** in the source tree (1.5 KB, imports the real builders and model layer). It matches vitest's `*.test.tsx` glob, so it will execute as part of `pnpm test` while being invisible to `git` and to any diff-based review. Not part of S3 — flagging it because a passing suite that includes an untracked file is a false green.

## 3. Angle 1 #6 settled — deliberate fail-loud, genuinely reachable, keep it and test it

**Verdict: not Speculative Generality. Keep the `ValueError`, add a test.** I proved reachability by execution rather than reasoning:

```
TypeAdapter accepted a 90-sum row: [('calm', 50), ('urgent', 40)]
visitor with bucket>=90: vis_00000000000000000000000007  bucket 92
RAISED -> assign_variant: weights of flag 'result_screen_tone' cover only 90 of 100 buckets
          — bucket 92 for visitor 'vis_...07' is unassigned
TypeAdapter accepted []: []
RAISED -> ... cover only 0 of 100 buckets — bucket 48 for visitor 'vis_x' is unassigned
```

**Why it is reachable — the invariant is guarded on only one of its two paths.** "Weights sum to 100" is enforced *solely* by `FeatureFlagUpdate._reject_an_incomplete_or_ambiguous_split` (`schemas.py:67-83`), which sits on the HTTP **write** path. The **read** path — `repository.list_enabled_splits:27` → `TypeAdapter(list[FeatureFlagVariant])` — validates each variant's key pattern and `0 <= weight <= 100` but never the list-level sum, and never `min_length=1` (that too lives only on `FeatureFlagUpdate`). There is also **no CHECK constraint**: `migrations/versions/75463482a98c_…py:34` declares `variants` as bare `JSONB NOT NULL`.

So three concrete routes in:
- a hand-edited row (`UPDATE feature_flag SET variants = …` — psql, a restore, a data fix),
- `is_enabled = true` with `variants = '[]'`,
- **a future seed migration**, which writes raw JSON via `op.execute` and bypasses the Pydantic boundary entirely — exactly how the current seed (`9b3f1c2d4e5a:55-68`) inserts. Today's seed is 50/50 and safe; nothing structurally stops the next one from not being.

**Why the raise is right.** It fires inside `POST /api/visitors`, is unhandled, and becomes a `500 {"error": "internal error"}` via `CorrelationIdMiddleware`. That is the house rule working as intended — fail visibly rather than serve a silent fallback. The alternative (pick the last variant, or skip the flag) would silently mis-assign and poison the S7 z-test, which is precisely what ADR-0003 exists to prevent. The message is also a model on-call line: operation, flag key, expected-vs-found, visitor id.

**The sharper finding underneath it:** the 90-sum case raises for only ~10% of visitors — an intermittent 500 on the funnel's entry point, the nastiest failure shape there is, and one no test would catch today. The minimal fix is not to delete the raise but to **close the read-path gap**: reuse `weights_cover_every_bucket` in `list_enabled_splits` so a malformed stored row is rejected once, at load, with the flag key named — instead of surfacing as a probabilistic 500 per visitor. Either way it wants the two tests the execution above already writes for you (a 90-sum row, an empty-variants row).

I'd upgrade this from my original "minor" to **mid-severity**, and it now belongs just under Angle 1 #1.

## 4. New findings from the reading I finished

**A. Angle 1 #3 is worse than I reported.** The flag-key literal `result_screen_tone` has **17 occurrences across 10 files** — `test_assignment.py` (x4), `feature_flags_api.py:16`, `visitors_api.py:19`, the seed migration, `VisitorProvider.driver.tsx:20`, `Admin.driver.tsx:15`, `VisitorProvider.test.tsx` (x3), `visitor.test.ts` (x3), `builders/featureFlag.ts:32` — while `models/featureFlag/model.ts:34`'s `RESULT_SCREEN_TONE_FLAG`, the one constant declared to be its home, still has **zero** consumers. Two separate backend drivers each declare their own `RESULT_SCREEN_TONE = "result_screen_tone"` rather than sharing one.

**B. Inappropriate Intimacy across the driver boundary.** `backend/tests/drivers/feature_flags_api.py:33, 72, 73` reach into `self._http._last` — a private attribute of `HttpDriver` — and line 106 chains `self._driver._http.then.status(200)`. The composing driver is coupled to the composed driver's internals, so any change to how `HttpDriver` stores its last response breaks a file that never declared the dependency. *Fix:* a public accessor on `HttpDriver` (`last_json()` / `last_status()`).

**C. Four copies of the same test preamble.** `frontend/src/providers/VisitorProvider.test.tsx:6-11, 25-31, 58-63, 73-79` — four `describe` blocks, each repeating an identical `let driver` + `beforeEach(() => { driver = makeVisitorProviderDriver(); })`. One outer `describe` with nested blocks removes three copies.

**Nothing else new.** The integration tests (`test_visitors_create/get`, `test_feature_flags_list`) are clean and idiomatic — correct `given/when/then` namespaces, builders throughout, no raw asserts in bodies, and `test_a_visitor_keeps_the_assignment_made_at_creation_after_the_weights_change` is a genuinely good mutation-resistant test of the ADR's central claim. `builders/visitor.ts` follows the reassign-never-mutate canon. `Admin.module.scss:119-140` has a real mobile-first md breakpoint (single column → row, 720px reading width); I did not render it, so I make **no claim about how it looks** — that is the visual pass's call, not mine.

---

### Final severity order, unchanged at the top
1. **Angle 1 #1** — stale-closure save at `Admin.tsx:161` silently discards edits made during the round trip (`Admin.tsx:159-161`'s comment asserts the opposite).
2. **Angle 2 #1** — ADR-0003:79-82 and the changelog both cite a README security note; `README.md` is one line and contains no "admin"/"token"/"auth".
3. **Angle 1 #6 (upgraded)** — the weights-sum invariant is enforced on the write path only; a malformed stored row is an intermittent 500 on `POST /api/visitors`, proven reachable above.
4. **Angle 1 #2** — `eslint.config.mjs:32-35` blanket-disables `no-restricted-syntax` where the documented `pureFunctionTestSyntaxSelectors` composition would have passed unchanged (verified: no violation in either file in the glob).
5. **Angle 2 #2** — ADR-0003's "belt and braces" cookie is never read by any server code.
6. **Angle 3 #1** — `d466631`'s hybrid `test+impl … + chore` subject contradicts the plan it ships beside.

All other findings stand exactly as delivered in my first report.


---

## 2b. frontend — completion pass (resumed with context intact, verbatim)

> NOTE: this pass added three findings (16, 17, 18), two of them serious, and demonstrated the
> builder-aliasing finding that the first pass could only reason about. Mutation scoreboard went
> from 6 run / 5 killed to 20 run / 16 killed.

S3 frontend review — completion pass.

**Did my report end where I intended?** Yes, plainly. The sweep was finished and all 15 findings plus the clean-category list were delivered; nothing was half-written or dropped when I stopped. The three items you named were ones I deliberately labelled open/uncertain rather than ones I ran out of room for. Closing them was worth it: it materially upgraded two findings and surfaced **three new ones**, two of which are serious.

---

## Item 1 — what actually happens on a non-409 PATCH failure

I drove four failure shapes through the real component (temp test, since `given.theSaveFails` is unused). The operator sees the **raw backend string, verbatim**:

| PATCH response | what the operator reads |
|---|---|
| 500 `{ error: 'update_feature_flag: could not reach the database' }` | `update_feature_flag: could not reach the database` |
| 500, non-house body (e.g. nginx HTML) | `request failed with status 500` |
| 400 `{ error: 'update_feature_flag: variant weights must sum to 100, got 149' }` | `update_feature_flag: variant weights must sum to 100, got 149` |

**Is that the intended surface? No — it is inconsistent with the rest of the same state machine.** `MISSING_TOKEN_MESSAGE` ("Paste the admin token above before saving.") and `CONFLICT_MESSAGE` ("This flag changed somewhere else… Reload the page, then apply your change") are written as operator copy. The failure branch is the only one that isn't: it pipes a message written under the "error messages are on-call docs" rule — function-name prefix, expected-vs-found, meant for a log read at 2am — straight onto a product surface. The backend is doing the right thing; `Admin.tsx:170` is routing it to the wrong audience.

Two things I confirmed are fine: the Save button **is** correctly re-enabled after a failure (no dead-end), and `describeError`'s fallback handles a non-JSON proxy body without crashing.

Note the 400 row is finding 7 landing: the frontend already knows via `hasCompleteSplit` that the split is invalid, sends anyway, and then renders the backend's phrasing of what it could have said itself.

Minimal fix: give `SaveStatus.Failed` operator copy in `Admin.utils.ts` alongside the other two, and log the backend detail rather than render it. And use `given.theSaveFails` — it already exists.

## Item 2 — the builder seed: I broke it

Upgraded from "CONFIRMED (latent), reasoned" to **demonstrated**. Three assertions:

1. **The sharing is real and directly observable** (passed): two independent `aFeatureFlagDTO().build()` calls return different top-level objects but `a.variants === b.variants`, `a.variants[0] === b.variants[0]`, and `a.variants[0].config === b.variants[0].config`. Same for `aVisitorDTO().build().assignments`.
2. **One in-place touch corrupts every other build in the process** (broke as designed): `a.variants.reverse()` flipped `b.variants[0].key` from `calm` to `urgent` — on a DTO built by a separate builder instance, for a different test.
3. **The model layer is clean** (passed): `fromDTO` → `toUpdatePayload` copies at every level, so no production path reaches the shared objects today.

I then grepped every in-place mutator across `frontend/src` (`sort|reverse|push|pop|shift|unshift|splice|fill|copyWithin`): three hits, all on `fake-http`'s own `routes`/`requests` arrays, and the one `reverse()` copies first. **So: no live trigger — it stays latent.** But the accurate statement is "one `.sort()` away from cross-test corruption", not "probably fine", and the builder's own header comment claims immunity it only has at the top level. Minimal fix: deep-copy the seed in the field initialiser.

## Item 3 — the mutations I hadn't run

I had queued more and reached none of them. Ran 14 more (M7–M20). **Scoreboard: 20 mutations, 16 killed, 4 survived.**

Killed: StrictMode single-flight ref · `setLockToken` round trip · 404→create recovery · `storeVisitorId` · `toUpdatePayload` field set · `variantFor` assignment lookup · `setVariantCopy` immutability · `replaceFlag` · missing-token guard · `hasCompleteSplit` · `fromDTO` lock token · `normaliseNulls` · the 409 branch · `toggleEnabled` · the admin-token header · `readStoredVisitorId`.

Three **new** findings from the survivors, continuing the numbering:

### 16. CONFIRMED — `Admin.tsx:142-144, 181-187` — the enabled checkbox is wired to nothing and the suite does not notice
Mutation M17 replaced `handleToggleEnabled` with an empty body: **59/59 still pass.** This is the single most consequential control on the page — whether the experiment runs at all — and it has zero component-level coverage. `toggleEnabled` is tested as a pure function (`featureFlag.test.ts:95`), but nothing proves the checkbox is connected to it.
Scenario: operator unchecks "Running", clicks Save, reads "Saved." — and the experiment keeps assigning visitors. (The controlled `checked={flag.isEnabled}` would snap the box back, so a careful human might catch it; no test would.)
Minimal fix: a driver `click.enabled()` + `assert.saveCarried({ isEnabled: false })`.

### 17. CONFIRMED — `Admin.tsx:200` — `disabled={isSaving(save)}` is load-bearing and untested
Mutation M12 replaced it with `disabled={false}`: **59/59 still pass.** I then proved the guard is what does the work today: with the PATCH adapter gated, three rapid clicks produce exactly **one** PATCH carrying token `T1`, button `disabled: true`.
Why this matters more than a normal untested guard: it is the only thing preventing overlapping saves of one flag, and finding 1 makes overlap actively destructive — three clicks would send three PATCHes all carrying `T1`, the first wins, the second and third 409, and each resolving `.then` replays its own stale snapshot over the operator's later edits.
Minimal fix: a test that clicks twice against a gated save and asserts one PATCH.

### 18. CONFIRMED — `api/feature-flags.ts:24` — `encodeURIComponent` on the flag key is untested (low)
Mutation M20 removed it: **59/59 still pass.** A no-op today (keys are backend-issued snake_case), so severity is low — but it is a fourth untested production line.

### Also worth a line — coverage resting on a builder ordering coincidence
M7 (`variantFor` ignores the visitor's assignment and always serves `variants[0]`) killed only the two tests that assert the **urgent** headline. Both `calm` tests pass a `variantFor` that ignores assignments entirely, because `calm` happens to be `variants[0]` in the builder seed. Reorder the seed array and coverage silently shifts — another consequence of finding 6 (hardcoded builder defaults).

---

**Untested production branches, consolidated:** the `cancelled` unmount guard (`Admin.tsx:56-71`, M3), the save-disabled guard (M12), the enabled-checkbox wiring (M17), `encodeURIComponent` (M20), and the entire non-409 save-failure path (item 1, `given.theSaveFails` unused). All five sit inside `FlagEditor` — which is finding 14: the component that owns the save state machine has no file, driver or test of its own.

**Verification state:** all mutations reverted, all temp files deleted, `pnpm vitest run` 59/59 green, `eslint . --max-warnings 0` clean.

