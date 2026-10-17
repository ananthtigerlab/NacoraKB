import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { ensureDbReady } from '@/lib/db/init';
import { getDb, schema } from '@/lib/db/client';
import { logAudit } from '@/lib/audit';
import { extractText } from '@/lib/extractors';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads');

async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function POST(req: NextRequest) {
  await ensureDbReady();
  await ensureDir();
  const db = getDb();
  const form = await req.formData();

  const label = String(form.get('label') || 'Untitled');
  const type = String(form.get('type') || 'upload') as any;
  const url = form.get('url') ? String(form.get('url')) : null;
  const notes = form.get('notes') ? String(form.get('notes')) : null;
  const tagsRaw = form.get('tags') ? String(form.get('tags')) : '';
  const file = form.get('file') as File | null;

  let filePath: string | null = null;
  let mimeType: string | undefined;

  if (file && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]+/g, '_')}`;
    filePath = path.join(UPLOAD_DIR, safeName);
    await fs.writeFile(filePath, buf);
    mimeType = file.type;
  }

  let extracted = '';
  if (filePath) {
    extracted = await extractText(filePath, mimeType);
  }
  if (notes) extracted = extracted ? `${extracted}\n\n---\nBA notes:\n${notes}` : notes;

  const sourceId = nanoid();
  await db.insert(schema.sources).values({
    id: sourceId,
    type,
    label,
    filePath,
    url,
    extractedText: extracted || null,
    metadata: { mimeType, size: file?.size ?? 0, notes },
  });

  // Tags on the source
  const tagNames = tagsRaw
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tagNames.length) {
    const existingRows = await db.select().from(schema.tags);
    const byName = new Map(existingRows.map((t) => [t.name, t]));
    for (const name of tagNames) {
      let row = byName.get(name);
      if (!row) {
        const id = nanoid();
        await db.insert(schema.tags).values({ id, name, category: 'other' });
        row = { id, name, category: 'other', createdAt: new Date() } as (typeof existingRows)[number];
      }
      await db.insert(schema.sourceTags).values({ sourceId, tagId: row.id }).onConflictDoNothing();
    }
  }

  const auditId = await logAudit({
    type: 'upload',
    actor: 'user',
    payload: { label, type, hasFile: !!file, mimeType, extractedLength: extracted.length },
    relatedIds: { sourceId },
  });

  // Kick Phase 1 pipeline. Best-effort: if no LLM key is configured, we skip synthesis and just keep the source.
  let proposalCount = 0;
  try {
    const { ingestSource } = await import('@/lib/synthesis/ingest');
    const result = await ingestSource(sourceId);
    proposalCount = result.proposalCount;
  } catch (err) {
    console.warn('[upload] Phase 1 ingest skipped:', (err as Error).message);
  }

  return NextResponse.json({ id: sourceId, auditId, proposalCount });
}
