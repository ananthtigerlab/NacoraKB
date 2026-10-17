import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { ensureDbReady } from '@/lib/db/init';
import { getDb, schema } from '@/lib/db/client';

export async function GET() {
  await ensureDbReady();
  const db = getDb();
  const rows = await db.select().from(schema.tags).orderBy(asc(schema.tags.name));
  return NextResponse.json(rows);
}
