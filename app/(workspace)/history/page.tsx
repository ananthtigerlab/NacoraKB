import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/utils';

// PRD §8 — immutable, append-only event log. This page just renders it.

const ACTOR_COLOURS: Record<string, 'default' | 'secondary' | 'accent' | 'warning' | 'success'> = {
  user: 'default',
  model: 'accent',
  sync: 'secondary',
  system: 'secondary',
};

export default async function HistoryPage() {
  const db = getDb();
  const events = await db
    .select()
    .from(schema.auditEvents)
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(200);

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">History</h1>
      <p className="mb-6 text-sm text-text-muted">
        Append-only. Every upload, proposal, merge, edit, sync, and structural change is recorded here.
      </p>
      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <ol className="relative border-l border-border pl-6">
          {events.map((e) => (
            <li key={e.id} className="mb-4">
              <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-border bg-surface" />
              <div className="flex flex-wrap items-baseline gap-2">
                <Badge variant={ACTOR_COLOURS[e.actor] ?? 'default'} className="text-[10px]">
                  {e.actor}
                </Badge>
                <span className="font-mono text-xs text-text-muted">{e.type}</span>
                <span className="ml-auto text-xs text-text-muted">
                  {formatRelativeTime(e.createdAt as unknown as string)}
                </span>
              </div>
              {Object.keys(e.payload || {}).length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-text-muted hover:text-text">details</summary>
                  <pre className="mt-1 max-h-40 overflow-y-auto rounded-md bg-surface-muted p-2 text-[11px] leading-tight text-text-muted">
                    {JSON.stringify({ payload: e.payload, relatedIds: e.relatedIds }, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
      Nothing has happened yet. Upload an artifact or edit a page and this feed starts filling up.
    </div>
  );
}
