/* eslint-disable no-console */
import { nanoid } from 'nanoid';
import { getDb, schema } from './client';
import { migrate } from './migrate';

/*
  Seed the four spaces + candidate pages from PRD §4.
  "The Product" pages are candidates only — Phase 1 synthesis rewrites them from the seed sources,
  and the BA renames/removes as the delivery clarifies (PRD §14.3).
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
  { title: 'How They Operate', slug: 'how-they-operate' },
  { title: 'Products & Offerings', slug: 'products-offerings' },
  { title: 'Organisation Tree', slug: 'organisation-tree' },
  { title: 'Key People & Contacts', slug: 'key-people' },
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
  { title: 'Audit Trail', slug: 'audit-trail-module', groundingMode: 'code_first' },
  { title: 'Policy Duplication', slug: 'policy-duplication', groundingMode: 'code_first' },
  { title: 'User Journeys & Screens (Figma)', slug: 'user-journeys', groundingMode: 'human_source' },
  { title: 'Renewals', slug: 'renewals', groundingMode: 'code_first' },
];

const TECHNICAL: PageSeed[] = [
  { title: 'Architecture Overview', slug: 'architecture' },
  { title: 'Data Model & Entities', slug: 'data-model' },
  { title: 'APIs & Integrations', slug: 'apis' },
  { title: 'Environments & Config', slug: 'environments' },
  { title: 'Repo Map', slug: 'repo-map' },
];

const DELIVERY: PageSeed[] = [
  { title: 'Work Items', slug: 'work-items' },
  { title: 'Decisions Log', slug: 'decisions-log' },
  { title: 'Open Questions & Risks', slug: 'open-questions' },
  { title: 'Meeting Notes', slug: 'meeting-notes' },
];

const SPACES: Array<{
  slug: string;
  name: string;
  description: string;
  groundingMode: 'code_first' | 'human_source';
  ordering: number;
  pages: PageSeed[];
}> = [
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

const STARTER_TAGS: Array<{ name: string; category: 'functional' | 'source' | 'phase' | 'other' }> = [
  // Functional
  { name: 'pricing', category: 'functional' },
  { name: 'underwriting', category: 'functional' },
  { name: 'policy', category: 'functional' },
  { name: 'endorsements', category: 'functional' },
  { name: 'claims', category: 'functional' },
  { name: 'billing', category: 'functional' },
  { name: 'documents', category: 'functional' },
  { name: 'integration', category: 'functional' },
  // Source type
  { name: 'code', category: 'source' },
  { name: 'figma', category: 'source' },
  { name: 'slides', category: 'source' },
  { name: 'kt-doc', category: 'source' },
  { name: 'jira', category: 'source' },
  { name: 'transcript', category: 'source' },
  { name: 'screenshot', category: 'source' },
  // Delivery phase
  { name: 'phase-1', category: 'phase' },
  { name: 'phase-2', category: 'phase' },
];

// Placeholder BlockNote content — an intro paragraph the BA can rewrite.
function placeholderContent(pageTitle: string, hint: string) {
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

async function seedPageTree(db: ReturnType<typeof getDb>, spaceId: string, spaceSlug: string, pages: PageSeed[], parentId: string | null) {
  for (const p of pages) {
    const id = nanoid();
    const hint =
      spaceSlug === 'product'
        ? `This page will be synthesised from the checked-out InSurance code (${p.groundingMode === 'code_first' ? 'code-first' : 'human sources'}) plus your uploads.`
        : spaceSlug === 'technical'
          ? 'This page will be grounded in the InSurance repo. Sync it once Phase 2 is running.'
          : 'Start typing to seed this page. Upload artifacts to have Claude propose additions.';
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
        content: placeholderContent(p.title, hint),
      })
      .onConflictDoNothing();
    if (p.children?.length) {
      await seedPageTree(db, spaceId, spaceSlug, p.children, id);
    }
  }
}

async function seed() {
  await migrate();
  const db = getDb();

  // Skip if already seeded (idempotent).
  const existing = await db.select().from(schema.spaces).limit(1);
  if (existing.length > 0) {
    console.log('Already seeded — skipping.');
    return;
  }

  for (const s of SPACES) {
    const spaceId = nanoid();
    await db.insert(schema.spaces).values({
      id: spaceId,
      slug: s.slug,
      name: s.name,
      description: s.description,
      groundingMode: s.groundingMode,
      ordering: s.ordering,
    });
    await seedPageTree(db, spaceId, s.slug, s.pages, null);
  }

  for (const t of STARTER_TAGS) {
    await db.insert(schema.tags).values({ id: nanoid(), name: t.name, category: t.category }).onConflictDoNothing();
  }

  await db.insert(schema.settings).values({ key: 'phase', value: 0 }).onConflictDoNothing();
  await db
    .insert(schema.auditEvents)
    .values({ id: nanoid(), type: 'system.seeded', actor: 'system', payload: { spaces: SPACES.length } });

  console.log('✓ seed complete');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('✗ seed failed', err);
      process.exit(1);
    });
}
