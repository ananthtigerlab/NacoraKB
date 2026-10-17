import { NextRequest, NextResponse } from 'next/server';
import { ensureDbReady } from '@/lib/db/init';

export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  await ensureDbReady();
  const { name } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    switch (name) {
      case 'jira': {
        const { pullJira } = await import('@/lib/connectors/jira');
        return NextResponse.json(await pullJira(body.jql, body.limit));
      }
      case 'figma': {
        const { pullFigma } = await import('@/lib/connectors/figma');
        if (!body.fileKey) return NextResponse.json({ error: 'fileKey required' }, { status: 400 });
        return NextResponse.json(await pullFigma(body.fileKey));
      }
      case 'google-doc': {
        const { pullGoogleDoc } = await import('@/lib/connectors/google');
        if (!body.url) return NextResponse.json({ error: 'url required' }, { status: 400 });
        return NextResponse.json(await pullGoogleDoc(body.url));
      }
      default:
        return NextResponse.json({ error: 'unknown_connector' }, { status: 404 });
    }
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
