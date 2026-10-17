import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { ensureDbReady } from '@/lib/db/init';
import { getDb, schema } from '@/lib/db/client';
import { logAudit } from '@/lib/audit';

const CreateSchema = z.object({
  spaceSlug: z.string(),
  parentPageId: z.string().nullable().optional(),
  title: z.string().min(1).max(200),
  slug: z.string().optional(),
});

function slugify(t: string) {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'untitled';
}

export async function POST(req: NextRequest) {
  await ensureDbReady();
  const db = getDb();
  const body = CreateSchema.parse(await req.json());

  const [space] = await db.select().from(schema.spaces).where(eq(schema.spaces.slug, body.spaceSlug)).limit(1);
  if (!space) return NextResponse.json({ error: 'space_not_found' }, { status: 404 });

  let slug = body.slug ?? slugify(body.title);
  const existingSlugs = new Set(
    (await db.select({ slug: schema.pages.slug }).from(schema.pages).where(eq(schema.pages.spaceId, space.id))).map(
      (p) => p.slug,
    ),
  );
  let i = 1;
  while (existingSlugs.has(slug)) {
    i += 1;
    slug = `${slugify(body.title)}-${i}`;
  }

  const id = nanoid();
  await db.insert(schema.pages).values({
    id,
    spaceId: space.id,
    parentPageId: body.parentPageId ?? null,
    title: body.title,
    slug,
    content: [],
  });

  await logAudit({
    type: 'structural.page_created',
    actor: 'user',
    payload: { title: body.title, spaceSlug: body.spaceSlug },
    relatedIds: { pageId: id, spaceId: space.id },
  });

  return NextResponse.json({ id, slug, spaceSlug: space.slug });
}

// GET /api/pages — list every page with its space slug and a hasDiagram flag.
// Used by scripts/generate-diagrams.ts to walk the KB via HTTP (avoids PGlite single-writer conflicts).
export async function GET() {
  await ensureDbReady();
  const db = getDb();
  const spaces = await db.select().from(schema.spaces);
  const spaceById = new Map(spaces.map((s) => [s.id, s.slug]));
  const rows = await db
    .select({
      id: schema.pages.id,
      title: schema.pages.title,
      slug: schema.pages.slug,
      spaceId: schema.pages.spaceId,
      diagram: schema.pages.diagram,
      diagramScene: schema.pages.diagramScene,
      updatedAt: schema.pages.updatedAt,
    })
    .from(schema.pages);
  return NextResponse.json({
    pages: rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      spaceSlug: spaceById.get(r.spaceId) ?? '',
      diagram: r.diagram,
      diagramScene: r.diagramScene,
      hasDiagram: Boolean((r.diagram && r.diagram.trim()) || r.diagramScene),
      manuallyEdited: Boolean(r.diagramScene),
      updatedAt: r.updatedAt,
    })),
  });
}
