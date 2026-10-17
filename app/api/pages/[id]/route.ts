import { NextRequest, NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDbReady } from '@/lib/db/init';
import { getDb, schema } from '@/lib/db/client';
import { logAudit } from '@/lib/audit';

const PatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.array(z.record(z.unknown())).optional(),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'untitled';
}

async function uniqueSlugInSpace(db: ReturnType<typeof getDb>, spaceId: string, base: string, excludePageId: string): Promise<string> {
  const existing = new Set(
    (await db.select({ slug: schema.pages.slug })
      .from(schema.pages)
      .where(and(eq(schema.pages.spaceId, spaceId), ne(schema.pages.id, excludePageId))))
      .map((r) => r.slug),
  );
  let candidate = base;
  let i = 2;
  while (existing.has(candidate)) { candidate = `${base}-${i++}`; }
  return candidate;
}

function safeRename(src: string, dst: string) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  try { fs.renameSync(src, dst); } catch { /* best effort */ }
}

function safeUnlink(p: string) {
  if (fs.existsSync(p)) try { fs.unlinkSync(p); } catch { /* best effort */ }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbReady();
  const { id } = await params;
  const db = getDb();
  const [page] = await db.select().from(schema.pages).where(eq(schema.pages.id, id)).limit(1);
  if (!page) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(page);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbReady();
  const { id } = await params;
  const db = getDb();
  const body = PatchSchema.parse(await req.json());

  const [existing] = await db.select().from(schema.pages).where(eq(schema.pages.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const [space] = await db.select().from(schema.spaces).where(eq(schema.spaces.id, existing.spaceId)).limit(1);
  if (!space) return NextResponse.json({ error: 'space_not_found' }, { status: 404 });

  // Snapshot the previous state as a version before applying the change (PRD §5.11).
  const versionId = nanoid();
  await db.insert(schema.pageVersions).values({
    id: versionId,
    pageId: existing.id,
    title: existing.title,
    content: existing.content as any,
    createdBy: 'user',
  });

  const update: Record<string, unknown> = { updatedAt: new Date() };
  let newSlug: string | null = null;
  if (body.title !== undefined && body.title.trim() !== existing.title) {
    update.title = body.title.trim();
    // Compute a URL-safe slug from the new title. If it changes, rename the on-disk
    // markdown + diagram files so the content:URL mapping stays coherent on future seeds.
    const base = slugify(body.title);
    const candidate = await uniqueSlugInSpace(db, existing.spaceId, base, existing.id);
    if (candidate !== existing.slug) {
      update.slug = candidate;
      newSlug = candidate;
      const contentDir = path.join(process.cwd(), 'content', space.slug);
      const diagramDir = path.join(process.cwd(), 'content', 'diagrams', space.slug);
      safeRename(path.join(contentDir, `${existing.slug}.md`), path.join(contentDir, `${candidate}.md`));
      safeRename(path.join(diagramDir, `${existing.slug}.mmd`), path.join(diagramDir, `${candidate}.mmd`));
      safeRename(path.join(diagramDir, `${existing.slug}.scene.json`), path.join(diagramDir, `${candidate}.scene.json`));
    }
  }
  if (body.content !== undefined) update.content = body.content;
  await db.update(schema.pages).set(update).where(eq(schema.pages.id, id));

  await logAudit({
    type: 'direct_edit',
    actor: 'user',
    payload: {
      changed: Object.keys(update).filter((k) => k !== 'updatedAt'),
      versionId,
      ...(newSlug ? { newSlug } : {}),
    },
    relatedIds: { pageId: id, versionId },
  });

  return NextResponse.json({
    ok: true,
    versionId,
    slug: (update.slug as string) ?? existing.slug,
    spaceSlug: space.slug,
    // Client can compare to existing route and router.replace when slug changed.
    slugChanged: Boolean(newSlug),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbReady();
  const { id } = await params;
  const db = getDb();
  const [existing] = await db.select().from(schema.pages).where(eq(schema.pages.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (existing.isSystem) return NextResponse.json({ error: 'system_page' }, { status: 403 });
  const [space] = await db.select().from(schema.spaces).where(eq(schema.spaces.id, existing.spaceId)).limit(1);

  // Delete the DB row (cascades pageVersions, pageTags, etc. via FK ON DELETE CASCADE)
  await db.delete(schema.pages).where(eq(schema.pages.id, id));

  // Delete the on-disk mirror so the next fresh seed doesn't restore the page.
  if (space) {
    safeUnlink(path.join(process.cwd(), 'content', space.slug, `${existing.slug}.md`));
    safeUnlink(path.join(process.cwd(), 'content', 'diagrams', space.slug, `${existing.slug}.mmd`));
    safeUnlink(path.join(process.cwd(), 'content', 'diagrams', space.slug, `${existing.slug}.scene.json`));
  }

  await logAudit({
    type: 'structural.page_deleted',
    actor: 'user',
    payload: { title: existing.title, slug: existing.slug, spaceSlug: space?.slug },
    relatedIds: { pageId: id },
  });
  return NextResponse.json({ ok: true, spaceSlug: space?.slug });
}
