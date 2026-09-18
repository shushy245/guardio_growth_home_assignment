# D1 — Claude Design prompt

Written 2026-09-18 at the D1 pause point (`docs/plan.md` → "D1 — Claude Design handoff"). Shalev
runs the prompt below in Claude Design and brings back the output; S5 implements that output, and
every deviation is listed in `docs/plan.md`, never made silently.

Everything the prompt asks for is traceable to a plan section: the screens to E1's story
objectives, the reflows to the "Responsive contract", the copy to the seeded feature flag, the
numbers to the live `/api/breaches/summary`, and the three measured constraints to the S3 visual
review (`docs/reviews/s3-fixes-visual-review.md`).

**What to bring back** (the exit criteria in the plan): a token list, the component inventory with
states, every screen at 390 / 768 / 1280, and any exported HTML/CSS. The three carried findings
(disabled-control contrast, 16px body floor, 45–75 character measure) must be answered by a token,
not a one-off override.

---

## Paste from here

You are designing the screens of **Breach Scan**, a mobile-web growth funnel for Guardio, a
consumer browser-security product. Design the full system: tokens, components, and every screen at
three widths. I will implement it as a React app with CSS modules, so precision and consistency
matter more than variety.

### 1. Product context

A visitor lands on a page, taps **Scan known breaches**, watches a short scanning moment, and
arrives on a **result screen** that shows the public record of data breaches (from Have I Been
Pwned: about 1,031 breaches, 17.7 billion exposed accounts). The result screen's job is to turn
that public record into a reason to buy protection. A **Protect me** call to action leads to a
mock sign-up (plan picker, email, password), and a **You're protected** confirmation closes the
funnel.

There is one A/B test, driven by a feature flag: the result screen's **tone**. The **calm**
variant and the **urgent** variant share one layout and one component tree; only copy and tone
tokens differ. Both variants must be designed side by side, from the same components.

The audience is a consumer on a phone, arriving from an ad. Design at **390px first**. The same
screens must hold at **768px** and **1280px** without a separate desktop design, because a
reviewer opens this on a laptop before they ever open it on a phone.

Tone of the system: trustworthy, direct, modern consumer security. Not enterprise dashboard, not
scare-ware. The urgent variant is urgent through copy, a warm accent and a count-up, never through
red-on-red panic.

### 2. Screens, in funnel order

Design each screen at 390, 768 and 1280. Every interactive state and data state listed below is
a frame, not a note.

**S-1 Landing** (`/`)
- Hero headline, one supporting sentence, a primary button **Scan known breaches**, three short
  trust points (public data, no email needed, takes seconds), a small Guardio wordmark placement.
- States: default only. Above the fold at 390 the button must be visible without scrolling.

**S-2 Scan moment** (`/scan`)
- A full-screen "scanning" state that lasts about two seconds: a progress indicator, a one-line
  status ("Checking 1,031 known breaches…"), calm motion. Design a reduced-motion version too.
- States: scanning; **error with retry** ("We couldn't reach the breach record. Try again").

**S-3 Result — the centrepiece** (`/result`). Shown in both variants, side by side, same layout.
- **Header region**: variant headline, variant subheadline, and the CTA placement (see reflow
  rules). Seeded copy, editable by product so leave room for longer strings:
  - calm: headline "Known breaches", sub "Here's the public record of data breaches.",
    CTA "Protect me".
  - urgent: headline "You're exposed!", sub "17.7B accounts have leaked. Yours could be among
    them.", CTA "Protect me now". The urgent variant shows the accounts-exposed number counting up
    once on arrival.
- **Summary tiles**, four of them, each an answer to "why should I care":
  - Breaches in the last 12 months: **102**
  - Accounts exposed: **17.7B**
  - Breaches that leaked passwords: **65%**
  - Largest breach: **Synthient Credential Stuffing Threat Data**, 1.96B accounts, 2025
  - A one-line "record synced 2 hours ago" note belongs somewhere near the tiles.
- **Filters and sort**, one thumb away:
  - Text search on name or domain.
  - Data-class chips that scroll horizontally on the phone: Email addresses, Passwords, Names,
    Usernames, IP addresses, Phone numbers, Dates of birth, Physical addresses. One chip selected
    at a time; tapping the selected chip clears it.
  - A **Verified only** toggle.
  - A sort segmented control: **Newest** (default), **Most accounts**, **Name**.
  - A results line "Showing 20 of 1,031" and a **Clear filters** action that appears only when a
    filter is active.
- **Breach list**, 20 per page, **Load more** at the bottom. A row shows: logo (48px, may be
  missing, design the fallback), title, domain, year, humanised count ("8.8M accounts"), data-class
  badges with **Passwords** visually distinct from the rest, a verified mark. A row can be
  expanded to reveal a short description paragraph. Realistic rows to use:
  - Manchester Airports Group · magairports.com · 2026 · 8.8M · Email addresses, Phone numbers,
    Names, Purchases, Vehicle registration plates · verified
  - McKesson · mckesson.com · 2026 · 6.4M · Email addresses, Names, Passwords · verified
  - Synthient Credential Stuffing Threat Data · 2025 · 1.96B · Email addresses, Passwords
  - A row with no domain and no logo.
- **CTA**: a sticky bottom bar on the phone holding the variant CTA button. See reflow rules for
  what it becomes on wider screens.
- States for this screen: **loading** (skeleton tiles and skeleton rows, the header and filters
  already rendered); **loaded**; **filter with zero results** (an explicit empty state with a
  Clear filters action, visually distinct from an error); **list error** ("Couldn't load breaches"
  with Retry, never an empty list); **load-more in progress**.

**S-4 Sign-up** (`/signup`)
- A plan picker with exactly two options, **Basic** and **Family**, one selected at a time, with a
  price line and two benefit bullets each.
- Email field, password field, primary button **Start protection**. Copy states this is a demo and
  nothing is charged.
- Password field states: **default**; **checking** (a quiet inline spinner while the password is
  checked against a public leak list); **leaked warning** ("This password appeared in 3,120,000
  leaks. You can still continue, but change it where you use it."), which does not block
  submission; **couldn't check** (a soft note when the check service is down, does not block);
  **validation error** (invalid email, password under 8 characters).
- Submitting state, and a **server error** state ("That email already has an account").

**S-5 Protected** (`/protected`)
- Confirmation: a success mark, "You're protected", the chosen plan, two next steps (install the
  extension, add a family member), a secondary link back to the results.

**S-6 Experiment dashboard** (`/dashboard`) — optional, same system.
- A product manager's read of the test: a hypothesis card, a funnel chart with one series per
  variant (landing → scan started → scan completed → CTA click → sign-up started → activation),
  a lift card with confidence interval and p-value, a recommendation banner in one of three
  states: **Ship variant**, **Keep control**, **Keep running** (the last shows required versus
  current sample per arm).
- States: loaded; keep-running; error.

**S-7 Admin** (`/admin`) — not to be redesigned, only re-tokened.
- It already exists and is deliberately plain: a token field, one card per feature flag with a
  Running checkbox, two variant cards (headline, subheadline, CTA label, share of traffic), a
  Save button, and a status line. Show it once at 390 and 1280 using the system's tokens, so the
  form field, button and message styles you define are proven on a plain form as well as on the
  funnel.

### 3. Reflow rules (mobile first; the desktop layout is designed here, not improvised later)

One DOM tree serves every width. Nothing is added or removed at a breakpoint; things move and
resize. Breakpoints are exactly three: **390 (base), 768, 1280**.

- The **sticky bottom CTA bar** at 390 becomes an **inline CTA in the header region** at 768 and
  above. It is the same button; it is not duplicated.
- The four **summary tiles** are a 2×2 grid at 390 and a single row of four at 768 and above.
- The **result list** gets a maximum content width at 1280 and centres; it never stretches across
  a 1920px window. Every page gets a reading-width cap.
- **Filter chips** scroll horizontally at 390 and simply wrap once they fit.
- The **sign-up** form stays a single column at every width, capped in width and centred.
- The **dashboard** stacks its cards at 390 and sits the funnel chart beside the lift card at
  1280.
- Show, for each screen, what changes between 390 and 768 and between 768 and 1280, in one line
  each.

### 4. Hard constraints the implementation must inherit

These are measured in review with a script, not eyeballed. Bake them into tokens.

- **Body text is never below 16px** at any width. Notes, captions, labels, status messages and
  form helper text included. Use weight and colour for hierarchy, not size below 16.
- **Every text and control colour pair meets 4.5:1**, including **disabled buttons**. The current
  admin page fails this: the disabled Save button renders white on `#93a3b5` at 2.58:1, and that
  button is disabled during the entire save, so the lowest-contrast element on the page is the
  one carrying the in-progress signal. Define a disabled style that passes without looking
  enabled: keep the text at 4.5:1 and signal "disabled" with fill, border or opacity on the
  container.
- **Line length stays between 45 and 75 characters** for running text at 768 and 1280. The
  current admin page measures 96–101. The answer is a measure token (a max-width in `ch` or px for
  prose blocks), applied by default to any paragraph, not per page.
- **Tap targets are at least 44×44** on every interactive element, including chips, the verified
  toggle, the segmented control and expand affordances on rows.
- **Page gutter is 16px at 390**, larger at 768 and 1280; no horizontal scroll at any width.
- **Layout is flex-only**, no CSS grid. Everything is rows and columns; the 2×2 tiles are two
  rows of two.
- **Motion respects `prefers-reduced-motion`**: the count-up, the scanning animation and any
  skeleton shimmer have a static equivalent.
- Semantic landmarks: one `main` per page, a `header` where there is a header region, a `nav` for
  the filter bar if it behaves like one.

### 5. What I need back, in this order

1. **Tokens**, as a flat list of named values I can copy into SCSS variables: colour (background,
   surface, text primary/secondary, border, brand, accent, the calm tone set and the urgent tone
   set, success, warning, danger, disabled fill and disabled text, focus ring), type scale (family
   stack, sizes from 16 up, weights, line heights), spacing scale, radii, shadow or elevation,
   the prose measure, the content max-width, the three breakpoints. Name the two tone sets so a
   `toneClassMap` can select one without an if-chain: every token that differs between calm and
   urgent has the same name with a different value in each set.
2. **Component inventory**, named, with the states each has. I will name React components and
   their test drivers after this list, so choose names you would put in code. Expected members,
   extend or rename as you see fit: `Button` (primary, secondary, ghost; loading, disabled),
   `StickyCtaBar`, `SummaryTile` (loaded, skeleton), `SearchField`, `FilterChip` (idle,
   selected), `ToggleField`, `SegmentedControl`, `ResultsLine`, `BreachRow` (collapsed,
   expanded, skeleton, no-logo), `DataClassBadge` (plain, passwords), `VerifiedMark`,
   `LoadMoreButton`, `EmptyFilterState`, `ErrorState` (with retry), `PlanCard` (idle, selected),
   `TextField` (idle, focus, error), `PasswordField` (idle, checking, leaked, unchecked),
   `StatusMessage` (info, success, warning, error), `Skeleton`, `ProgressIndicator`, `HypothesisCard`,
   `FunnelChart`, `LiftCard`, `RecommendationBanner` (ship, keep-control, keep-running).
3. **Every screen at 390, 768 and 1280**, every state listed in section 2, and the result screen
   in both variants side by side at each width.
4. **Exported HTML/CSS** for the result screen at least, if the tool can produce it, so spacing
   and type values are exact rather than read off a picture.
5. A short list of **decisions you made that I did not specify**, so I can record them as design
   decisions rather than rediscover them in code.

### 6. Do not

- Do not design a separate mobile and desktop screen; design one screen and state its reflows.
- Do not introduce a second CTA element for desktop.
- Do not use size below 16px to create hierarchy.
- Do not make the urgent variant a different layout, a different component set, or a red page.
- Do not fill the empty-filter state with the same visuals as the error state.
- Do not add screens, steps or fields beyond what is listed; the funnel is five steps on purpose.
