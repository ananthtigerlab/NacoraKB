import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { ensureDbReady } from '@/lib/db/init';
import { getDb, schema } from '@/lib/db/client';
import { generateDiagram } from '@/lib/synthesis/diagram';
import { saveDiagramToDisk, saveSceneToDisk } from '@/lib/synthesis/diagram-backup';
import { hasProviderKey, activeProvider } from '@/lib/llm';

async function pageAndSpace(db: ReturnType<typeof getDb>, id: string) {
  const [page] = await db.select().from(schema.pages).where(eq(schema.pages.id, id)).limit(1);
  if (!page) return null;
  const [space] = await db.select().from(schema.spaces).where(eq(schema.spaces.id, page.spaceId)).limit(1);
  return space ? { page, spaceSlug: space.slug } : null;
}

// POST /api/pages/:id/diagram — regenerate the Mermaid diagram for a page from its current content.
// Refuses to overwrite a hand-edited scene unless `?force=1` is set — the client confirms first.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbReady();
  const db = getDb();
  const { id } = await params;
  const force = req.nextUrl.searchParams.get('force') === '1';

  if (!hasProviderKey()) {
    return NextResponse.json(
      { error: `No ${activeProvider().toUpperCase()}_API_KEY configured in .env` },
      { status: 400 },
    );
  }

  const found = await pageAndSpace(db, id);
  if (!found) return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  const { page, spaceSlug } = found;

  if (page.diagramScene && !force) {
    return NextResponse.json(
      { error: 'diagram was manually edited', code: 'manual_edit_exists' },
      { status: 409 },
    );
  }

  try {
    const diagram = await generateDiagram(page.title, page.content as any[]);
    // Regeneration always clears the hand-edited scene — the LLM output becomes canonical again.
    await db
      .update(schema.pages)
      .set({ diagram, diagramScene: null, updatedAt: new Date() })
      .where(eq(schema.pages.id, id));
    // Mirror to disk so we don't lose it on a DB wipe.
    saveDiagramToDisk(spaceSlug, page.slug, diagram);
    saveSceneToDisk(spaceSlug, page.slug, null);
    return NextResponse.json({ diagram, diagramScene: null });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

// PUT /api/pages/:id/diagram — save a specific diagram text and/or hand-edited Excalidraw scene.
// Any field omitted is left alone. `diagram_scene: null` explicitly clears it (reverts to LLM view).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbReady();
  const db = getDb();
  const { id } = await params;
  const body = (await req.json()) as {
    diagram?: string | null;
    diagram_scene?: { elements: unknown[]; files?: Record<string, unknown> } | null;
  };
  const patch: Partial<typeof schema.pages.$inferInsert> = { updatedAt: new Date() };
  if ('diagram' in body) patch.diagram = body.diagram as string | null;
  if ('diagram_scene' in body) patch.diagramScene = body.diagram_scene as any;
  await db.update(schema.pages).set(patch).where(eq(schema.pages.id, id));

  const found = await pageAndSpace(db, id);
  if (found) {
    if ('diagram' in body) saveDiagramToDisk(found.spaceSlug, found.page.slug, body.diagram ?? null);
    if ('diagram_scene' in body) saveSceneToDisk(found.spaceSlug, found.page.slug, (body.diagram_scene as any) ?? null);
  }
  return NextResponse.json({ ok: true });
}

// DELETE /api/pages/:id/diagram — clear both the Mermaid text and the hand-edited scene.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbReady();
  const db = getDb();
  const { id } = await params;
  const found = await pageAndSpace(db, id);
  await db.update(schema.pages)
    .set({ diagram: null, diagramScene: null, updatedAt: new Date() })
    .where(eq(schema.pages.id, id));
  if (found) {
    saveDiagramToDisk(found.spaceSlug, found.page.slug, null);
    saveSceneToDisk(found.spaceSlug, found.page.slug, null);
  }
  return NextResponse.json({ ok: true });
}
