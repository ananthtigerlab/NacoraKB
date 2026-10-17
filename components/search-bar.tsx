'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Loader2, CornerDownLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn, truncate } from '@/lib/utils';

// PRD §5.8 — global search bar, keyword search + tag facets. Ships as-you-type results.
// Backed by /api/search which uses Postgres full-text search (see lib/db/migrate.ts FTS block).

type Hit =
  | { kind: 'page'; id: string; title: string; snippet: string; spaceSlug: string; slug: string; tags: string[] }
  | { kind: 'source'; id: string; label: string; type: string; snippet: string };

export function SearchBar() {
  const router = useRouter();
  const [q, setQ] = React.useState('');
  const [tags, setTags] = React.useState<string[]>([]);
  const [open, setOpen] = React.useState(false);
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [loading, setLoading] = React.useState(false);

  function submit() {
    const query = q.trim();
    if (!query && tags.length === 0) return;
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    tags.forEach((t) => params.append('tag', t));
    setOpen(false);
    router.push(`/search?${params.toString()}`);
  }

  React.useEffect(() => {
    if (!q.trim() && tags.length === 0) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q });
        tags.forEach((t) => params.append('tag', t));
        const res = await fetch(`/api/search?${params}`, { signal: ctrl.signal });
        if (res.ok) setHits(await res.json());
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q, tags]);

  const showPopover = open && (q.trim().length > 0 || tags.length > 0);

  return (
    <Popover open={showPopover} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative flex items-center gap-1">
          <Search className="absolute left-2.5 h-4 w-4 text-text-muted" />
          <Input
            placeholder="Search pages, tags, uploads — press Enter for AI answer"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            className="pl-8 pr-8"
            aria-label="Global search"
          />
          {!loading && q.trim().length > 0 && (
            <CornerDownLeft className="pointer-events-none absolute right-2.5 h-4 w-4 text-text-subtle" aria-hidden />
          )}
          {loading && <Loader2 className="absolute right-2.5 h-4 w-4 animate-spin text-text-muted" />}
          {tags.map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="ml-1 cursor-pointer"
              onClick={() => setTags((cur) => cur.filter((x) => x !== t))}
            >
              #{t} ×
            </Badge>
          ))}
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-[520px] p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
        {hits.length === 0 ? (
          <div className="p-3 text-sm text-text-muted">No matches yet.</div>
        ) : (
          <ul className="max-h-80 overflow-y-auto scrollbar-thin">
            {hits.map((h) => (
              <li key={`${h.kind}-${h.id}`}>
                {h.kind === 'page' ? (
                  <Link
                    href={`/s/${h.spaceSlug}/p/${h.slug}`}
                    onClick={() => setOpen(false)}
                    className={cn('block rounded-md p-2 hover:bg-surface-muted')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{h.title}</span>
                      <span className="text-xs text-text-muted">{h.spaceSlug}</span>
                    </div>
                    {h.snippet && <div className="text-xs text-text-muted">{truncate(h.snippet, 140)}</div>}
                    {h.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {h.tags.map((t) => (
                          <Badge
                            key={t}
                            variant="secondary"
                            className="cursor-pointer text-[10px]"
                            onClick={(e) => {
                              e.preventDefault();
                              setTags((cur) => (cur.includes(t) ? cur : [...cur, t]));
                            }}
                          >
                            #{t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </Link>
                ) : (
                  <Link
                    href={`/sources#${h.id}`}
                    onClick={() => setOpen(false)}
                    className="block rounded-md p-2 hover:bg-surface-muted"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">{h.label}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {h.type}
                      </Badge>
                    </div>
                    {h.snippet && <div className="text-xs text-text-muted">{truncate(h.snippet, 140)}</div>}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
