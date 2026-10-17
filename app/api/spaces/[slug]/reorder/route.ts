import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { ensureDbReady } from '@/lib/db/init';
import { getDb, schema } from '@/lib/db/client';
import { logAudit } from '@/lib/audit';

const Body = z.object({
  // Ordered array of page ids as they should appear in the sidebar (top → bottom).
  pageIds: z.array(z.string()).min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  await ensureDbReady();
  const { slug } = await params;
  const db = getDb();
  const [space] = await db.select().from(schema.spaces).where(eq(schema.spaces.slug, slug)).limit(1);
  if (!space) return NextResponse.json({ error: 'space_not_found' }, { status: 404 });

  const { pageIds } = Body.parse(await req.json());

  // Only accept ids that actually belong to this space — guards against injection of ids from another space.
  const rows = await db
    .select({ id: schema.pages.id })
    .from(schema.pages)
    .where(and(eq(schema.pages.spaceId, space.id), inArray(schema.pages.id, pageIds)));
  const valid = new Set(rows.map((r) => r.id));
  const filtered = pageIds.filter((id) => valid.has(id));

  // Update each page with its new ordering. PGlite doesn't have UPDATE ... FROM VALUES, so
  // do sequential single-row updates. There are at most a few dozen per space — fast enough.
  for (let i = 0; i < filtered.length; i++) {
    await db
      .update(schema.pages)
      .set({ ordering: (i + 1) * 100, updatedAt: new Date() })
      .where(eq(schema.pages.id, filtered[i]));
  }

  await logAudit({
    type: 'structural.pages_reordered',
    actor: 'user',
    payload: { count: filtered.length, spaceSlug: slug },
    relatedIds: { spaceId: space.id },
  });

  return NextResponse.json({ ok: true, count: filtered.length });
}
