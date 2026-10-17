import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { nanoid } from 'nanoid';

// Handles image / file paste + upload inside the BlockNote editor.
// Files are written to public/user-uploads/ so Next.js serves them at /user-uploads/<name>.
// Returns { url } — the shape BlockNote's uploadFile helper expects.

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'user-uploads');

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
  'application/pdf',
]);

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 });

  const mime = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: `unsupported mime type: ${mime}` }, { status: 415 });
  }
  // 20MB hard cap so pasted screenshots don't blow up disk
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'file too large (max 20MB)' }, { status: 413 });
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const ext = extFor(mime, file.name);
  const filename = `${Date.now()}-${nanoid(8)}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filepath, buf);

  return NextResponse.json({ url: `/user-uploads/${filename}` });
}

function extFor(mime: string, originalName: string): string {
  const fromName = path.extname(originalName || '').toLowerCase();
  if (fromName) return fromName;
  switch (mime) {
    case 'image/png': return '.png';
    case 'image/jpeg': return '.jpg';
    case 'image/gif': return '.gif';
    case 'image/webp': return '.webp';
    case 'image/svg+xml': return '.svg';
    case 'image/avif': return '.avif';
    case 'application/pdf': return '.pdf';
    default: return '';
  }
}
