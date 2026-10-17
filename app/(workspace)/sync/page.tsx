import fs from 'node:fs';
import { desc } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { Badge } from '@/components/ui/badge';
import { formatRelativeTime } from '@/lib/utils';
import { SyncNowButton } from '@/components/sync-now-button';

export default async function SyncPage() {
  const db = getDb();
  const syncs = await db.select().from(schema.codeSyncs).orderBy(desc(schema.codeSyncs.createdAt)).limit(20);
  const [lastRow] = await db.select().from(schema.settings).where(sql1());
  const configuredPath = process.env.NACORA_CODE_PATH ?? '(not set)';
  const pathExists = process.env.NACORA_CODE_PATH ? fs.existsSync(process.env.NACORA_CODE_PATH) : false;

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Code Sync</h1>
      <p className="mb-4 text-sm text-text-muted">
        The KB reads your InSurance checkout read-only.{' '}
        {(lastRow?.value as string | null)
          ? <>Detects changes with local <code>git diff</code>. Pull latest in VSCode, then press Sync now.</>
          : <><b>First run:</b> pressing Sync now enumerates every Nacora-scoped file at HEAD, picks the relevant ones per page, and drafts a Proposal for each code-first page. This takes a few minutes and consumes Anthropic tokens. Review the proposals afterwards — nothing hits a page until you approve.</>
        }
      </p>

      <div className="mb-6 rounded-lg border border-border p-3 text-sm">
        <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
          <span className="text-text-muted">Repo path</span>
          <code className="text-xs">{configuredPath}</code>
          <span className="text-text-muted">Path exists</span>
          <span>{pathExists ? <Badge variant="success">yes</Badge> : <Badge variant="warning">no — set NACORA_CODE_PATH</Badge>}</span>
          <span className="text-text-muted">Last synced commit</span>
          <code className="text-xs">{(lastRow?.value as string | null) ?? '(never)'}</code>
        </div>
        <div className="mt-3">
          <SyncNowButton disabled={!pathExists} />
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-text-muted">History</h2>
      {syncs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-muted">
          No syncs yet.
        </div>
      ) : (
        <ol className="space-y-2">
          {syncs.map((s) => {
            const summary = (s.changesSummary as any) ?? {};
            return (
              <li key={s.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-xs">{(s.fromCommit ?? 'initial').slice(0, 8)} → {s.toCommit.slice(0, 8)}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {(summary.counts?.primary ?? 0) + (summary.counts?.shared ?? 0)} files
                  </Badge>
                  <span className="ml-auto text-xs text-text-muted">{formatRelativeTime(s.createdAt as unknown as string)}</span>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-text-muted">show files</summary>
                  <pre className="mt-1 max-h-40 overflow-y-auto rounded-md bg-surface-muted p-2 text-[11px] text-text-muted">
                    {JSON.stringify(summary.changedFiles ?? [], null, 2)}
                  </pre>
                </details>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// Deferred import to avoid an unused eq import above.
function sql1() {
  const { eq } = require('drizzle-orm');
  return eq(schema.settings.key, 'last_synced_commit');
}
