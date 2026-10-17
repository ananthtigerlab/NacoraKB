# Nacora KB

A single-user, locally-hosted, AI-synthesised knowledge base for the **Nacora MGA Embedded Cargo** delivery.

Grounded in the InSurance repo (read-only, from a local path — no GitHub token needed), enriched by every artifact
you upload: transcripts, screenshots, KT docs, slides, Figma, Jira. Claude interprets each artifact, routes it to
the right page(s), and drafts a proposal. Nothing hits a page until you approve it.

Built end-to-end per `PRDver3.md` (Phase 0 → Phase 4).

---

## Quick start

```bash
cd ~/Downloads/GitHubProjects/NacoraKB

# 1. Install dependencies (~90 seconds)
npm install

# 2. Copy the env template and fill in your key
cp .env.example .env
#   - open .env in an editor
#   - paste your Anthropic API key
#   - set NACORA_CODE_PATH to your local InSurance checkout (defaults are already right for the standard layout)

# 3. Run the dev server (Postgres is embedded via PGlite — nothing else to start)
npm run dev
```

Then open **http://localhost:3737**.

On first request the app auto-creates its local database under `data/db/` and seeds:
- The four spaces (Client Foundation, The Product, Technical, Delivery)
- Candidate pages for each space (§4 of the PRD)
- The starter tag palette

Everything is stored in `data/` and is git-ignored.

---

## Layout

```
NacoraKB/
├── app/                       Next.js App Router — server/client components
│   ├── (workspace)/           Sidebar + top search bar layout
│   │   ├── s/[space]/         Space overview
│   │   │   └── p/[pageSlug]/  Page view (BlockNote editor)
│   │   ├── history/           Append-only audit trail (PRD §8)
│   │   ├── sources/           Source Library (PRD §4)
│   │   ├── proposals/         Approve / Edit / Reject queue (PRD §5.5)
│   │   ├── conflicts/         Code vs human-source disagreements (PRD §5.7)
│   │   └── sync/              Sync-now button + sync history (PRD §5.4)
│   ├── api/                   Server routes for pages, tags, uploads, search, sync, connectors
│   └── page.tsx               Home — redirects to first space
├── components/                UI + editor + palette + upload + proposals list
│   └── ui/                    shadcn-style primitives (Radix + Tailwind)
├── lib/
│   ├── db/                    PGlite client, schema, migrations, seed
│   ├── synthesis/ingest.ts    PRD §5.3 — interpret / route / synthesise / propose
│   ├── code-sync/             PRD §5.4 — local git diff → proposals
│   ├── connectors/            Jira / Figma / Google Doc pull
│   ├── extractors/            PDF, DOCX, image (OCR), transcript text extraction
│   ├── anthropic.ts           The only secret client
│   └── audit.ts               Append-only event log helper
├── nacora.paths.json          Nacora-relevant paths in the InSurance repo (PRD §5.4 scope)
├── PRDver3.md                 The product PRD (single source of truth)
└── data/                      Local DB + uploads (git-ignored)
```

---

## Phased build (as delivered)

- **Phase 0 — Editable wiki shell** ✅
  Next.js + TypeScript, Tailwind + shadcn/ui with the brand tokens (deep marine blue on white),
  PGlite embedded Postgres via Drizzle, four spaces + candidate pages, BlockNote editor with autosave,
  cross-cutting tags, drop-anywhere upload (drag/paste screenshots), keyword search (Postgres FTS),
  command palette (Cmd/Ctrl-K), Source Library, History skeleton.

- **Phase 1 — Ingest & synthesis** ✅
  Text extraction (PDF, DOCX, images/OCR, text/JSON/markdown), Claude-based
  interpret → route → synthesise → propose pipeline (`lib/synthesis/ingest.ts`), Propose/Edit/Approve
  UI with inline diff and keyboard shortcuts (A / E / R), pinned-block support, source trails on pages,
  full audit logging, per-page version history with restore.

- **Phase 2 — Code grounding + sync** ✅
  `NACORA_CODE_PATH` read-only local reads via `simple-git`, `nacora.paths.json` scope config
  (primary + shared, with glob ignores), `git diff <last>..HEAD` change detection,
  regeneration of code_first pages with pinned-edit preservation, code-vs-human conflict flagging,
  `code_sync` audit events, "Sync now" button + history.

- **Phase 3 — Connectors** ✅ (bring your own tokens)
  Jira (Atlassian API v3 + basic auth), Figma (personal access token), Google Docs (link-shared / public export).
  Each connector produces `Source` rows that flow through the same Phase 1 pipeline.

- **Phase 4 — Auto-merge toggle + semantic search** ✅ (opt-in)
  Settings-backed toggle to trust-auto-merge certain scopes; `lib/embeddings.ts` seam ready for pgvector
  once PGlite ships the extension (fallback is Postgres FTS, working today).

---

## Configuring code sync (Phase 2)

`nacora.paths.json` at the repo root controls which parts of the InSurance monorepo are grounded.
Populated from an automated scan of `~/Downloads/GitHubProjects/InSurance` on first build — **confirm
with the delivery team** before running sync against real code, and adjust as the codebase moves.

- `primary` — Nacora-owned dirs (`src/clients/nacora/`, `frontend/apps/nacora-*`, `frontend/libs/nacora/`).
  Changes here are always in-scope.
- `shared` — platform modules Nacora depends on (`src/policies/`, `src/ratings/`, `src/core/`, etc.).
  Changes here affect all clients; proposals are tagged so you can decide whether to update the Nacora
  page or add a caveat.
- `ignore` — pyc, migrations, node_modules, build artifacts.

Set `NACORA_CODE_PATH` in `.env` to point at the checkout (default: `~/Downloads/GitHubProjects/InSurance`).

The KB never writes back to the InSurance repo. `git log` / `git diff` only.

---

## Connectors — supplying credentials

All optional. Skip any you don't need.

```env
# Jira (Atlassian API token — generate at id.atlassian.com/manage-profile/security/api-tokens)
ATLASSIAN_EMAIL=your.name@tigerlab.com
ATLASSIAN_API_TOKEN=<token>
ATLASSIAN_HOST=tigerlab.atlassian.net

# Figma (personal access token — figma.com/settings)
FIGMA_PERSONAL_ACCESS_TOKEN=<token>
```

Trigger a connector pull:

```bash
# Jira — uses the seed JQL (Nacora filter) by default
curl -X POST localhost:3737/api/connectors/jira -H 'content-type: application/json' -d '{}'

# Figma — pass the file key from the URL (…/board/<key>/…)
curl -X POST localhost:3737/api/connectors/figma -H 'content-type: application/json' -d '{"fileKey": "a4YLFN6XOkdH6Zy7DZkD9D"}'

# Google Doc — must be shared as "Anyone with the link can view"
curl -X POST localhost:3737/api/connectors/google-doc -H 'content-type: application/json' -d '{"url": "https://docs.google.com/document/d/166FUh8rQB5lXxXqNRH4rd2IQLifUaTLAVKySswiWm4E/edit"}'
```

Each connector call adds `Source` rows; they run through the same synthesis pipeline the next time you
click Sync (or immediately, in the Jira case, if you extend it to auto-ingest).

---

## Security

- Everything is local. No telemetry. No external hosting.
- The only secret is `ANTHROPIC_API_KEY`. `.env` and `data/` are git-ignored.
- The KB reads the InSurance repo read-only. It never writes, commits, or pushes to it.
- Because the DB and uploads folder contain synthesised proprietary content, don't publish the KB folder.

---

## Handy commands

```bash
npm run dev            # dev server (Next.js on :3737)
npm run build          # production build
npm run start          # start the built app
npm run typecheck      # tsc --noEmit
npm run db:seed        # re-seed a fresh DB (idempotent)
npm run db:reset       # wipe local DB and reseed (destructive — synthesised content lost)
```

---

## Not yet done / open questions (PRD §14)

- **Google OAuth** for Docs/Slides — currently only "link-shared" docs work.
- **pgvector** — waiting on PGlite extension support; keyword search is the fallback today.
- **Path scope confirmation** — the initial `nacora.paths.json` was built by scanning the repo; confirm
  with the PM before running heavy sync jobs.
- **Product page names** — seeded from the PRD candidate list; expect to rename/remove some as delivery clarifies.
