import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { ensureDbReady } from '@/lib/db/init';
import { getDb, schema } from '@/lib/db/client';
import { logAudit } from '@/lib/audit';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  await ensureDbReady();
  const { id, versionId } = await params;
  const db = getDb();

  const [pageRow] = await db.select().from(schema.pages).where(eq(schema.pages.id, id)).limit(1);
  const [version] = await db
    .select()
    .from(schema.pageVersions)
    .where(and(eq(schema.pageVersions.id, versionId), eq(schema.pageVersions.pageId, id)))
    .limit(1);
  if (!pageRow || !version) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const preRestoreId = nanoid();
  await db.insert(schema.pageVersions).values({
    id: preRestoreId,
    pageId: pageRow.id,
    title: pageRow.title,
    content: pageRow.content as any,
    createdBy: 'user',
  });

  await db
    .update(schema.pages)
    .set({ title: version.title, content: version.content as any, updatedAt: new Date() })
    .where(eq(schema.pages.id, id));

  await logAudit({
    type: 'restore',
    actor: 'user',
    payload: { restoredVersionId: versionId, snapshotBefore: preRestoreId },
    relatedIds: { pageId: id, versionId },
  });

  return NextResponse.json({ ok: true });
}
