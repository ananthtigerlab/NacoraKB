'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GripVertical, ChevronUp, ChevronDown, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

type Page = { id: string; title: string; slug: string; isSystem: boolean; ordering: number };

type Props = { spaceSlug: string; pages: Page[] };

export function SpaceIndex({ spaceSlug, pages: initialPages }: Props) {
  const router = useRouter();
  const [pages, setPages] = React.useState(initialPages);
  const [saving, setSaving] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => setPages(initialPages), [initialPages]);

  function persistOrder(next: Page[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const res = await fetch(`/api/spaces/${spaceSlug}/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageIds: next.map((p) => p.id) }),
        });
        if (!res.ok) throw new Error(await res.text());
        router.refresh();                                    // pick up new order in the sidebar
      } catch (e) {
        toast({ title: 'Save order failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
      } finally {
        setSaving(false);
      }
    }, 400);
  }

  function move(from: number, to: number) {
    if (from === to || to < 0 || to >= pages.length) return;
    const next = pages.slice();
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    setPages(next);
    persistOrder(next);
  }

  async function deletePage(p: Page) {
    if (p.isSystem) {
      toast({ title: "Can't delete", description: 'This is a system page.', variant: 'destructive' });
      return;
    }
    const ok = window.confirm(`Delete "${p.title}"? Its markdown source and diagram files will also be removed. This can't be undone.`);
    if (!ok) return;
    const res = await fetch(`/api/pages/${p.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast({ title: 'Delete failed', description: body.error, variant: 'destructive' });
      return;
    }
    setPages((cur) => cur.filter((x) => x.id !== p.id));
    toast({ title: 'Page deleted', variant: 'success' });
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border-muted px-3 py-2 text-xs text-text-muted">
        <span>Order shown here = order in the sidebar.</span>
        <span className="flex items-center gap-1">
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          {saving ? 'Saving order…' : 'Saved'}
        </span>
      </div>
      <ul>
        {pages.map((p, i) => (
          <li
            key={p.id}
            draggable
            onDragStart={(e) => {
              setDragIndex(i);
              e.dataTransfer.effectAllowed = 'move';
              try { e.dataTransfer.setData('text/plain', String(i)); } catch { /* Safari */ }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (overIndex !== i) setOverIndex(i);
            }}
            onDragLeave={() => { if (overIndex === i) setOverIndex(null); }}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragIndex ?? Number(e.dataTransfer.getData('text/plain'));
              setOverIndex(null);
              setDragIndex(null);
              if (!Number.isNaN(from)) move(from, i);
            }}
            onDragEnd={() => { setOverIndex(null); setDragIndex(null); }}
            className={cn(
              'flex items-center gap-2 border-b border-border-muted px-3 py-2 last:border-b-0 transition-colors',
              dragIndex === i && 'opacity-40',
              overIndex === i && dragIndex !== null && dragIndex !== i && 'bg-primary/5',
            )}
          >
            <button
              className="flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded text-text-subtle hover:bg-surface-muted hover:text-text active:cursor-grabbing"
              aria-label={`Drag ${p.title}`}
              onMouseDown={(e) => e.currentTarget.blur()}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <span className="w-6 shrink-0 text-center text-[11px] tabular-nums text-text-subtle">{i + 1}</span>
            <Link
              href={`/s/${spaceSlug}/p/${p.slug}`}
              className="flex-1 truncate text-sm hover:text-primary hover:underline"
            >
              {p.title}
              {p.isSystem && <Badge className="ml-2">system</Badge>}
            </Link>
            <span className="hidden text-xs text-text-subtle sm:inline">/{p.slug}</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-surface-muted hover:text-text disabled:opacity-30"
                aria-label="Move up"
                title="Move up"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                onClick={() => move(i, i + 1)}
                disabled={i === pages.length - 1}
                className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-surface-muted hover:text-text disabled:opacity-30"
                aria-label="Move down"
                title="Move down"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <Link
                href={`/s/${spaceSlug}/p/${p.slug}`}
                className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-surface-muted hover:text-primary"
                aria-label="Open page"
                title="Open page"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <button
                onClick={() => deletePage(p)}
                disabled={p.isSystem}
                className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:bg-surface-muted hover:text-danger disabled:opacity-30"
                aria-label="Delete page"
                title="Delete page"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border border-border bg-surface-muted px-1.5 py-0 text-[10px] uppercase tracking-wide text-text-muted', className)}>
      {children}
    </span>
  );
}
