'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Editor } from '@/components/editor-loader';
import { TagInput } from '@/components/tag-input';
import { PageToc } from '@/components/page-toc';
import { PageDiagram } from '@/components/page-diagram';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertTriangle, History, Inbox, ChevronDown, FileCode, FileText, ExternalLink, Presentation, MessagesSquare, Ticket, Trash2, MoreHorizontal } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

/**
 * Render a "just now" / "3m ago" label that is safe against SSR hydration mismatch.
 * The server can render at time T; by the time the client hydrates at T+N seconds, the elapsed
 * time computes differently — React logs a mismatch. Fix: render nothing (or a stable placeholder)
 * on the server and compute the real string only after mount, then re-tick every 30s.
 */
function RelativeTime({ iso }: { iso: string }) {
  const [label, setLabel] = React.useState<string | null>(null);
  React.useEffect(() => {
    const update = () => setLabel(formatRelativeTime(iso));
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, [iso]);
  // suppressHydrationWarning avoids a benign whitespace mismatch in the fallback state.
  return <span suppressHydrationWarning>{label ?? ' '}</span>;
}

type PageViewProps = {
  page: {
    id: string;
    title: string;
    content: any[];
    diagram: string | null;
    diagramScene: { elements: unknown[]; files?: Record<string, unknown> } | null;
    groundingMode: 'code_first' | 'human_source';
    updatedAt: string;
  };
  space: { slug: string; name: string };
  tags: string[];
  allTags: string[];
  versions: Array<{ id: string; createdBy: 'user' | 'model' | 'sync'; createdAt: string }>;
  sources: Array<{ id: string; label: string; type: string }>;
  pendingProposalCount: number;
  openConflictCount: number;
};

// Extract text from a BlockNote inline content array.
function inlineText(nodes: any): string {
  if (!nodes) return '';
  if (typeof nodes === 'string') return nodes;
  if (Array.isArray(nodes)) return nodes.map(inlineText).join('');
  if (nodes.text) return nodes.text;
  if (nodes.content) return inlineText(nodes.content);
  return '';
}

// Strip a trailing "Related concepts" H2 and everything after it — user asked to remove this section.
function stripRelatedConcepts(content: any[]): any[] {
  if (!Array.isArray(content)) return content;
  for (let i = content.length - 1; i >= 0; i--) {
    const b = content[i];
    if (b?.type === 'heading' && (b.props?.level === 2 || b.props?.level === '2')) {
      const t = inlineText(b.content).trim().toLowerCase();
      if (t === 'related concepts' || t === 'related' || t === 'see also') {
        return content.slice(0, i);
      }
    }
  }
  return content;
}

type SourceLink = { label: string; note?: string; href?: string; icon: React.ComponentType<{ className?: string }> };

function sourcesForSpace(spaceSlug: string): SourceLink[] {
  switch (spaceSlug) {
    case 'product':
      return [
        { label: 'InSurance code repo', note: '~/Downloads/GitHubProjects/InSurance (read-only, local)', icon: FileCode },
        { label: 'Official Nacora docs', note: 'nacora-docs.i2go.io — 84 pages, tigerlab OAuth', href: 'https://nacora-docs.i2go.io', icon: ExternalLink },
        { label: 'Nacora KT doc', note: 'Thiva (departing PM) — 2026-06-23 session transcript', icon: FileText },
        { label: 'Jira — NBMS project', note: '100 tickets extracted (note: NBMS is the broker system, not this MGA product)', icon: Ticket },
      ];
    case 'technical':
      return [
        { label: 'InSurance code repo', note: 'Django + React monorepo, scope filtered by nacora.paths.json', icon: FileCode },
        { label: 'nacora.paths.json', note: 'The list of Nacora-owned paths in the shared monorepo', icon: FileText },
      ];
    case 'client-foundation':
      return [
        { label: 'Google Slides', note: 'PRD-seeded client overview deck', icon: Presentation },
        { label: 'Nacora KT doc', note: 'Thiva — organisation tree, key people, ways of working', icon: FileText },
      ];
    case 'delivery':
      return [
        { label: 'Jira — NBMS project', note: '100 tickets on the delivery board', icon: Ticket },
        { label: 'PRDver3.md', note: '~/Downloads/PRDver3.md — product requirements document', icon: FileText },
        { label: 'Meeting notes', note: 'KT session with Thiva on 2026-06-23; regular delivery syncs', icon: FileText },
      ];
    default:
      return [];
  }
}

export function PageView({ page, space, tags, allTags, versions, sources, pendingProposalCount, openConflictCount }: PageViewProps) {
  const router = useRouter();
  const [title, setTitle] = React.useState(page.title);
  const titleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanedContent = React.useMemo(() => stripRelatedConcepts(page.content), [page.content]);

  function onTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: e.target.value }),
      });
      if (!res.ok) { toast({ title: 'Failed to rename', variant: 'destructive' }); return; }
      const body = (await res.json().catch(() => ({}))) as { slugChanged?: boolean; slug?: string; spaceSlug?: string };
      // If the title change produced a new slug, update the URL in-place so future links
      // point to the current name.
      if (body.slugChanged && body.slug && body.spaceSlug) {
        router.replace(`/s/${body.spaceSlug}/p/${body.slug}`);
      } else {
        router.refresh();
      }
    }, 600);
  }

  async function onDelete() {
    const ok = window.confirm(
      `Delete "${title}"? This removes the page, its diagram, and its markdown source file. This can't be undone.`,
    );
    if (!ok) return;
    const res = await fetch(`/api/pages/${page.id}`, { method: 'DELETE' });
    const body = (await res.json().catch(() => ({}))) as { spaceSlug?: string; error?: string };
    if (!res.ok) {
      toast({ title: 'Failed to delete', description: body.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Page deleted', variant: 'success' });
    router.push(body.spaceSlug ? `/s/${body.spaceSlug}` : '/');
    router.refresh();
  }

  const spaceSources = sourcesForSpace(space.slug);

  return (
    <div className="mx-auto flex max-w-[1400px] gap-12 px-10 py-10">
      {/*
        min-w-0 flex-1 lets the column shrink; the inner max-w constrains the reading text
        to ~72ch and mx-auto centres it inside the column so on a wide screen the whitespace
        splits evenly between the sidebar-side and the TOC-side instead of dumping all of it
        on the right.
      */}
      <div className="min-w-0 flex-1 flex justify-center">
        <div className="w-full" style={{ maxWidth: 'var(--reading-max)' }}>
        {/* Meta / badge row */}
        <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <Link href={`/s/${space.slug}`} className="font-medium uppercase tracking-wide hover:text-primary hover:underline">
            {space.name}
          </Link>
          <span className="text-text-subtle">·</span>
          <Badge variant="outline" className="text-[10px]">
            {page.groundingMode === 'code_first' ? 'code-first' : 'human-source'}
          </Badge>
          <span className="text-text-subtle">updated <RelativeTime iso={page.updatedAt} /></span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-text-muted hover:text-danger"
              title="Delete this page"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm">
                  <History className="h-3.5 w-3.5" />
                  Versions
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <div className="text-xs font-semibold text-text-muted">Recent versions</div>
                {versions.length === 0 ? (
                  <div className="p-2 text-xs text-text-muted">No versions yet — every merge or direct edit creates one.</div>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {versions.map((v) => (
                      <li key={v.id} className="flex items-center justify-between rounded px-1 py-1 text-xs hover:bg-surface-muted">
                        <span>
                          <Badge variant="secondary" className="mr-1 text-[10px]">{v.createdBy}</Badge>
                          <RelativeTime iso={v.createdAt} />
                        </span>
                        <button
                          className="text-[11px] text-accent hover:underline"
                          onClick={async () => {
                            if (!confirm('Restore this version? A new version will be created for the current state.')) return;
                            const res = await fetch(`/api/pages/${page.id}/versions/${v.id}/restore`, { method: 'POST' });
                            if (res.ok) {
                              toast({ title: 'Restored', variant: 'success' });
                              router.refresh();
                            }
                          }}
                        >
                          restore
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Concept diagram — collapsible visual summary, above the title */}
        <PageDiagram pageId={page.id} diagram={page.diagram} diagramScene={page.diagramScene} />

        {/* Title — editable inline */}
        <input
          value={title}
          onChange={onTitleChange}
          className="mb-4 w-full bg-transparent text-[2.5rem] font-semibold leading-[1.15] tracking-[-0.02em] text-text outline-none placeholder:text-text-muted"
          placeholder="Untitled"
          aria-label="Page title"
        />

        {/* Tag row */}
        <div className="mb-8">
          <TagInput pageId={page.id} initialTags={tags} allTags={allTags} />
        </div>

        <div className="nacora-reading">
          <Editor pageId={page.id} initialContent={cleanedContent} onSaved={() => router.refresh()} />
        </div>

        {/* Sources footer — replaces the old Related concepts section */}
        <div className="mt-10 border-t border-border-muted pt-6" style={{ maxWidth: 'var(--reading-max)' }}>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            <MessagesSquare className="h-3.5 w-3.5" />
            Sources
          </div>
          {sources.length > 0 && (
            <ul className="mb-3 space-y-2">
              {sources.map((s) => (
                <li key={s.id} className="flex items-start gap-2 text-sm">
                  <Badge variant="secondary" className="text-[10px]">{s.type}</Badge>
                  <span className="text-text">{s.label}</span>
                </li>
              ))}
            </ul>
          )}
          {spaceSources.length > 0 && (
            <ul className="space-y-2 text-sm">
              {spaceSources.map((s) => {
                const Icon = s.icon;
                const body = (
                  <span className="flex items-start gap-2">
                    <Icon className="mt-[3px] h-3.5 w-3.5 shrink-0 text-text-subtle" />
                    <span>
                      <span className="font-medium text-text">{s.label}</span>
                      {s.note && <span className="text-text-muted"> — {s.note}</span>}
                    </span>
                  </span>
                );
                return (
                  <li key={s.label}>
                    {s.href ? (
                      <a href={s.href} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline">
                        {body}
                      </a>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {sources.length === 0 && spaceSources.length === 0 && (
            <p className="text-sm text-text-muted">No source records for this page.</p>
          )}
        </div>
        </div>
      </div>
      <PageToc content={cleanedContent} />
    </div>
  );
}
