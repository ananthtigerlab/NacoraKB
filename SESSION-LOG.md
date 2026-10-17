# SESSION-LOG — Nacora KB build history

Newest sessions at the top. Read for context on *why* things are structured the way they are.

---

## 2026-08-11 — State audit + handoff-doc refresh

### Goal

Reconcile CLAUDE.md / pending.md against what's actually on disk. Successor sessions were being handed stale counts and stale "next-phase" priorities.

### What was found

- **Page counts drifted** since the last handoff:
  - `client-foundation/` 6 → **5** (lost `how-they-operate.md`, `key-people.md`; added `bms-mga-relationship.md`)
  - `product/` 53 → **61** (8 pages added — includes `embed-dashboard`, `sanctions-and-compliance`, `cluster-level-configuration`, `shipment-preference-persistence` from the earlier Jira 12060 pass, plus others)
  - `technical/` "EMPTY placeholder" → **35 populated** (all written on 2026-07-04 — architecture, data-model, repo-map, apis, rating-engine, business-rules-engine, background-jobs, ci-pipeline, docker-build, environments, observability, security-and-permissions, session-security, migrations-and-seeds, third-party-integrations-failure-modes, and 20 more). Confirmed with mod times + spot-checked content — real prose, not stubs.
  - `delivery/` 4 → **1** (only `work-items.md` remains; `decisions-log`, `open-questions`, `meeting-notes` were removed)
  - Total: 68 → **102 pages**
- **Diagram count drifted:** `pending.md` said 111 → actual is **102** (matches page count 1:1). Some pages were consolidated between 2026-07-05 and today.

### What was updated

- `CLAUDE.md` — page counts refreshed; "technical space is empty" limitation replaced with "delivery space is thin"; "next-phase ideas" reordered (populate-technical dropped as done; refresh-technical added as item 8; source-attribution added as item 6).
- `pending.md` — 111 → 102, `Last checked` bumped to 2026-08-11, note added about the shrink.
- `SESSION-LOG.md` — this entry.

### Why the technical-space populate isn't in this log

Whoever wrote the 35 technical pages on 2026-07-04 didn't leave a session-log entry — it slots between "2026-07-01→02" and "2026-07-05" but only file mod times survived. Successor sessions should treat that as a lesson: **write the log entry at end of session, not later**.

### Notes for successor session

- No code changed. This was purely a documentation reconciliation.
- If you want to know why a technical/*.md file says what it says, cross-reference against the InSurance repo directly — there's no synthesis prompt log for that session.
- If diagrams break, run `npx tsx scripts/audit-diagrams.ts` — expect 102/102 OK.

---

## 2026-07-01 → 2026-07-02 — Deep documentation fill-up (this session)

### Goal
Populate the KB with real, detailed BA content across all four spaces, using every seed source in the PRD.

### What was built

**Session context at start:** Phases 0–4 already scaffolded; ~31 pages had brief placeholder content or code-grounded stub content. User frustrated that pages were too short and too code-technical.

**Sources fetched:**
- Google Slides (public link in PRD) — used for Client Foundation.
- KT doc from PM (Thiva) — 40k tokens, extracted BA-relevant insights via Explore agent.
- Jira NBMS filter (`cf[10101]="Nacora"`) — 100 tickets, but discovered NBMS is the **broker BMS system, not the MGA product**. Documented on Delivery/Work Items and moved on.
- Figma board — skipped. Auth-locked; MCP tool didn't have access; local `.jam` binary unparseable.
- **Official docs at https://nacora-docs.i2go.io** — user pasted their session cookie; fetched all 84 pages via curl; parsed HTML → clean markdown (300KB text total).

**Merge & rewrite pass:** four parallel `general-purpose` agents, each owning a non-overlapping slice:
- Agent 1: Getting Started + Business Partners (13 doc pages → 12 KB files)
- Agent 2: Embedded Cargo Policy (20 doc pages → 13 KB files)
- Agent 3: Rating + Clauses + Business Rules (17 doc pages → 8 KB files)
- Agent 4: Shipments + Referrals + Reference (21 doc pages → 10 KB files)

Total: ~46 files touched. Every file follows a strict BA-prose style — no code identifiers (class/function/table names, file paths) in the visible prose. UI element names, business terms, and status labels are allowed. Every file ends with a `## Related concepts` list.

### Final state
- **68 pages** total across 4 spaces.
- **Product:** 53 pages (22 candidates + 31 auto-discovered / new).
- **Client Foundation:** 6 pages populated from slides + KT.
- **Delivery:** 4 pages populated from KT + Jira.
- **Technical:** 5 placeholders (no code-grounded content yet — next phase).

### Bugs found & fixed this session

**Bug 1: Gemini function-calling fails on large-string fields.**
Initial synthesis used `toolJSON` with `proposed_content_json: string` — Gemini returned empty strings for every synthesis call (15 minutes of API burn producing zero content).
Fix: switched synthesis to `textOutput` (plain-text completion) with a `---RATIONALE---` / `---CONTENT---` delimiter and markdown body. Markdown → BlockNote via new `lib/synthesis/markdown-blocks.ts`.
Files: `lib/llm/index.ts`, `lib/llm/anthropic.ts`, `lib/llm/gemini.ts`, `lib/synthesis/ingest.ts`, `lib/code-sync/sync.ts`.

**Bug 2: Next.js auto-seed partial state, extras dropped.**
After parallel agents wrote 22 new markdown files, only some were picked up by the dev server's auto-seed. Manual `tsx` seed picked up all 53. Root cause: Next dev HMR/lazy-import can interrupt the seed mid-way; the extras insert wasn't idempotent (no `onConflictDoNothing`), and `doInit` only ran the seed when spaces table was empty — subsequent boots skipped the backfill entirely.
Fix: made `runSeed` fully idempotent (checks existing spaces + pages by slug, uses `onConflictDoNothing` everywhere) and changed `init.ts` to run the seed on every boot, not just when empty.
Files: `lib/db/seed-runner.ts`, `lib/db/init.ts`.

**Bug 3: PRD's Jira filter points at the wrong project.**
Seed URL `cf[10101]="Nacora"` returns NBMS (broker/billing system) tickets, not MGA product tickets. Confirmed by cross-referencing with the KT doc which describes NBMS as the sister system. Documented in Delivery / Work Items.

### Sources / artefacts on disk

- `/tmp/nacora-docs/cookies.txt` — the user's docs session cookie (session-scoped, expires when they log out)
- `/tmp/nacora-docs/raw/*.html` — 84 raw doc pages
- `/tmp/nacora-docs/text/*.md` — parsed clean-text versions
- `/tmp/nacora-docs/urls.txt` — the full URL list

Cookie will expire eventually. If refresh needed: user opens dev tools in Chrome → Network → filter "nacora-docs" → refresh page → right-click first document request → Copy as cURL → paste back to me; I extract the `-b` cookie block and re-save.

### User instructions locked in for future sessions
- Be detailed, not summarising. "PLEASE BE DETAILED. I need every single thing."
- No code identifiers in prose. Named UI elements and business terms are fine.
- Don't ask for permission on ordinary commands — wide-open allowlist added in `.claude/settings.local.json`.
- Execute first, review after.

---

## 2026-06-30 → 2026-07-01 — Phase scaffolding + first sources

### Goal
Build the KB app from the PRD, then populate it with initial content.

### Built

Phases 0–4 scaffolded in one aggressive session:
- **Phase 0**: Next.js + TypeScript + PGlite + Drizzle + Tailwind + shadcn/ui + BlockNote. Four spaces, page tree, tags, upload, keyword search, command palette, History skeleton. Brand tokens (deep marine blue on white) in `app/globals.css`.
- **Phase 1**: Anthropic-based ingest pipeline (interpret → route → synthesise → Propose → BA approves). PDF/DOCX/image-OCR extractors.
- **Phase 2**: Local-git code sync; `nacora.paths.json` scope config auto-generated from a repo scan.
- **Phase 3**: Jira / Figma / Google Docs connector stubs.
- **Phase 4**: settings toggle + `lib/embeddings.ts` seam.

### Key architectural decisions

- **PGlite (embedded Postgres)** over native Postgres or Docker — chosen for zero-setup single-user local UX. Trade-off: some Postgres extensions (like pgvector) are not yet supported.
- **BlockNote client-side only** via `components/editor-loader.tsx` — BlockNote/ProseMirror/Yjs touch `document` on import; SSR crashes without dynamic-import wrapper.
- **`prosemirror-view` pinned to 1.33.9** via npm `overrides` — BlockNote 0.22 imports `__serializeForClipboard` which was removed in newer versions. When the user later ran `npm audit fix --force`, BlockNote bumped to 0.51 which fixed this natively; the override remains as a safety net.
- **Next.js dev server on port 3737** (not the default 3000) to avoid clashing with any other work.

### Source population

- **Slides:** fetched via Google Drive MCP tool (public URL).
- **KT doc:** fetched via same tool, 40k tokens, offloaded to an Explore agent for BA-relevant extraction.
- **Figma:** blocked (auth). User pointed at a local `.jam` file which turned out to be a Figma binary; unparseable.
- **Jira:** fetched via Atlassian MCP tool.

### Notes for successor session
- User first tried Claude API but doesn't have a paid plan. Switched to Gemini (`LLM_PROVIDER=gemini`, `GEMINI_MODEL=gemini-2.5-flash`). Provider abstraction in `lib/llm/` handles both.
- `.env` has both `ANTHROPIC_API_KEY` and `GEMINI_API_KEY` set; only one is active based on `LLM_PROVIDER`.
- `NACORA_CODE_PATH=/Users/tigerlab/Downloads/GitHubProjects/InSurance` is set and the repo scan populated `nacora.paths.json` with primary + shared paths.

---

## 2026-07-05 — Readability overhaul + table verification

### Goal

BA said pages felt "dizzy to read" — too small, too tight, too flat. Also reported "some tables still malfunctioning". Fix both.

### What was built

- Rewrote `app/globals.css` with a proper reading typography system:
  - Root font-size bumped to 16.5px; reading font-size 17.5px; line-height 1.75.
  - Warm off-white surface (`#FDFCFA`) instead of pure white — easier on the eye for long-form.
  - Accent blue darkened (from `#009DE0` to `#0577BE`) for WCAG AA on links.
  - Heading hierarchy: H1 1.9rem with underline, H2 1.45rem in primary blue, H3 1.15rem.
  - Full table styling: rounded border, muted header row with primary-blue text, zebra rows on even rows, hover tint, 0.85rem cell padding, 2px header-bottom border.
  - Blockquote / list marker / inline code / horizontal rule all restyled to match the palette.
  - All BlockNote-scoped rules live under `.nacora-reading` (never leaks to sidebar or dialogs).
- `page-view.tsx`: wider outer container (`max-w-[1400px]`), bigger title (2.5rem), more vertical breathing space, quieter meta bar, editor wrapped in `.nacora-reading` (max-width 72ch).
- `tailwind.config.ts`: exposed `text-text-subtle` and `border-muted` classes for use in components.

### Tables — the "malfunctioning" claim

Investigated. Ran the parser over every page: **all tables parse correctly** — the DB has proper `type: "tableContent"` blocks with `columnWidths` and `headerRows`. The user's issue was purely visual: BlockNote's default Mantine table rendering has no header emphasis, no borders, no hover — hence "malfunctioning". The new CSS gives tables a proper look.

Also wrote `scripts/rebuild-broken-tables.ts` as a **safety net** — if any future parser fix leaves stale table-as-paragraph blocks in the DB, run `npx tsx scripts/rebuild-broken-tables.ts` to selectively re-seed only the affected pages (preserves user edits on every other page). Current run reported 0 broken pages.

### Files touched

- `app/globals.css` — full rewrite of tokens + BlockNote/table styling
- `components/page-view.tsx` — wider container, larger title, `.nacora-reading` wrapper
- `tailwind.config.ts` — added `text-subtle` and `border-muted` colour aliases
- `scripts/rebuild-broken-tables.ts` — new selective re-seed helper

### Notes for successor session

- Dev server runs on port **3737** (per `next.config.js`), not 3000.
- Reading width is `--reading-max: 72ch`. If a page has wide tables that overflow, they scroll horizontally within the article column — this is intentional (never lets the table push the layout wider than the ideal read column).
- If you ever change the markdown-to-BlockNote parser again, run `scripts/rebuild-broken-tables.ts` before booting so pages stored under the old parser get selectively refreshed.

---

## 2026-07-05 to 2026-07-08 — Diagrams, editability, search, hardening

Long multi-day session. Broke down by feature so the successor can find each thread on its own.

### Goal

Two big pushes:
1. Ship a per-page concept diagram above every page so the BA can grasp the shape before reading text-heavy content.
2. Grow the wiki into something that behaves like Confluence for the BA — real search with AI, editable diagrams, anchor links, image paste, robust against DB crashes.

### What was built

#### AI search + results page
- **`app/(workspace)/search/page.tsx` + `components/search-results.tsx`** — new /search route. Enter in the topbar navigates here.
- **`app/api/ai-answer/route.ts`** — grounds an LLM answer in the top-K KB pages retrieved via FTS. Returns markdown with `[Title](/s/space/p/slug)` links. Frontend renders it with a tiny inline markdown parser (paragraphs, bold, italic, links, lists, headings — no `react-markdown` dependency).
- **Search-bar behaviour** — Enter navigates to /search; the popover still shows as-you-type hits for the dropdown case. Placeholder now says "press Enter for AI answer".
- **Retrieval fix** — original `/api/search` `&`-joined every token so natural-language queries ("how many emails are sent?") failed FTS because every stopword was required. New pipeline drops ~120 English stopwords, tries `&`-join for precision, widens to `|`-join if <3 hits, falls back to per-token ILIKE. Applied same logic to `/api/ai-answer`. Snippet is now built in JS from block text (not `ts_headline` on raw JSONB — that was leaking `[{"id":...}]` JSON into the results).

#### Diagrams — the big thread
- **`page.diagram` (text)** and **`page.diagram_scene` (jsonb)** columns. `diagram` holds Mermaid source; `diagram_scene` holds a hand-edited Excalidraw scene JSON. When `diagram_scene` is set, it's canonical.
- **`lib/synthesis/diagram.ts`** — LLM prompt + `cleanMermaid` (fence stripper) + `validateMermaid` (structural sanity check that rejects unsupported diagram types, subgraphs, forward slashes, parens, semicolons, ampersands). Two-pass generator: retries once with a stricter prompt if validation fails.
- **`lib/synthesis/diagram-backup.ts`** — mirrors every diagram save to `content/diagrams/<space>/<slug>.mmd` and `.scene.json`. Seed reads these back on fresh DB so wipes don't lose work.
- **`app/api/pages/[id]/diagram/route.ts`** — POST regenerates via LLM (refuses with 409 if a scene exists unless `?force=1`). PUT saves diagram text or scene. DELETE clears both.
- **`components/page-diagram.tsx`** — Excalidraw canvas above the title, collapsible with localStorage persistence, hand-drawn zen mode by default. Three UI states:
  - View: `viewModeEnabled` + `zenModeEnabled`, 380px canvas
  - Edit: click ✏ edit → 640px canvas, full toolbar. Save writes to `page.diagramScene`.
  - Regenerate: pops a confirm on manually-edited diagrams; Revert button clears the scene and goes back to LLM view.
- **Padding fix for Virgil-font overflow** — mermaid-to-excalidraw measures widths in sans-serif but Excalidraw renders in Virgil (wider). Short labels overflowed their boxes on both sides. `padContainersForVirgil` widens every container by max(20% of width, 28px) and re-centres.
- **Scripts**
  - `scripts/generate-diagrams.ts` — bulk generator, hits HTTP endpoints (avoids PGlite single-writer conflicts). `--concurrency=3` typical.
  - `scripts/repair-diagrams.ts` — sweeps stored diagrams with the real `@excalidraw/mermaid-to-excalidraw` parser via jsdom, regenerates any that fail.
  - `scripts/repair-diagrams-local.ts` — rule-based text fixer, no LLM. Fixes forward-slash-in-label, parens-in-label, `;`-as-line-joiner, unclosed-brackets (truncation), `&`-as-edge-source, ER attribute name commas.
  - `scripts/audit-diagrams.ts` — real-parser audit, gives an accurate "N/M pages OK" count.
- **Final diagram type restriction** — user reported browser errors (`ER entity not found`, `State node element not found for X`, `SubGraph element not found`) on 22 pages. Root cause: `@excalidraw/mermaid-to-excalidraw` only reliably renders `flowchart LR` without `subgraph`. Every other type — state, ER, class, sequence — throws "element not found" in the browser even though server-side parsing succeeds. Prompt + validator + both audit + repair scripts now enforce `flowchart LR` only. All 111 diagrams converted.

#### Anchor links — Confluence-style
- **`components/page-toc.tsx`** — hover a TOC entry → link icon appears on the right → click copies the full anchor URL (`http://host/s/space/p/slug#h-<blockId>`) to clipboard. Auto-scroll on page load if URL has `#h-<blockId>` hash.
- **`components/block-anchors.tsx`** — same behaviour for every list item (bullet / numbered / check / toggle). Uses a `MutationObserver` on the editor DOM to inject a small hover-visible button next to each list-item wrapper.
- **TOC scroll fix** — old code used `window.scrollTo` but the scrollable ancestor is `<main className="overflow-y-auto">`, not the window. New `scrollContainerOf(el)` walks up to find the real scrollable element. Same fix applied to the IntersectionObserver root that highlights the "current" heading.

#### Image paste / upload
- **`app/api/blocks/image/route.ts`** — accepts multipart form, writes to `public/user-uploads/<timestamp>-<nanoid>.<ext>`, returns `{ url }`. Whitelisted mime types (PNG/JPEG/GIF/WebP/SVG/AVIF/PDF), 20MB cap.
- **`components/editor.tsx`** — passes `uploadFile` to `useCreateBlockNote`. Enables paste-from-clipboard, drag-drop, and slash-menu image insertion.
- **`.gitignore`** — added `public/user-uploads/` so screenshots stay local.

#### Table cell merging
- **`components/editor.tsx`** — added `tables: { splitCells: true, cellBackgroundColor: true, cellTextColor: true, headers: true }` to `useCreateBlockNote`. Merge/split, per-cell colours, header toggles all live.
- **Limitation acknowledged:** BlockNote 0.51's `TableCell` schema is inline-content-only. No block-level content (lists, headings, code blocks) inside table cells. This is architectural, not a flag. Verified in `@blocknote/core/types/src/util/table.d.ts`.

#### Sidebar + reading column
- **Sidebar collapsible** — button top-right of sidebar toggles between 288px expanded and 40px collapsed; state persists in `localStorage`.
- **Reading column centred** — inner `flex-1` col now wraps content in `max-width: var(--reading-max)` div with `flex justify-center`, so whitespace splits evenly between sidebar-side and TOC-side on wide screens.

#### Sources footer / removed "Related concepts"
- **`components/page-view.tsx`** — `stripRelatedConcepts` filters the trailing "Related concepts" / "See also" H2 and everything after from `page.content` at render time. No DB migration needed.
- Space-appropriate sources footer appears below the content: Product → InSurance code + nacora-docs.i2go.io + Thiva KT doc + Jira NBMS; Technical → InSurance code + nacora.paths.json; Client Foundation → Google Slides + Thiva KT doc; Delivery → Jira NBMS + PRDver3.md + meeting notes.

#### Font-size controls
- **`components/font-size-control.tsx`** — A– / percentage / A+ in the topbar. Range 50%–500% in 10% steps. Persists to `localStorage`, applied via `--reading-scale` CSS var scoped to `.nacora-reading`.

#### RelativeTime SSR fix
- **`components/page-view.tsx` + `components/proposals-list.tsx`** — `<RelativeTime iso={...} />` renders nothing on the server, computes "2m ago" only after mount, re-ticks every 30s. Server components (history/sources/conflicts/sync) don't have the problem because they render once.

#### Font-size cap removed
- Earlier the font-size control was capped at 140%. User asked to uncap. New range 50%–500%.

#### Readability overhaul
- **`app/globals.css`** — full typographic reset: 16.5px root, 17.5px reading, line-height 1.75; warm off-white surface (`#FDFCFA`); H1 with underline, H2 in primary blue, H3 slightly bumped; block spacing tightened after user complained about "too much whitespace" (the initial rewrite went too airy); explicit table styling with rounded borders, muted header row, zebra rows, hover tint.

### PGlite: root cause + hardening

PGlite (WASM Postgres) has bitten us several times with `RuntimeError: Aborted(). Build with -sASSERTIONS for more info.` on `pg.exec(DDL)`. Root causes discovered in order:

1. **Stale `postmaster.pid`** from prior sessions — PGlite refuses to boot if the file exists. Emscripten atexit handlers don't reliably fire under Node so the file often orphans.
2. **Turbopack HMR re-instantiating PGlite** — module-scope `_pg` singleton was recreated on every file save in dev mode, causing two WASM instances to race the same `data/db/` and tear the WAL. **This was the true recurring cause.**
3. **`SIGKILL` from `kill -9`** — never let PGlite close cleanly, leaving corrupt WAL + orphaned pid file.

Fixes shipped in `lib/db/client.ts`:
- **`globalThis` singleton** — HMR reuses the same PGlite instance across module re-evaluations.
- **Auto-clear `postmaster.pid` on boot** — since we're single-writer by design, any lock file we find is stale.
- **SIGTERM/SIGINT shutdown hooks** — call `pg.close()` and delete the pid file explicitly.
- **Auto-recovery in `lib/db/init.ts`** — if migration throws `Aborted()`, wipe `data/db` + `/tmp/pglite` and reseed. Diagrams come back from `content/diagrams/` on-disk mirror; page content comes back from `content/**/*.md`. Only tags / versions / proposals are lost.

Feedback memories added: `[[nacora_kb_dev_server]]` (always SIGTERM, never SIGKILL) and `[[nacora_kb_pglite_wedge]]` (recovery steps in destructiveness order).

### Key decisions / trade-offs

- **flowchart LR only** — losing state/ER/sequence diagram expressiveness, but every diagram actually renders. Would revisit if `mermaid-to-excalidraw` ships browser-side fixes for those types.
- **Excalidraw sketchy look** — chose it over plain Mermaid render because the user liked the hand-drawn feel. Adds ~500KB of client bundle for the editor (lazy-loaded when a page has a diagram).
- **On-disk diagram mirror** — decision to make `content/diagrams/*.mmd` the source of truth for diagrams (like `content/**/*.md` is for pages). DB is a cache. Makes wipe-and-recover cheap.
- **`page.diagramScene` only cleared by explicit regenerate** — hand-edits are protected by a confirm prompt.
- **Post-render Virgil padding** — chose to widen containers rather than force Helvetica because "sketchy but no clipping" beat "clean but not sketchy" for the BA's taste.

### Bugs found & fixed

- Postgres FTS `&`-joining every token including stopwords (search returned 1 hit for "how many emails or notifications"). Fix: stopword drop + OR fallback.
- Search snippets were raw JSONB via `ts_headline` — showed `[{"id":...`. Fix: build snippets in JS from block text.
- Mermaid parser errors on 20+ pages after generation — parens/slashes/semicolons in labels, unclosed brackets from truncation, colons in state descriptions. Fix in three layers: stricter prompt, local text-fixer, LLM repair.
- `classDiagram` throws browser "DOM Node not found" — banned in the prompt.
- Virgil font wider than sans-serif → label clipping. Fix: `padContainersForVirgil`.
- `stateDiagram-v2`, `erDiagram`, and `subgraph` all throw browser render errors. Fix: restrict prompt to `flowchart LR`, no subgraph.
- TOC clicks changed URL hash but didn't scroll. Fix: walk to real scroll ancestor.
- Hydration mismatch on relative time (`2m ago` vs `16m ago`). Fix: `<RelativeTime>` client-only.
- Browser extension drawing a red "PRODUCTION" ribbon on localhost — not our code, user needed to disable the extension.

### Files touched (headline)

**New:**
- `components/page-diagram.tsx`, `components/block-anchors.tsx`, `components/font-size-control.tsx`, `components/search-results.tsx`
- `app/api/ai-answer/route.ts`, `app/api/blocks/image/route.ts`, `app/api/pages/[id]/diagram/route.ts`
- `app/(workspace)/search/page.tsx`
- `lib/synthesis/diagram.ts`, `lib/synthesis/diagram-backup.ts`
- `scripts/generate-diagrams.ts`, `scripts/repair-diagrams.ts`, `scripts/repair-diagrams-local.ts`, `scripts/audit-diagrams.ts`, `scripts/dump-diagrams.ts`
- `content/diagrams/**/*.mmd` (111 files, one per page)
- `pending.md`

**Modified:**
- `lib/db/client.ts` (globalThis singleton, shutdown hooks, postmaster.pid cleanup)
- `lib/db/init.ts` (auto-recovery on Aborted)
- `lib/db/migrate.ts` (added diagram + diagram_scene columns)
- `lib/db/schema.ts` (matching column defs)
- `lib/db/seed-runner.ts` (restores diagrams from disk on fresh seed)
- `lib/llm/index.ts` (removed server-only guard so scripts can import)
- `app/globals.css` (typography overhaul + anchor-button + diagram-svg rules)
- `components/editor.tsx` (uploadFile hook + tables config)
- `components/page-view.tsx` (diagram slot, sources footer, related-concepts strip, RelativeTime, reading-width centre)
- `components/page-toc.tsx` (real scroll ancestor + copy-link buttons + on-load hash scroll)
- `components/proposals-list.tsx` (RelativeTime)
- `components/search-bar.tsx` (Enter → /search)
- `components/sidebar.tsx` (collapsible)
- `components/top-bar.tsx` (font-size control)
- `app/(workspace)/s/[space]/p/[pageSlug]/page.tsx` (passes diagramScene)
- `app/api/pages/route.ts` (GET listing + hasDiagram / manuallyEdited flags)
- `app/api/search/route.ts` (stopword drop, OR fallback, JS-built snippets)
- `tailwind.config.ts` (text-subtle + border-muted)
- `package.json` (dropped prosemirror-view override, added mermaid + jsdom + @mantine deps + @excalidraw)
- `.gitignore` (public/user-uploads/, content/diagrams/ is checked in intentionally)

### Notes for successor session

- **Diagrams live at `content/diagrams/`** and are checked into git. They're the source of truth on a fresh clone. When a diagram is edited in the app, both `.mmd` and `.scene.json` are updated on disk.
- **If diagrams stop working after a code change**, run `npx tsx scripts/audit-diagrams.ts` — real-parser sweep gives an accurate count of broken pages.
- **Never `kill -9` the dev server** — it wedges PGlite. Use plain `kill` (SIGTERM). The shutdown hooks will close cleanly. See [[nacora_kb_pglite_wedge]].
- **`.env` has `LLM_PROVIDER=gemini`** — Anthropic is a fallback. Gemini is fast and cheap for diagram generation.
- **`pending.md`** is a stub — reads "all clear" when audit passes.
- **Provider outage recovery** — if both providers are dry, `scripts/repair-diagrams-local.ts` fixes the mechanical failure classes without any API calls.

---

## Template for future entries

```markdown
## YYYY-MM-DD — Session title

### Goal

### What was built (or investigated)

### Key decisions / trade-offs

### Bugs found & fixes

### Files touched (headline)

### Notes for successor session
```
