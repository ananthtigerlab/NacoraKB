import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ensureDbReady } from '@/lib/db/init';
import { getSetting, setSetting } from '@/lib/settings';
import { logAudit } from '@/lib/audit';

const SetSchema = z.object({
  key: z.enum(['auto_merge_enabled', 'auto_merge_scopes', 'auto_merge_max_pages']),
  value: z.any(),
});

export async function GET() {
  await ensureDbReady();
  return NextResponse.json({
    auto_merge_enabled: await getSetting('auto_merge_enabled'),
    auto_merge_scopes: await getSetting('auto_merge_scopes'),
    auto_merge_max_pages: await getSetting('auto_merge_max_pages'),
  });
}

export async function PUT(req: NextRequest) {
  await ensureDbReady();
  const body = SetSchema.parse(await req.json());
  await setSetting(body.key as any, body.value);
  await logAudit({ type: 'settings.updated', actor: 'user', payload: body });
  return NextResponse.json({ ok: true });
}
