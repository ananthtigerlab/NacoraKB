'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Edit3, X, ChevronDown, ChevronRight } from 'lucide-react';
import * as Diff from 'diff';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, formatRelativeTime } from '@/lib/utils';

// Client-only relative time to avoid SSR hydration mismatches — see components/page-view.tsx
function RelativeTime({ iso }: { iso: string }) {
  const [label, setLabel] = React.useState<string | null>(null);
  React.useEffect(() => {
    const update = () => setLabel(formatRelativeTime(iso));
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, [iso]);
  return <span suppressHydrationWarning>{label ?? ' '}</span>;
}
import { toast } from '@/components/ui/toast';
import { Editor } from '@/components/editor-loader';

type ProposalItem = {
  id: string;
  status: 'pending' | 'approved' | 'edited' | 'rejected';
  rationale: string | null;
  createdAt: string;
  pageId: string;
  pageTitle: string;
  currentContent: any[];
  proposedContent: any[];
};

export function ProposalsList({ items }: { items: ProposalItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-muted">
        No proposals yet. Upload an artifact or run a code sync to have Claude draft one.
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((p) => (
        <ProposalCard key={p.id} p={p} />
      ))}
    </ul>
  );
}

function ProposalCard({ p }: { p: ProposalItem }) {
  const [open, setOpen] = React.useState(p.status === 'pending');
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const editedContentRef = React.useRef<any[]>(p.proposedContent);
  const router = useRouter();

  const currentText = React.useMemo(() => blocksToText(p.currentContent), [p.currentContent]);
  const proposedText = React.useMemo(() => blocksToText(p.proposedContent), [p.proposedContent]);
  const diff = React.useMemo(() => Diff.diffWords(currentText, proposedText), [currentText, proposedText]);

  async function decide(decision: 'approved' | 'edited' | 'rejected') {
    setBusy(true);
    try {
      const res = await fetch(`/api/proposals/${p.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          editedContent: decision === 'edited' ? editedContentRef.current : null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: `Proposal ${decision}`, variant: decision === 'rejected' ? 'default' : 'success' });
      router.refresh();
    } catch (err) {
      toast({ title: 'Failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  // Keyboard shortcuts on the focused proposal — A approve, E edit, R reject (PRD §10.1.2).
  React.useEffect(() => {
    if (p.status !== 'pending') return;
    const h = (e: KeyboardEvent) => {
      if (!open) return;
      const target = e.target as HTMLElement;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      if (e.key.toLowerCase() === 'a') decide('approved');
      if (e.key.toLowerCase() === 'e') setEditing(true);
      if (e.key.toLowerCase() === 'r') decide('rejected');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, p.status]);

  return (
    <li className={cn('rounded-lg border border-border bg-surface', p.status !== 'pending' && 'opacity-70')}>
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setOpen((v) => !v)} className="rounded p-1 hover:bg-surface-muted" aria-label="Toggle">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <Badge variant={p.status === 'pending' ? 'accent' : p.status === 'rejected' ? 'danger' : 'success'}>
          {p.status}
        </Badge>
        <Link href={`/s/product/p/${p.pageId}`} className="text-sm font-medium hover:underline">
          {p.pageTitle}
        </Link>
        <span className="ml-auto text-xs text-text-muted"><RelativeTime iso={p.createdAt} /></span>
      </div>
      {open && (
        <div className="border-t border-border p-3">
          {p.rationale && (
            <p className="mb-2 text-xs italic text-text-muted">
              <span className="font-medium">Rationale:</span> {p.rationale}
            </p>
          )}
          {!editing ? (
            <>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Diff</div>
              <div className="max-h-60 overflow-y-auto rounded-md border border-border bg-surface-muted p-3 text-sm leading-relaxed">
                {diff.map((part, i) => (
                  <span
                    key={i}
                    className={cn(
                      part.added && 'bg-success/20 [color:hsl(var(--color-success))]',
                      part.removed && 'bg-destructive/20 text-destructive line-through',
                    )}
                  >
                    {part.value}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-md border border-border">
              <Editor
                pageId={`preview-${p.id}`}
                initialContent={p.proposedContent as any}
                onSaved={() => { /* no-op; we harvest on save button */ }}
              />
              <p className="border-t border-border px-3 py-2 text-[11px] text-text-muted">
                Edit above, then approve. Nothing is written to the real page until you press Approve.
              </p>
            </div>
          )}

          {p.status === 'pending' && (
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" variant="accent" onClick={() => decide(editing ? 'edited' : 'approved')} disabled={busy}>
                <Check className="h-4 w-4" />
                {editing ? 'Approve edit' : 'Approve'} <kbd className="ml-1 rounded bg-black/10 px-1 text-[10px]">A</kbd>
              </Button>
              {!editing && (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)} disabled={busy}>
                  <Edit3 className="h-4 w-4" /> Edit <kbd className="ml-1 rounded bg-black/10 px-1 text-[10px]">E</kbd>
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => decide('rejected')} disabled={busy}>
                <X className="h-4 w-4" /> Reject <kbd className="ml-1 rounded bg-black/10 px-1 text-[10px]">R</kbd>
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function blocksToText(blocks: any[] | undefined): string {
  if (!Array.isArray(blocks)) return '';
  const chunks: string[] = [];
  const walk = (arr: any[]) => {
    for (const b of arr) {
      if (Array.isArray(b?.content)) {
        for (const t of b.content) {
          if (t?.text) chunks.push(t.text);
        }
      }
      if (Array.isArray(b?.children)) walk(b.children);
      chunks.push('\n');
    }
  };
  walk(blocks);
  return chunks.join(' ').replace(/\s+\n\s*/g, '\n').trim();
}
