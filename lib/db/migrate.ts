/* eslint-disable no-console */
import { getPg } from './client';

// A single, idempotent SQL migration script. This is a solo local app —
// full migration tooling (drizzle-kit) is overkill; we just create tables if missing.
// Phase 4 will add pgvector; see `enableVector` below (called from settings when opt-in).

const DDL = `
CREATE TABLE IF NOT EXISTS space (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  grounding_mode text NOT NULL DEFAULT 'human_source',
  ordering integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS page (
  id text PRIMARY KEY,
  space_id text NOT NULL REFERENCES space(id) ON DELETE CASCADE,
  parent_page_id text,
  title text NOT NULL,
  slug text NOT NULL,
  icon text,
  grounding_mode text,
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS page_parent_idx ON page(parent_page_id);
CREATE INDEX IF NOT EXISTS page_space_idx ON page(space_id);
CREATE UNIQUE INDEX IF NOT EXISTS page_space_slug_unq ON page(space_id, slug);

-- Diagram column added 2026-07-05; ALTER handles existing DBs.
ALTER TABLE page ADD COLUMN IF NOT EXISTS diagram text;
-- Hand-edited Excalidraw scene, added 2026-07-05.
ALTER TABLE page ADD COLUMN IF NOT EXISTS diagram_scene jsonb;
-- Manual sidebar ordering, added 2026-07-08.
ALTER TABLE page ADD COLUMN IF NOT EXISTS ordering integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS page_version (
  id text PRIMARY KEY,
  page_id text NOT NULL REFERENCES page(id) ON DELETE CASCADE,
  title text NOT NULL,
  content jsonb NOT NULL,
  created_by text NOT NULL,
  source_event_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pv_page_idx ON page_version(page_id);

CREATE TABLE IF NOT EXISTS tag (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'other',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS page_tag (
  page_id text NOT NULL REFERENCES page(id) ON DELETE CASCADE,
  tag_id text NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, tag_id)
);

CREATE TABLE IF NOT EXISTS source (
  id text PRIMARY KEY,
  type text NOT NULL,
  label text NOT NULL,
  file_path text,
  url text,
  extracted_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ingested_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS source_type_idx ON source(type);

CREATE TABLE IF NOT EXISTS source_tag (
  source_id text NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  tag_id text NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (source_id, tag_id)
);

CREATE TABLE IF NOT EXISTS ingestion (
  id text PRIMARY KEY,
  source_id text NOT NULL REFERENCES source(id) ON DELETE CASCADE,
  model_interpretation jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS code_sync (
  id text PRIMARY KEY,
  from_commit text,
  to_commit text NOT NULL,
  changes_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  affected_page_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposal (
  id text PRIMARY KEY,
  ingestion_id text REFERENCES ingestion(id) ON DELETE SET NULL,
  code_sync_id text REFERENCES code_sync(id) ON DELETE SET NULL,
  target_page_id text NOT NULL REFERENCES page(id) ON DELETE CASCADE,
  proposed_content jsonb NOT NULL,
  model_rationale text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proposal_page_idx ON proposal(target_page_id);
CREATE INDEX IF NOT EXISTS proposal_status_idx ON proposal(status);

CREATE TABLE IF NOT EXISTS proposal_decision (
  id text PRIMARY KEY,
  proposal_id text NOT NULL REFERENCES proposal(id) ON DELETE CASCADE,
  decision text NOT NULL,
  edited_content jsonb,
  decided_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conflict (
  id text PRIMARY KEY,
  page_id text NOT NULL REFERENCES page(id) ON DELETE CASCADE,
  section_ref text,
  code_statement text NOT NULL,
  human_statement text NOT NULL,
  human_source_id text REFERENCES source(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conflict_page_idx ON conflict(page_id);

CREATE TABLE IF NOT EXISTS audit_event (
  id text PRIMARY KEY,
  type text NOT NULL,
  actor text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  related_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_type_idx ON audit_event(type);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_event(created_at);

CREATE TABLE IF NOT EXISTS setting (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

// Postgres full-text: a generated tsvector column on page.content + title for keyword search.
// PGlite ships with the default full-text config so this Just Works.
const FTS = `
ALTER TABLE page ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content::text, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS page_search_tsv_idx ON page USING gin(search_tsv);

ALTER TABLE source ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(label, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(extracted_text, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS source_search_tsv_idx ON source USING gin(search_tsv);
`;

export async function migrate() {
  const pg = getPg();
  await pg.exec(DDL);
  try {
    await pg.exec(FTS);
  } catch (err) {
    // PGlite may not support generated tsvector columns on some versions; fall back silently.
    console.warn('[migrate] FTS setup skipped:', (err as Error).message);
  }
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('✓ migration complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('✗ migration failed', err);
      process.exit(1);
    });
}
