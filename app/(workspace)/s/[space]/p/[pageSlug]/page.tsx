import { notFound } from 'next/navigation';
import { and, eq, inArray, desc } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { PageView } from '@/components/page-view';

export default async function PageRoute({ params }: { params: Promise<{ space: string; pageSlug: string }> }) {
  const { space: spaceSlug, pageSlug } = await params;
  const db = getDb();
  const [space] = await db.select().from(schema.spaces).where(eq(schema.spaces.slug, spaceSlug)).limit(1);
  if (!space) notFound();

  const [page] = await db
    .select()
    .from(schema.pages)
    .where(and(eq(schema.pages.spaceId, space.id), eq(schema.pages.slug, pageSlug)))
    .limit(1);
  if (!page) notFound();

  const pageTagRows = await db
    .select({ tagId: schema.pageTags.tagId, name: schema.tags.name })
    .from(schema.pageTags)
    .innerJoin(schema.tags, eq(schema.pageTags.tagId, schema.tags.id))
    .where(eq(schema.pageTags.pageId, page.id));

  const allTagRows = await db.select({ name: schema.tags.name }).from(schema.tags);

  const versions = await db
    .select({ id: schema.pageVersions.id, createdBy: schema.pageVersions.createdBy, createdAt: schema.pageVersions.createdAt })
    .from(schema.pageVersions)
    .where(eq(schema.pageVersions.pageId, page.id))
    .orderBy(desc(schema.pageVersions.createdAt))
    .limit(20);

  let sources: Array<{ id: string; label: string; type: string }> = [];
  if (page.sourceIds.length > 0) {
    sources = await db
      .select({ id: schema.sources.id, label: schema.sources.label, type: schema.sources.type })
      .from(schema.sources)
      .where(inArray(schema.sources.id, page.sourceIds as string[]));
  }

  const proposalCount = (
    await db
      .select({ id: schema.proposals.id })
      .from(schema.proposals)
      .where(and(eq(schema.proposals.targetPageId, page.id), eq(schema.proposals.status, 'pending')))
  ).length;

  const conflictCount = (
    await db
      .select({ id: schema.conflicts.id })
      .from(schema.conflicts)
      .where(and(eq(schema.conflicts.pageId, page.id), eq(schema.conflicts.status, 'open')))
  ).length;

  return (
    <PageView
      page={{
        id: page.id,
        title: page.title,
        content: page.content as any,
        diagram: page.diagram ?? null,
        diagramScene: (page.diagramScene as any) ?? null,
        groundingMode: page.groundingMode ?? space.groundingMode,
        updatedAt: page.updatedAt as unknown as string,
      }}
      space={{ slug: space.slug, name: space.name }}
      tags={pageTagRows.map((r) => r.name)}
      allTags={allTagRows.map((r) => r.name)}
      versions={versions.map((v) => ({ id: v.id, createdBy: v.createdBy, createdAt: v.createdAt as unknown as string }))}
      sources={sources}
      pendingProposalCount={proposalCount}
      openConflictCount={conflictCount}
    />
  );
}
