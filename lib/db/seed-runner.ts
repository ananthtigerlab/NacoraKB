import fs from 'node:fs';
import path from 'node:path';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb, schema } from './client';
import { markdownToBlocks } from '@/lib/synthesis/markdown-blocks';

/*
  Seed the four spaces + candidate pages.

  A candidate page's initial content comes from:
    1. `content/<space-slug>/<page-slug>.md` on disk if present (hand-authored, checked in)
    2. otherwise a small placeholder telling the BA how to populate it

  Additional markdown files under `content/product/*.md` whose slug is NOT in the candidate list
  become *new* auto-discovered pages. This lets us pre-populate concepts that the PRD's candidate
  list didn't anticipate (Cargo Sanctions Screening, Premium Calculation, Bulk Upload, etc.)
  without touching this file.

  So the workflow is: drop or edit a markdown file → `rm -rf data/db && npm run dev` → pages appear.
*/

type PageSeed = {
  title: string;
  slug: string;
  icon?: string;
  groundingMode?: 'code_first' | 'human_source';
  children?: PageSeed[];
};

const CLIENT_FOUNDATION: PageSeed[] = [
  { title: 'Client Overview', slug: 'client-overview' },
  { title: 'Products & Offerings', slug: 'products-offerings' },
  { title: 'Organisation Tree', slug: 'organisation-tree' },
  { title: 'Glossary', slug: 'glossary' },
];

const PRODUCT: PageSeed[] = [
  { title: 'Login', slug: 'login', groundingMode: 'code_first' },
  { title: 'Business Partner', slug: 'business-partner', groundingMode: 'code_first' },
  { title: 'Choices', slug: 'choices', groundingMode: 'code_first' },
  { title: 'Policy Creation (New Business)', slug: 'policy-creation', groundingMode: 'code_first' },
  { title: 'Rating', slug: 'rating', groundingMode: 'code_first' },
  { title: 'Documents', slug: 'documents', groundingMode: 'code_first' },
  { title: 'Business Rules', slug: 'business-rules', groundingMode: 'code_first' },
  { title: 'Clauses', slug: 'clauses', groundingMode: 'code_first' },
  { title: 'Special Rate', slug: 'special-rate', groundingMode: 'code_first' },
  { title: 'Shipment Portal', slug: 'shipment-portal', groundingMode: 'code_first' },
  { title: 'Quote Creation', slug: 'quote-creation', groundingMode: 'code_first' },
  { title: 'Commodity Group Suggestion', slug: 'commodity-group-suggestion', groundingMode: 'code_first' },
  { title: 'Cancellations', slug: 'cancellations', groundingMode: 'code_first' },
  { title: '3rd Party Integrations', slug: 'third-party-integrations', groundingMode: 'code_first' },
  { title: 'Adjustments (MTA)', slug: 'adjustments-mta', groundingMode: 'code_first' },
  { title: 'Referral Management', slug: 'referral-management', groundingMode: 'code_first' },
  { title: 'Billing', slug: 'billing', groundingMode: 'code_first' },
  { title: 'Permissions Management', slug: 'permissions', groundingMode: 'code_first' },
  { title: 'Audit Trail (module)', slug: 'audit-trail-module', groundingMode: 'code_first' },
  { title: 'Policy Duplication', slug: 'policy-duplication', groundingMode: 'code_first' },
  { title: 'User Journeys & Screens (Figma)', slug: 'user-journeys', groundingMode: 'human_source' },
  { title: 'Renewals', slug: 'renewals', groundingMode: 'code_first' },
];

const TECHNICAL: PageSeed[] = [
  { title: 'Architecture Overview', slug: 'architecture' },
  { title: 'Repo Map', slug: 'repo-map' },
  { title: 'Data Model & Entities', slug: 'data-model' },
  { title: 'APIs & Integrations', slug: 'apis' },
  { title: 'Security & Permissions', slug: 'security-and-permissions' },
  { title: 'Background Jobs & Celery', slug: 'background-jobs' },
  { title: 'Event Stream & Audit Trail', slug: 'event-stream-and-audit' },
  { title: 'Bulk Upload & Exporter', slug: 'bulk-upload-and-exporter' },
  { title: 'Frontend Architecture', slug: 'frontend-architecture' },
  { title: 'Environments & Config', slug: 'environments' },
  { title: 'Local Development', slug: 'local-development' },
];

const DELIVERY: PageSeed[] = [
  { title: 'Work Items', slug: 'work-items' },
];

type SpaceSeed = {
  slug: string;
  name: string;
  description: string;
  groundingMode: 'code_first' | 'human_source';
  ordering: number;
  pages: PageSeed[];
};

const SPACES: SpaceSeed[] = [
  {
    slug: 'client-foundation',
    name: 'Client Foundation',
    description: 'Who Nacora is and how they operate.',
    groundingMode: 'human_source',
    ordering: 1,
    pages: CLIENT_FOUNDATION,
  },
  {
    slug: 'product',
    name: 'The Product',
    description: 'Nacora MGA Embedded Cargo — synthesised from code + seed sources, refined by the BA.',
    groundingMode: 'code_first',
    ordering: 2,
    pages: PRODUCT,
  },
  {
    slug: 'technical',
    name: 'Technical',
    description: 'Architecture, data model, APIs, environments.',
    groundingMode: 'code_first',
    ordering: 3,
    pages: TECHNICAL,
  },
  {
    slug: 'delivery',
    name: 'Delivery',
    description: 'Work items, decisions, risks, meeting notes.',
    groundingMode: 'human_source',
    ordering: 4,
    pages: DELIVERY,
  },
];

const STARTER_TAGS = [
  ['pricing', 'functional'], ['underwriting', 'functional'], ['policy', 'functional'],
  ['endorsements', 'functional'], ['claims', 'functional'], ['billing', 'functional'],
  ['documents', 'functional'], ['integration', 'functional'],
  ['code', 'source'], ['figma', 'source'], ['slides', 'source'],
  ['kt-doc', 'source'], ['jira', 'source'], ['transcript', 'source'], ['screenshot', 'source'],
  ['phase-1', 'phase'], ['phase-2', 'phase'],
] as const;

// -------------------------------------------------------------------
// Content loader — reads content/<space>/<slug>.md and produces block JSON.
// -------------------------------------------------------------------

const CONTENT_ROOT = path.join(process.cwd(), 'content');

function readMarkdownFile(spaceSlug: string, pageSlug: string): { title?: string; markdown: string } | null {
  const p = path.join(CONTENT_ROOT, spaceSlug, `${pageSlug}.md`);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8');
  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim();
  // Strip the first-line H1 so we don't duplicate it (the page renders the title in its own header).
  const markdown = titleMatch ? raw.replace(titleMatch[0], '').trim() : raw.trim();
  return { title, markdown };
}

function listExtraMarkdownSlugs(spaceSlug: string, seededSlugs: Set<string>): Array<{ slug: string; title: string; markdown: string }> {
  const dir = path.join(CONTENT_ROOT, spaceSlug);
  if (!fs.existsSync(dir)) return [];
  const extras: Array<{ slug: string; title: string; markdown: string }> = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const slug = f.replace(/\.md$/, '');
    if (seededSlugs.has(slug)) continue;
    const loaded = readMarkdownFile(spaceSlug, slug);
    if (!loaded) continue;
    extras.push({
      slug,
      title: loaded.title ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      markdown: loaded.markdown,
    });
  }
  return extras;
}

function placeholderBlocks(pageTitle: string, hint: string) {
  return [
    {
      id: nanoid(),
      type: 'paragraph',
      props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
      content: [{ type: 'text', text: hint, styles: {} }],
      children: [],
    },
    {
      id: nanoid(),
      type: 'paragraph',
      props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
      content: [{ type: 'text', text: `${pageTitle} — awaiting first synthesis.`, styles: { italic: true } }],
      children: [],
    },
  ];
}

function initialContentFor(spaceSlug: string, pageSlug: string, pageTitle: string): unknown[] {
  const loaded = readMarkdownFile(spaceSlug, pageSlug);
  if (loaded) return markdownToBlocks(loaded.markdown) as unknown as unknown[];
  const hint =
    spaceSlug === 'product'
      ? 'This page is unpopulated. Upload artifacts or run a code sync to have Claude draft it, or edit directly here.'
      : spaceSlug === 'technical'
        ? 'This page will be grounded in the InSurance repo. Run a code sync once you are ready, or edit directly here.'
        : 'Start typing to seed this page. Upload artifacts to have Claude propose additions.';
  return placeholderBlocks(pageTitle, hint);
}

// -------------------------------------------------------------------
// Seed
// -------------------------------------------------------------------

async function seedPageTree(
  db: ReturnType<typeof getDb>,
  spaceId: string,
  spaceSlug: string,
  pages: PageSeed[],
  parentId: string | null,
  seededSlugs: Set<string>,
) {
  for (const p of pages) {
    // Only seed candidates whose .md file exists on disk. This makes UI deletes stick:
    // DELETE /api/pages/:id unlinks the .md (see app/api/pages/[id]/route.ts), so a subsequent
    // seed won't resurrect the page as an empty stub. If you want a candidate to exist without
    // pre-written content, create an empty content/<space>/<slug>.md with just a `# Title` line.
    const mdPath = path.join(CONTENT_ROOT, spaceSlug, `${p.slug}.md`);
    if (!fs.existsSync(mdPath)) {
      seededSlugs.add(p.slug); // reserve the slug so listExtraMarkdownSlugs skips it if it reappears
      continue;
    }
    const id = nanoid();
    await db
      .insert(schema.pages)
      .values({
        id,
        spaceId,
        parentPageId: parentId,
        title: p.title,
        slug: p.slug,
        icon: p.icon ?? null,
        groundingMode: p.groundingMode ?? null,
        content: initialContentFor(spaceSlug, p.slug, p.title) as any,
      })
      .onConflictDoNothing();
    seededSlugs.add(p.slug);
    if (p.children?.length) await seedPageTree(db, spaceId, spaceSlug, p.children, id, seededSlugs);
  }
}

/**
 * Fully idempotent seed — safe to run on every boot. Adds any missing space, missing
 * candidate page, and any new `content/<space>/<slug>.md` file whose slug isn't in the DB yet.
 * Existing pages are not touched (edits made in the app survive).
 */
export async function runSeed(db: ReturnType<typeof getDb>) {
  // Load what already exists so we can idempotently upsert.
  const existingSpaces = await db.select().from(schema.spaces);
  const spaceIdBySlug = new Map(existingSpaces.map((s) => [s.slug, s.id]));

  for (const s of SPACES) {
    // Space upsert.
    let spaceId = spaceIdBySlug.get(s.slug);
    if (!spaceId) {
      spaceId = nanoid();
      await db.insert(schema.spaces).values({
        id: spaceId,
        slug: s.slug,
        name: s.name,
        description: s.description,
        groundingMode: s.groundingMode,
        ordering: s.ordering,
      });
      spaceIdBySlug.set(s.slug, spaceId);
    }

    // What slugs already exist for this space? Skip those.
    const existingSlugs = new Set(
      (
        await db
          .select({ slug: schema.pages.slug })
          .from(schema.pages)
          .where(eq(schema.pages.spaceId, spaceId))
      ).map((r) => r.slug),
    );

    // Candidate pages (from the hardcoded list). Only insert those not already there.
    const seededSlugs = new Set<string>(existingSlugs);
    await seedPageTree(db, spaceId, s.slug, s.pages, null, seededSlugs);

    // Additional markdown files under content/<space>/ that aren't in the DB yet.
    // This is how we ship auto-discovered concepts (Sanctions Screening, Premium
    // Calculation, etc.) without hardcoding them, and it also backfills any page
    // that a prior partial seed missed.
    for (const extra of listExtraMarkdownSlugs(s.slug, seededSlugs)) {
      await db
        .insert(schema.pages)
        .values({
          id: nanoid(),
          spaceId,
          parentPageId: null,
          title: extra.title,
          slug: extra.slug,
          icon: null,
          groundingMode: s.groundingMode,
          content: markdownToBlocks(extra.markdown) as any,
        })
        .onConflictDoNothing();
      seededSlugs.add(extra.slug);
    }
  }

  for (const [name, category] of STARTER_TAGS) {
    await db.insert(schema.tags).values({ id: nanoid(), name, category }).onConflictDoNothing();
  }
  await db.insert(schema.settings).values({ key: 'phase', value: 0 }).onConflictDoNothing();

  // Restore diagrams from the on-disk backup at content/diagrams/<space>/<slug>.mmd (and
  // .scene.json). Every diagram save writes there in addition to the DB, so we survive
  // DB wipes without regenerating.
  const { listDiagramsOnDisk } = await import('@/lib/synthesis/diagram-backup');
  const backups = listDiagramsOnDisk();
  if (backups.length > 0) {
    let restored = 0;
    for (const b of backups) {
      const spaceId = spaceIdBySlug.get(b.spaceSlug);
      if (!spaceId) continue;
      const [existing] = await db
        .select({ id: schema.pages.id, diagram: schema.pages.diagram, diagramScene: schema.pages.diagramScene })
        .from(schema.pages)
        .where(and(eq(schema.pages.spaceId, spaceId), eq(schema.pages.slug, b.pageSlug)))
        .limit(1);
      if (!existing) continue;
      const patch: Partial<typeof schema.pages.$inferInsert> = {};
      if (b.diagram && !existing.diagram) patch.diagram = b.diagram;
      if (b.scene && !existing.diagramScene) patch.diagramScene = b.scene as any;
      if (Object.keys(patch).length > 0) {
        await db.update(schema.pages).set(patch).where(eq(schema.pages.id, existing.id));
        restored++;
      }
    }
    if (restored > 0) console.log(`[seed] restored ${restored} diagram(s) from content/diagrams/`);
  }
}
