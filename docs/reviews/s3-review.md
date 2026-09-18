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
- [ ] visual

**If this file still shows unchecked boxes and no session is running, the review did not finish.**
Re-run it from the tag: the diff is `story/S3..HEAD` and nothing about it is lost. An unfinished
review is not a clean one.

---
