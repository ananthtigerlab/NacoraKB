# futureplan.md

Parked work — ideas discussed but not implemented. Read this before starting a new session so you don't accidentally re-do what was consciously deferred.

Newest entries at the top of each section.

---

## 1. Source attribution on content pages

**Status:** deferred (2026-07-03).
**Context:** every KB page is a merged synthesis of code + KT doc + slides + official docs + Jira. The user wants to see which sources contributed to which passages. The current pages carry ticket keys inline (e.g. "from I2G-29988") but no source-tags for code / KT / slides / docs — those got blended into free-flowing prose during the synthesis passes.

Four options were discussed, from cheap-and-coarse to expensive-and-precise. **We picked "not now — revisit later"** — this file is the future-plan.

### Option A — Page-footer Sources only (Recommended when we come back)

A compact muted `Sources: ...` footer at the bottom of every page. Format:

```markdown
---
*Sources: Code (`src/clients/nacora/`), KT doc (23 Jun 2026), Official docs (nacora-docs.i2go.io), Jira tickets: I2G-29988, I2G-30189, I2G-30081*
```

- **Precision:** coarse (per-page).
- **Honesty:** 100% — the categories are known from session history.
- **Cost:** ~1 hour. One pass over ~78 pages.
- **UI change:** minimal. Style the footer via a CSS class (`.page-sources` → small, muted colour).
- **Where per-page source lists come from:** session log + inline ticket keys already sprinkled through the prose. For each page, cross-reference against the Agent A/B/C/D briefs to know which of Code / KT / Slides / Official-docs / Jira contributed.

### Option B — Page footer + section badges

Same footer as A, plus a small `> Sources: X, Y` blockquote under each H2 heading.

- **Precision:** medium (per-section).
- **Honesty:** partly retro-guessed — some sections cleanly map to one source, others don't.
- **Cost:** ~2 hours (adds one agent pass per page to tag sections).
- **UI change:** style the section-source blockquote via CSS (muted, small).

### Option C — Full hover-level via re-synthesis (Most detailed)

Re-synthesise every page with inline `[[src:X]]` markers baked in during generation, then render markers as hover tooltips.

- **Precision:** fine (per-sentence).
- **Honesty:** 100% — markers are attached at generation time, not retro-guessed.
- **Cost:** ~2-3 hours of parallel agent work + UI extension for hover rendering.
- **UI change:** either
  - **Custom BlockNote inline-content type** — a new inline node that renders as a small superscript ⓘ visible on hover.
  - **Client-side scanner** — scan block content on render, wrap `{{src:X}}` markers in `<span title="...">` for native browser tooltips.
- **Storage format options** for the marker:
  - Markdown-native footnote syntax: `Nacora is K+N's insurance arm.[^slides]` — clean, but has to be lifted through the markdown → BlockNote → back-to-markdown pipeline.
  - Custom inline syntax: `{{src:slides|kt-doc}}` — flexible, needs a small parser step in `markdownToBlocks`.
- **Best done during re-synthesis, not after.** Model outputs the markers as it writes.

### Option D — Retro-tag existing prose with AI guessing

Skip re-synthesis; feed each page + source pool to the model and ask it to tag sentence-by-sentence.

- **Precision:** fine (per-sentence) but **inaccurate** — ~30% of tags will miss a co-contributor source.
- **Honesty:** low — model has to guess where content came from.
- **Cost:** ~1 hour parallel-agent work.
- **UI change:** same as Option C.
- **Not recommended** — the retro-guess quality doesn't justify the UI work.

### When we revisit

Start with **Option A** as the baseline (page footer). It's honest, cheap, and gives most of the value ("which sources feed this page?"). If the user still wants per-line hover after A is live, that's the moment to invest in **Option C** — do it right rather than retro-guessing.

---

## 2. Other deferred work (from CLAUDE.md's "next-phase ideas")

### 2.1 Wire real OAuth for Google Docs / Slides / Figma connectors

Currently supports link-shared Google Docs only (no OAuth flow). Figma is entirely blocked. Post-MVP work: proper OAuth per provider, secrets in `.env`, refresh-token handling.

### 2.2 pgvector semantic search (Phase 4 completion)

`lib/embeddings.ts` has the seam ready. Blocked on PGlite shipping the pgvector extension. When it does: enable the extension in migrate, populate embeddings on page save, wire the search bar to run vector search alongside keyword FTS.

### 2.3 Trusted auto-merge toggle (Phase 4 completion)

Settings already store the flag (`auto_merge_enabled`, `auto_merge_scopes`, `auto_merge_max_pages`). No UI to toggle it. Post-MVP: add a settings screen; on approval flow, if auto-merge is enabled for the target space, skip the human review and merge directly (still audit).

### 2.4 Incremental sync via cron

Currently manual — the BA clicks "Sync now". Post-MVP: `node-cron` schedule (e.g. daily at midnight) triggers the incremental sync automatically. Config would live under `lib/code-sync/schedule.ts`.

### 2.5 Export to PDF / Confluence

For handover: the whole KB as a single PDF, or push each space into Confluence. `weasyprint`-equivalent on the server side (via Puppeteer) would be the simplest path.

### 2.6 InSurance Jira correction (session record)

Earlier we pulled Jira tickets on the filter `cf[10101] = "Nacora"` — that returned NBMS (the sister broker system), not the MGA product. The **correct** MGA-product filter is **12060**. If a future session needs to refresh MGA work-items, use filter 12060, not the PRD's original seed URL.

### 2.7 Populate the client-foundation → key-people page properly

The current key-people.md is a placeholder — we never got the actual delivery team roster. Post-MVP: BA fills in the PM, tech lead, BA, QA, DevOps, Client SPOC, Nacora SPOC from the delivery kickoff deck.

---

## 3. Known limitations to fix opportunistically

### 3.1 Two Jira projects, one KB

MGA product tickets (filter 12060) and NBMS broker-system tickets (`cf[10101]="Nacora"`) both exist. The KB's Work Items page keeps them distinct, but a future session could accidentally re-pull the wrong filter. Update the seed URL in the PRD when you get the chance.

### 3.2 Figma board is auth-walled

The Nacora MGA Embedded Cargo Figma board is behind K+N Figma auth. Our MCP Figma tool doesn't have access; the local `.jam` file is Figma-proprietary binary. Not solvable without escalation to the Figma-file owner. User Journeys & Screens is written from code + docs alone as a result — flag this if the design content diverges from the code.

### 3.3 Bulk-uploaded shipments bypass business rules today

Documented on `bulk-upload.md` and `business-rules.md`. Ticket I2G-29926 is the post-MVP fix. When it ships, both pages need updating to say the bypass is gone.

### 3.4 Manual `Sources` for Client Foundation pages

Client Foundation pages (Client Overview, How They Operate, Products & Offerings, Organisation Tree, Key People, Glossary) were populated from the slides + KT. When we implement Option A above, those pages should say "Slides, KT doc" rather than "Code" — small distinction that matters.

---

## 4. Small things worth doing next session

- Re-check the seed-runner's PRODUCT candidate list — the 4 new pages from Jira 12060 (embed-dashboard, sanctions-and-compliance, cluster-level-configuration, shipment-preference-persistence) are currently picked up as extras. Adding them to the candidate list would give them a stable sidebar position rather than alphabetical drift.
- Verify Storybook is actually still maintained on frontend/libs/nacora/ui/ — the Technical / Frontend Architecture page mentions Storybook conditionally. Confirm before promising it to a new engineer.
- Update SESSION-LOG.md at the end of each session (I've been doing this in bulk; better cadence is one entry per material session).
