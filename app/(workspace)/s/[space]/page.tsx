import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { Badge } from '@/components/ui/badge';
import { SpaceIndex } from '@/components/space-index';

export default async function SpacePage({ params }: { params: Promise<{ space: string }> }) {
  const { space: spaceSlug } = await params;
  const db = getDb();
  const [space] = await db.select().from(schema.spaces).where(eq(schema.spaces.slug, spaceSlug)).limit(1);
  if (!space) notFound();
  const pages = await db
    .select({
      id: schema.pages.id,
      title: schema.pages.title,
      slug: schema.pages.slug,
      isSystem: schema.pages.isSystem,
      ordering: schema.pages.ordering,
    })
    .from(schema.pages)
    .where(eq(schema.pages.spaceId, space.id))
    .orderBy(asc(schema.pages.ordering), asc(schema.pages.createdAt));

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{space.name}</h1>
          <Badge variant="outline">{space.groundingMode.replace('_', '-')}</Badge>
        </div>
        {space.description && <p className="text-sm text-text-muted">{space.description}</p>}
        <p className="mt-2 text-sm text-text-muted">
          {pages.length} pages. Drag the handle or use the arrow buttons to change the sidebar order.
        </p>
      </div>
      <SpaceIndex spaceSlug={space.slug} pages={pages} />
    </div>
  );
}
