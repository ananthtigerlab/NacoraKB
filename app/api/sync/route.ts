import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/db/init';

export async function POST(req: NextRequest) {
  await ensureDbReady();
  const forceInitial = req.nextUrl.searchParams.get('force') === '1' || req.nextUrl.searchParams.get('initial') === '1';
  try {
    const { runSync } = await import('@/lib/code-sync/sync');
    const result = await runSync({ forceInitial });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
