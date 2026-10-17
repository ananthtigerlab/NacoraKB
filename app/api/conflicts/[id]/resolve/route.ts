import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { ensureDbReady } from '@/lib/db/init';
import { getDb, schema } from '@/lib/db/client';
import { logAudit } from '@/lib/audit';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbReady();
  const { id } = await params;
  const db = getDb();
  await db.update(schema.conflicts).set({ status: 'resolved' }).where(eq(schema.conflicts.id, id));
  await logAudit({ type: 'conflict_resolved', actor: 'user', relatedIds: { conflictId: id } });
  return NextResponse.json({ ok: true });
}
