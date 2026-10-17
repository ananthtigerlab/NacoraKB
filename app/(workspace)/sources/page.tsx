import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime, truncate } from '@/lib/utils';

// PRD §4 — Source Library — index of every artifact ever uploaded/ingested.

export default async function SourcesPage() {
  const db = getDb();
  const rows = await db.select().from(schema.sources).orderBy(desc(schema.sources.ingestedAt)).limit(500);

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Source Library</h1>
      <p className="mb-6 text-sm text-text-muted">
        Every artifact you've uploaded, plus every code-sync record. Click a row to see the extracted text.
      </p>
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
          No sources yet. Drop a file or paste a screenshot to start.
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {rows.map((s) => (
            <details key={s.id} id={s.id} className="group px-3 py-2">
              <summary className="flex cursor-pointer items-center gap-2 text-sm">
                <Badge variant="secondary" className="text-[10px]">
                  {s.type}
                </Badge>
                <span className="font-medium">{s.label}</span>
                <span className="ml-auto text-xs text-text-muted">
                  {formatRelativeTime(s.ingestedAt as unknown as string)}
                </span>
              </summary>
              <div className="mt-2 space-y-1 text-xs text-text-muted">
                {s.url && (
                  <div>
                    URL:{' '}
                    <a href={s.url} target="_blank" rel="noopener" className="text-accent hover:underline">
                      {s.url}
                    </a>
                  </div>
                )}
                {s.filePath && <div>Path: <code>{s.filePath}</code></div>}
                {s.extractedText && (
                  <pre className="mt-2 max-h-64 overflow-y-auto rounded-md bg-surface-muted p-2 leading-tight text-text-muted">
                    {truncate(s.extractedText, 4000)}
                  </pre>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
