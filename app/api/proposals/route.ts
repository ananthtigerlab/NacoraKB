import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { ensureDbReady } from '@/lib/db/init';
import { getDb, schema } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  await ensureDbReady();
  const db = getDb();
  const status = req.nextUrl.searchParams.get('status') ?? 'pending';
  const rows = await db
    .select({
      id: schema.proposals.id,
      targetPageId: schema.proposals.targetPageId,
      status: schema.proposals.status,
      modelRationale: schema.proposals.modelRationale,
      createdAt: schema.proposals.createdAt,
    })
    .from(schema.proposals)
    .where(status === 'all' ? undefined : eq(schema.proposals.status, status as any))
    .orderBy(desc(schema.proposals.createdAt))
    .limit(100);
  return NextResponse.json(rows);
}
