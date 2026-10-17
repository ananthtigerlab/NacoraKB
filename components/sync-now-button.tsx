'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

async function callSync(force: boolean) {
  const res = await fetch(`/api/sync${force ? '?force=1' : ''}`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function describe(j: any): { title: string; description: string } {
  const modeLabel =
    j.mode === 'initial' ? 'Initial discovery' : j.mode === 'incremental' ? 'Incremental sync' : 'No changes';
  const parts = [
    `${j.changedCount ?? 0} files considered`,
    `${j.proposalCount ?? 0} proposal(s) drafted`,
  ];
  if (j.newPagesCreated) parts.push(`${j.newPagesCreated} new page(s) proposed`);
  if (j.conflictCount) parts.push(`${j.conflictCount} conflict(s)`);
  parts.push('Review in Proposals.');
  return { title: `${modeLabel} complete`, description: parts.join(' · ') };
}

export function SyncNowButton({ disabled }: { disabled?: boolean }) {
  const [busy, setBusy] = React.useState<null | 'inc' | 'force'>(null);
  const router = useRouter();

  async function run(force: boolean) {
    setBusy(force ? 'force' : 'inc');
    try {
      const j = await callSync(force);
      const t = describe(j);
      toast({ title: t.title, description: t.description, variant: 'success' });
      router.refresh();
    } catch (err) {
      toast({ title: 'Sync failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="accent" size="sm" disabled={disabled || busy !== null} onClick={() => run(false)}>
        <RefreshCw className={busy === 'inc' ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        {busy === 'inc' ? 'Syncing…' : 'Sync now'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || busy !== null}
        onClick={() => {
          if (
            !confirm(
              'Force initial discovery? This ignores the last_synced_commit marker and re-runs the full login→logout trace, proposing new pages if the code reveals concepts your candidate list is missing. Takes 3–8 minutes and consumes Anthropic tokens. Any existing proposals stay untouched.',
            )
          )
            return;
          run(true);
        }}
      >
        <Sparkles className={busy === 'force' ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
        {busy === 'force' ? 'Discovering…' : 'Force initial discovery'}
      </Button>
    </div>
  );
}
