import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// PRD §6. Names align with the PRD. Postgres via PGlite; pgvector added in Phase 4.

export const spaces = pgTable('space', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  groundingMode: text('grounding_mode', { enum: ['code_first', 'human_source'] })
    .notNull()
    .default('human_source'),
  ordering: integer('ordering').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pages = pgTable(
  'page',
  {
    id: text('id').primaryKey(),
    spaceId: text('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    parentPageId: text('parent_page_id'),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    icon: text('icon'),
    // Per-page grounding mode overrides the space default when set (see PRD §4).
    groundingMode: text('grounding_mode', { enum: ['code_first', 'human_source'] }),
    // BlockNote document JSON — see components/editor.
    content: jsonb('content').$type<PageContent>().notNull().default(sql`'[]'::jsonb`),
    // Aggregated source ids that fed the page (section-level source_ids live in the block metadata).
    sourceIds: jsonb('source_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    // LLM-generated Mermaid diagram summarising the page — rendered above the title, collapsible.
    diagram: text('diagram'),
    // Hand-edited Excalidraw scene JSON. When non-null, this is canonical for rendering; the
    // regenerate button asks before overwriting. When null, we convert `diagram` (Mermaid) on the fly.
    diagramScene: jsonb('diagram_scene').$type<{ elements: unknown[]; files?: Record<string, unknown> } | null>(),
    // Manual sort order within the space's sidebar. Lower = higher. Falls back to createdAt when equal.
    ordering: integer('ordering').notNull().default(0),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    parentIdx: index('page_parent_idx').on(t.parentPageId),
    spaceIdx: index('page_space_idx').on(t.spaceId),
    slugUnq: uniqueIndex('page_space_slug_unq').on(t.spaceId, t.slug),
  }),
);

export const pageVersions = pgTable(
  'page_version',
  {
    id: text('id').primaryKey(),
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: jsonb('content').$type<PageContent>().notNull(),
    createdBy: text('created_by', { enum: ['user', 'model', 'sync'] }).notNull(),
    // Nullable link to the audit event that produced this version (proposal_decided, code_sync, direct_edit).
    sourceEventId: text('source_event_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pageIdx: index('pv_page_idx').on(t.pageId) }),
);

export const tags = pgTable('tag', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  category: text('category', { enum: ['functional', 'source', 'phase', 'other'] })
    .notNull()
    .default('other'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pageTags = pgTable(
  'page_tag',
  {
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.pageId, t.tagId] }) }),
);

export const sources = pgTable(
  'source',
  {
    id: text('id').primaryKey(),
    type: text('type', {
      enum: ['upload', 'connector', 'code', 'transcript', 'screenshot', 'doc', 'slides', 'figma', 'jira'],
    }).notNull(),
    label: text('label').notNull(),
    filePath: text('file_path'),
    url: text('url'),
    // Extracted text for search + synthesis. Nullable while extraction is queued.
    extractedText: text('extracted_text'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ typeIdx: index('source_type_idx').on(t.type) }),
);

export const sourceTags = pgTable(
  'source_tag',
  {
    sourceId: text('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.sourceId, t.tagId] }) }),
);

// Phase 1 — model's structured interpretation of an artifact.
export const ingestions = pgTable('ingestion', {
  id: text('id').primaryKey(),
  sourceId: text('source_id')
    .notNull()
    .references(() => sources.id, { onDelete: 'cascade' }),
  modelInterpretation: jsonb('model_interpretation').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Phase 2 — one row per Sync-now / scheduled sync run.
export const codeSyncs = pgTable('code_sync', {
  id: text('id').primaryKey(),
  fromCommit: text('from_commit'),
  toCommit: text('to_commit').notNull(),
  changesSummary: jsonb('changes_summary').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  affectedPageIds: jsonb('affected_page_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Phase 1/2 — every proposal presented to the BA. Nothing hits a page without an approved proposal (PRD §5.5).
export const proposals = pgTable(
  'proposal',
  {
    id: text('id').primaryKey(),
    ingestionId: text('ingestion_id').references(() => ingestions.id, { onDelete: 'set null' }),
    codeSyncId: text('code_sync_id').references(() => codeSyncs.id, { onDelete: 'set null' }),
    targetPageId: text('target_page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    proposedContent: jsonb('proposed_content').$type<PageContent>().notNull(),
    modelRationale: text('model_rationale'),
    status: text('status', { enum: ['pending', 'approved', 'edited', 'rejected'] })
      .notNull()
      .default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pageIdx: index('proposal_page_idx').on(t.targetPageId),
    statusIdx: index('proposal_status_idx').on(t.status),
  }),
);

export const proposalDecisions = pgTable('proposal_decision', {
  id: text('id').primaryKey(),
  proposalId: text('proposal_id')
    .notNull()
    .references(() => proposals.id, { onDelete: 'cascade' }),
  decision: text('decision', { enum: ['approved', 'edited', 'rejected'] }).notNull(),
  editedContent: jsonb('edited_content').$type<PageContent | null>(),
  decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
});

// PRD §5.7 — code vs human-source contradiction records.
export const conflicts = pgTable(
  'conflict',
  {
    id: text('id').primaryKey(),
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    sectionRef: text('section_ref'),
    codeStatement: text('code_statement').notNull(),
    humanStatement: text('human_statement').notNull(),
    humanSourceId: text('human_source_id').references(() => sources.id, { onDelete: 'set null' }),
    status: text('status', { enum: ['open', 'resolved'] })
      .notNull()
      .default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pageIdx: index('conflict_page_idx').on(t.pageId) }),
);

// PRD §8 — append-only. NEVER edit or delete.
export const auditEvents = pgTable(
  'audit_event',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    actor: text('actor', { enum: ['user', 'model', 'sync', 'system'] }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    relatedIds: jsonb('related_ids').$type<Record<string, string | string[]>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    typeIdx: index('audit_type_idx').on(t.type),
    createdIdx: index('audit_created_idx').on(t.createdAt),
  }),
);

// System settings: last-synced commit, feature flags (Phase 4 auto-merge toggle).
export const settings = pgTable('setting', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ------------------------- Relations -------------------------

export const spacesRel = relations(spaces, ({ many }) => ({ pages: many(pages) }));

export const pagesRel = relations(pages, ({ one, many }) => ({
  space: one(spaces, { fields: [pages.spaceId], references: [spaces.id] }),
  versions: many(pageVersions),
  tags: many(pageTags),
  proposals: many(proposals),
  conflicts: many(conflicts),
}));

export const pageTagsRel = relations(pageTags, ({ one }) => ({
  page: one(pages, { fields: [pageTags.pageId], references: [pages.id] }),
  tag: one(tags, { fields: [pageTags.tagId], references: [tags.id] }),
}));

export const sourcesRel = relations(sources, ({ many }) => ({
  ingestions: many(ingestions),
  tags: many(sourceTags),
}));

// ------------------------- Content type -------------------------

// BlockNote stores documents as arrays of block objects. We keep it as unknown at the DB layer;
// the editor component owns the runtime type.
export type PageContent = Array<Record<string, unknown>>;
