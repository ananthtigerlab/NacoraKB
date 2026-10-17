import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { ensureDbReady } from '@/lib/db/init';
import { getDb, schema } from '@/lib/db/client';
import { logAudit } from '@/lib/audit';

const PutSchema = z.object({ tags: z.array(z.string().min(1).max(60)) });

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbReady();
  const { id } = await params;
  const db = getDb();
  const { tags: rawTags } = PutSchema.parse(await req.json());
  const tags = Array.from(new Set(rawTags.map((t) => t.trim().toLowerCase()).filter(Boolean)));

  const existingRows = await db.select().from(schema.tags);
  const byName = new Map(existingRows.map((t) => [t.name, t]));
  const tagIds: string[] = [];
  for (const name of tags) {
    let row = byName.get(name);
    if (!row) {
      const rowId = nanoid();
      await db.insert(schema.tags).values({ id: rowId, name, category: 'other' });
      row = { id: rowId, name, category: 'other', createdAt: new Date() } as (typeof existingRows)[number];
      byName.set(name, row);
    }
    tagIds.push(row.id);
  }

  await db.delete(schema.pageTags).where(eq(schema.pageTags.pageId, id));
  for (const tagId of tagIds) {
    await db.insert(schema.pageTags).values({ pageId: id, tagId });
  }

  await logAudit({
    type: 'structural.tags_updated',
    actor: 'user',
    payload: { tags },
    relatedIds: { pageId: id },
  });

  return NextResponse.json({ ok: true, tags });
}
