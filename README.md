# Nacora KB

A read-only knowledge base for the **Nacora MGA Embedded Cargo** delivery at tigerlab.

107 pages covering product behaviour, technical architecture, client foundation, and delivery — written for Business Analysts joining the Nacora project.

## Quick start

```bash
# 1. Clone
git clone https://github.com/ananthtigerlab/NacoraKB.git
cd NacoraKB

# 2. Install
npm install --legacy-peer-deps

# 3. Run
npm run dev
```

Open **http://localhost:3737** in your browser.

No API keys, no environment variables, no external services required.

## What's inside

| Space | Pages | Covers |
|---|---|---|
| Product | 66 | Login, business partners, rating, clauses, shipments, referrals, cancellations, SOAP integration, billing, migration, and more |
| Technical | 36 | Architecture, data model, APIs, auth, background jobs, rating engine, CI/CD, Docker, environments, security |
| Client Foundation | 5 | Client overview, BMS-MGA relationship, products, org tree, glossary |
| Delivery | 1 | Work items |

Each page includes an interactive Excalidraw diagram, tags, and a table of contents.

## Features

- Full-text search across all pages and tags
- Interactive diagrams on every page
- Command palette (Cmd+K) for quick navigation
- Keyboard-friendly navigation
- Dark/light theme support
- Font size controls

## Requirements

- Node.js 18+
- npm

## Tech stack

- Next.js 16 (App Router)
- PGlite (embedded Postgres — no database setup needed)
- Drizzle ORM
- Tailwind CSS + shadcn/ui
- BlockNote rich text viewer
- Excalidraw diagrams

## Fresh database reset

If you want to reload all pages from the markdown source files:

```bash
rm -rf data/db
npm run dev
```

The database seeds automatically on startup from the `content/` directory.
