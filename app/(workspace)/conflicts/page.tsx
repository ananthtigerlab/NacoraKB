import Link from 'next/link';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/utils';
import { ResolveButton } from '@/components/resolve-button';

// PRD §5.7 — code vs human-source disagreements.

export default async function ConflictsPage() {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.conflicts)
    .orderBy(desc(schema.conflicts.createdAt))
    .limit(200);

  const pageIds = Array.from(new Set(rows.map((r) => r.pageId)));
  const pages = pageIds.length ? await db.select().from(schema.pages).where(inArray(schema.pages.id, pageIds)) : [];
  const pagesById = new Map(pages.map((p) => [p.id, p]));
  const spaces = await db.select().from(schema.spaces);
  const spaceById = new Map(spaces.map((s) => [s.id, s]));

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Conflicts</h1>
      <p className="mb-6 text-sm text-text-muted">
        Where code and a human source disagree. Each conflict is a BA question, not a bug — decide whether the human input is stale, wrong, or signalling a planned change.
      </p>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
          No conflicts flagged yet. They'll appear here when a code sync surfaces one.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => {
            const p = pagesById.get(c.pageId);
            const space = p ? spaceById.get(p.spaceId) : null;
            return (
              <li key={c.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant={c.status === 'open' ? 'warning' : 'success'}>{c.status}</Badge>
                  {p && space && (
                    <Link href={`/s/${space.slug}/p/${p.slug}`} className="text-sm font-medium hover:underline">
                      {p.title}
                    </Link>
                  )}
                  <span className="ml-auto text-xs text-text-muted">
                    {formatRelativeTime(c.createdAt as unknown as string)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-surface-muted p-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Code says</div>
                    {c.codeStatement}
                  </div>
                  <div className="rounded-md bg-warning/10 p-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">Human source says</div>
                    {c.humanStatement}
                  </div>
                </div>
                {c.status === 'open' && <div className="mt-2 flex justify-end"><ResolveButton conflictId={c.id} /></div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
