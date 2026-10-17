# CLAUDE.md — Nacora KB project handoff

This file is auto-loaded by Claude Code. Read it first before touching this project.

Also read `SESSION-LOG.md` for build history and **`futureplan.md`** for parked/deferred work (source-attribution options, pgvector, OAuth, cron sync, etc.).

## What this is

Nacora KB is a **single-user, locally-hosted, AI-synthesised knowledge base** for the *Nacora MGA Embedded Cargo* delivery. It's the BA (thayananth.kumaresan@tigerlab.com) private wiki — everything is local (PGlite embedded Postgres), never deployed to a shared host.

The full product spec is in `/Users/tigerlab/Downloads/PRDver3.md`.

**Two-line summary:** wiki UI in Next.js. Content lives as markdown files in `content/<space>/<slug>.md`; on boot the seed reads those files and creates DB pages. Uploads / code-sync (Phase 1/2) can also propose page updates via Claude or Gemini through a Propose→Edit→Approve flow.

## The user

- **Role:** Business Analyst on the Nacora MGA Embedded Cargo delivery at TigerLab
- **Email:** thayananth.kumaresan@tigerlab.com
- **Preference:** be direct, don't summarise excessively, execute commands don't ask for permission. Wide allowlist is set in `.claude/settings.local.json`.

## Tech stack (locked)

- **Next.js 16** (App Router, Turbopack) + TypeScript
- **PGlite** — embedded Postgres in the Node process; data under `data/db/`
- **Drizzle** ORM
- **Tailwind + shadcn/ui** for UI; brand tokens in `app/globals.css` (deep marine blue on white)
- **BlockNote** rich editor (client-only via `components/editor-loader.tsx`)
- **LLM provider abstraction** at `lib/llm/` — `LLM_PROVIDER=anthropic` (default) or `gemini`

## Directory layout

```
NacoraKB/
├── CLAUDE.md                      this file
├── SESSION-LOG.md                 session history — read for context on why things are the way they are
├── PRDver3.md-related notes (in /Users/tigerlab/Downloads/PRDver3.md)
├── .env                           ANTHROPIC_API_KEY, GEMINI_API_KEY, NACORA_CODE_PATH; git-ignored
├── .env.example                   template
├── nacora.paths.json              which paths in the InSurance repo are Nacora-relevant (config for Phase 2 code sync)
│
├── content/                       SOURCE OF TRUTH FOR PAGE CONTENT (fresh install picks these up)
│   ├── client-foundation/         5 pages (client-overview, bms-mga-relationship, products-offerings, organisation-tree, glossary)
│   ├── product/                   61 pages (the meat of the product docs — Login, Business Partner, Rating, Clauses, all partner-types, all risks-* tabs, first-day-guides, embed-dashboard, sanctions-and-compliance, etc.)
│   ├── technical/                 35 pages (architecture, data-model, repo-map, apis, auth-backends, background-jobs, rating-engine, business-rules-engine, migrations-and-seeds, ci-pipeline, docker-build, environments, observability, security-and-permissions, session-security, third-party-integrations-failure-modes, and 19 more)
│   └── delivery/                  1 page (work-items)
│
├── app/                           Next.js routes
│   ├── (workspace)/               sidebar + topbar layout
│   │   ├── s/[space]/p/[pageSlug] page view (BlockNote)
│   │   ├── history                append-only audit trail
│   │   ├── sources                Source Library
│   │   ├── proposals              Approve/Edit/Reject queue
│   │   ├── conflicts              code vs human-source conflicts
│   │   └── sync                   code-sync history + Sync-now
│   └── api/                       CRUD, upload, search, sync, connectors, settings, proposals
│
├── components/                    UI (page-view, sidebar, top-bar, search-bar, editor, tag-input, upload-dialog, proposals-list, sync-now-button, ui/*)
│
├── lib/
│   ├── db/                        client (PGlite), schema (Drizzle), migrate, seed-runner, init
│   ├── synthesis/                 ingest.ts (Phase 1 pipeline), markdown-blocks.ts (markdown → BlockNote JSON)
│   ├── code-sync/                 sync.ts (Phase 2 discovery + diff), discovery.ts, git.ts
│   ├── connectors/                jira.ts, figma.ts, google.ts (link-shared docs)
│   ├── extractors/                pdf/docx/image-OCR/text extraction
│   ├── llm/                       provider dispatcher (anthropic.ts, gemini.ts, index.ts)
│   ├── audit.ts                   append-only event helper
│   ├── settings.ts                key-value settings on top of the settings table
│   └── embeddings.ts              stub for Phase 4 pgvector semantic search
│
├── data/                          LOCAL, git-ignored — PGlite db files + uploaded artifacts
└── .claude/settings.local.json    wide-open allowlist so I don't keep asking permission
```

## The content model (important — this is unusual)

**Rule:** markdown files in `content/<space>/<slug>.md` are the **source of truth for a fresh install**. Once the DB is seeded, the DB is the source of truth (edits in the app UI persist and are not overwritten by markdown edits).

**How the seed works** (`lib/db/seed-runner.ts` + `lib/db/init.ts`):

1. On every boot, `ensureDbReady()` runs `runSeed(db)`.
2. `runSeed` is **fully idempotent** — safe to run any number of times:
   - Spaces are checked by slug; existing ones are left alone.
   - Candidate pages (hardcoded list of 22 product pages + 6 client-foundation + 5 technical + 4 delivery) are inserted with `onConflictDoNothing()`.
   - **Extras** — any `.md` file whose slug isn't in the candidate list becomes a new page, inserted with `onConflictDoNothing()`.
3. Result: dropping a new `content/product/foo-bar.md` and restarting the dev server surfaces "Foo Bar" as a new page — no code change, no DB wipe.

**To reproduce a fully fresh state:** `rm -rf data/db && npm run dev`.

**To reproduce with existing DB:** just `npm run dev`. Existing pages retain their edits; only newly-added markdown files are added.

## LLM provider abstraction

`lib/llm/index.ts` exposes two functions used everywhere:

- `toolJSON<T>(opts)` — structured JSON via function calling. Use for small / typed responses.
- `textOutput(opts)` — plain-text completion. Use for large free-form output (multi-KB markdown, prose) where function-call validators trip up on big string fields.

Both dispatch to `anthropic.ts` or `gemini.ts` based on `LLM_PROVIDER`. Synthesis (biggest single call) is **plain-text markdown** with a `---RATIONALE---` / `---CONTENT---` delimiter; the response is parsed by `parseSynthesisResponse` in `lib/synthesis/markdown-blocks.ts` and the markdown converted to BlockNote via `markdownToBlocks`.

**Why plain-text over function calling for synthesis:** Gemini's function-call validators fail silently on large-string parameters. We tried three approaches — arrays of objects, JSON strings — before landing on plain-text markdown with a delimiter. This is the only path that works reliably with both Claude and Gemini for multi-KB outputs.

## Phases (all shipped)

- **Phase 0** — editable wiki shell (Next.js + PGlite + BlockNote + tags + upload + search + command palette + History)
- **Phase 1** — ingest & synthesis loop (extract text from uploaded artifacts → Claude/Gemini interprets → routes → synthesises → creates Proposal → BA approves)
- **Phase 2** — code grounding + sync (reads InSurance repo read-only via local git; initial discovery pass traces login→logout and proposes new pages; incremental sync diffs against last commit)
- **Phase 3** — connectors (Jira, Figma, Google Docs — bring your own token in `.env`)
- **Phase 4** — auto-merge toggle + pgvector seam (setting exists; pgvector waiting on PGlite extension support)

## What was populated in the KB

**Session on 2026-07-01 / 2026-07-02** did an aggressive fill-up of the KB from three sources:

1. **The InSurance code repo** (`~/Downloads/GitHubProjects/InSurance`) — Django + React monorepo. Nacora-owned paths in `nacora.paths.json`.
2. **The KT doc** from Thiva (departing PM, session 2026-06-23). Extracted BA-relevant insights that aren't in the code.
3. **The official docs** at https://nacora-docs.i2go.io (Sphinx site, K+N / tigerlab OAuth). Fetched with a session cookie in `/tmp/nacora-docs/cookies.txt`; parsed 84 HTML files into `/tmp/nacora-docs/text/*.md`. All 84 pages merged into the KB.
4. **Google Slides** at the seed URL — used for Client Foundation.
5. **Figma** — skipped (auth-locked, `.jam` file is binary).
6. **Jira NBMS** — 100 tickets extracted; documented on Delivery / Work Items page. **Important:** NBMS is the sister *broker* system, not this MGA product. Do not confuse.

**Session on 2026-07-04** populated the Technical space (35 pages) from the InSurance repo — architecture, data model, repo map, APIs, background jobs, rating engine, business rules engine, CI, docker, environments, observability, security, sessions, third-party failure modes, etc.

**Total pages (verified 2026-08-11):** 102 — 5 client-foundation, 61 product, 35 technical, 1 delivery. All 102 pages have Excalidraw diagrams (`content/diagrams/`).

## Known limitations & rough edges

- **Delivery space is thin.** Only `work-items.md` remains — `decisions-log`, `open-questions`, `meeting-notes` were removed at some point (deliberately or in a cleanup pass). Rebuild if delivery notes are needed again.
- **Figma docs unreachable.** The Nacora board is behind K+N Figma auth; MCP Figma tool doesn't have access. `.jam` binary can't be parsed. User Journeys page is written from code + docs alone.
- **NBMS Jira ≠ MGA Jira.** The PRD's seed URL points at the wrong project. Find the actual MGA product Jira when it's identified and refresh Work Items.
- **Google Docs connector is link-shared only.** No OAuth flow yet — docs must be shared with "anyone with the link". Future work: proper OAuth.
- **Salog SOAP integration** is documented but not live (MVP 2nd phase). China Zurich e-Marine also future.
- **Claims** is 3-step logging only. Full claims + LIMs/TIPs vendor pick is post-MVP.
- **Content vs DB drift.** After a page is edited in the app UI, the DB copy diverges from the `.md` file. `.md` remains the fresh-install seed; DB is authoritative once the app is running. If you want the markdown to "win", wipe the DB.

## How to run / develop

```bash
# fresh boot
rm -rf data/db && npm run dev

# ordinary boot (DB retained, new .md files picked up)
npm run dev

# typecheck
npx tsc --noEmit

# add a new page
# 1. write content/<space>/<new-slug>.md with a first-line `# Title`
# 2. restart dev server → the new page appears in the sidebar

# switch LLM provider
# edit .env → LLM_PROVIDER=gemini (or anthropic) → restart

# force initial code-discovery sync
# open /sync in the app → "Force initial discovery" button
```

## Next-phase ideas (in priority order)

1. **Refresh Delivery / Work Items** with the correct MGA-product Jira filter — it's `12060`, not the PRD's original `cf[10101]="Nacora"` which returns NBMS. Rebuild `decisions-log`, `open-questions`, `meeting-notes` if delivery notes are needed.
2. **Wire real Google Docs / Slides / Figma connectors** (OAuth).
3. **pgvector semantic search** once PGlite supports the extension.
4. **Trusted auto-merge toggle for specific scopes** (Phase 4 completion).
5. **Incremental sync via cron** (currently manual "Sync now").
6. **Source attribution footer on every page** — Option A in `futureplan.md` §1 (compact "Sources: …" line at the bottom of each page).
7. **Export to PDF / Confluence** for handover.
8. **Refresh Technical space** as the InSurance code moves. Last populated 2026-07-04; check `git log --since=2026-07-04 -- <nacora paths>` to see what's drifted.

## Session-log convention

`SESSION-LOG.md` at the project root captures the material history of each build session. Read it if you need context on *why* things are the way they are (e.g. "why is synthesis plain-text instead of function calling"). Append a new dated entry when you finish a substantial session.

## Permissions & operating style

- Wide-open allowlist is in `.claude/settings.local.json`. All common commands (npm, npx, node, python3, curl, git, grep/awk/sed/sort/head/tail/etc., unzip, kill/pkill, mkdir/rm-in-tmp, all `mcp__claude_ai_*` tools) are pre-approved. **Don't ask for permission unless you're doing something genuinely destructive.**
- Prefer `Write` over `cat >> file`.
- Prefer `Edit` over `sed -i`.
- Use `Bash` only for real shell operations (curl, npm, git).
- Never touch the InSurance repo except read-only via local `git log` / `git diff`.
- Never commit anything without explicit ask.

## Key files to read to get up to speed

Fastest path to context:

1. This file (`CLAUDE.md`)
2. `SESSION-LOG.md` (why things are the way they are)
3. `/Users/tigerlab/Downloads/PRDver3.md` (the PRD)
4. `nacora.paths.json` (Nacora scope in the InSurance repo)
5. `lib/db/seed-runner.ts` + `lib/db/init.ts` (understand the content model)
6. `lib/llm/index.ts` (understand provider dispatch)
7. `lib/synthesis/markdown-blocks.ts` (understand synthesis output format)

Then browse `content/product/*.md` to see the depth of the actual documentation.
