import { ensureDbReady } from '@/lib/db/init';
import { getDb, schema } from '@/lib/db/client';
import { asc } from 'drizzle-orm';
import { Sidebar } from '@/components/sidebar';
import { TopBar } from '@/components/top-bar';
import { CommandPaletteProvider } from '@/components/command-palette';

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  await ensureDbReady();
  const db = getDb();
  const spaces = await db.select().from(schema.spaces).orderBy(asc(schema.spaces.ordering));
  const allPages = await db
    .select()
    .from(schema.pages)
    .orderBy(asc(schema.pages.ordering), asc(schema.pages.createdAt));

  const pagesBySpace = spaces.map((s) => ({
    ...s,
    pages: allPages.filter((p) => p.spaceId === s.id),
  }));

  return (
    <CommandPaletteProvider spaces={spaces} pages={allPages}>
      <div className="flex h-screen flex-col">
        <TopBar />
        <div className="flex flex-1 min-h-0">
          <Sidebar data={pagesBySpace} />
          <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
