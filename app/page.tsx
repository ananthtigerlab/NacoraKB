import { redirect } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { ensureDbReady } from '@/lib/db/init';
import { getDb, schema } from '@/lib/db/client';

// Home — send the BA to the first space's first page.

export default async function Home() {
  await ensureDbReady();
  const db = getDb();
  const [firstSpace] = await db
    .select()
    .from(schema.spaces)
    .orderBy(asc(schema.spaces.ordering))
    .limit(1);
  if (!firstSpace) redirect('/history');
  const [firstPage] = await db
    .select()
    .from(schema.pages)
    .where(eq(schema.pages.spaceId, firstSpace.id))
    .orderBy(asc(schema.pages.createdAt))
    .limit(1);
  if (!firstPage) redirect(`/s/${firstSpace.slug}`);
  redirect(`/s/${firstSpace.slug}/p/${firstPage.slug}`);
}
