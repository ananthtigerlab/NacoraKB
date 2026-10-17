'use client';
import * as React from 'react';
import Link from 'next/link';
import { Loader2, Sparkles, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type PageHit = {
  kind: 'page';
  id: string;
  title: string;
  snippet: string;
  spaceSlug: string;
  slug: string;
  tags: string[];
};
type SourceHit = { kind: 'source'; id: string; label: string; type: string; snippet: string };
type Hit = PageHit | SourceHit;

type Citation = { id: string; title: string; spaceSlug: string; spaceName: string; slug: string; href: string };

type AiAnswer = { answer: string; citations: Citation[] };

type Props = { initialQuery: string; initialTags: string[] };

export function SearchResults({ initialQuery, initialTags }: Props) {
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [ai, setAi] = React.useState<AiAnswer | null>(null);
  const [aiError, setAiError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!initialQuery && initialTags.length === 0) {
      setHits([]);
      setAi(null);
      return;
    }
    const ctrl = new AbortController();

    const isAbort = (e: unknown) =>
      (e as any)?.name === 'AbortError' || (typeof e === 'object' && e !== null && 'name' in e && (e as any).name === 'AbortError');

    // Kick off both fetches in parallel
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: initialQuery });
        initialTags.forEach((t) => params.append('tag', t));
        const res = await fetch(`/api/search?${params}`, { signal: ctrl.signal });
        if (res.ok) setHits(await res.json());
      } catch (e) {
        if (!isAbort(e)) console.error('search fetch failed', e);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    if (initialQuery) {
      (async () => {
        setAiLoading(true);
        setAiError(null);
        try {
          const res = await fetch('/api/ai-answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: initialQuery }),
            signal: ctrl.signal,
          });
          if (!res.ok) throw new Error(await res.text());
          setAi(await res.json());
        } catch (e) {
          if (!isAbort(e)) setAiError(e instanceof Error ? e.message : String(e));
        } finally {
          if (!ctrl.signal.aborted) setAiLoading(false);
        }
      })();
    } else {
      setAi(null);
    }

    return () => ctrl.abort();
  }, [initialQuery, initialTags.join('|')]);

  const pageHits = hits.filter((h): h is PageHit => h.kind === 'page');
  const sourceHits = hits.filter((h): h is SourceHit => h.kind === 'source');

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Search</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {initialQuery ? <>Results for <span className="text-primary">"{initialQuery}"</span></> : 'Search the knowledge base'}
        </h1>
        {initialTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {initialTags.map((t) => (
              <Badge key={t} variant="outline">#{t}</Badge>
            ))}
          </div>
        )}
        {!loading && !aiLoading && initialQuery && (
          <p className="mt-2 text-sm text-text-muted">
            Search finished — {pageHits.length} page{pageHits.length === 1 ? '' : 's'} and {sourceHits.length} source{sourceHits.length === 1 ? '' : 's'} matched.
          </p>
        )}
      </div>

      {/* AI answer */}
      {initialQuery && (
        <section className="mb-10 rounded-lg border border-border-muted bg-surface-muted/40 p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            AI answer
            {aiLoading && <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-text-muted" />}
          </div>
          {aiLoading && !ai && (
            <p className="text-sm text-text-muted">Reading the KB and drafting an answer…</p>
          )}
          {aiError && (
            <p className="text-sm text-danger">Couldn't generate answer: {aiError}</p>
          )}
          {ai?.answer && (
            <div className="nacora-reading" style={{ maxWidth: '100%' }}>
              <AiMarkdown text={ai.answer} />
            </div>
          )}
          {ai?.citations && ai.citations.length > 0 && (
            <div className="mt-4 border-t border-border-muted pt-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Cited pages</div>
              <ul className="flex flex-wrap gap-2 text-xs">
                {ai.citations.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={c.href}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 hover:border-primary hover:text-primary"
                    >
                      {c.title}
                      <span className="text-text-subtle">· {c.spaceName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Page results */}
      {loading && pageHits.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Searching pages…
        </div>
      )}
      {!loading && initialQuery && pageHits.length === 0 && (
        <p className="text-sm text-text-muted">No pages matched. Try a different phrasing.</p>
      )}
      {pageHits.length > 0 && (
        <ul className="divide-y divide-border-muted">
          {pageHits.map((h) => (
            <li key={h.id} className="py-5">
              <Link href={`/s/${h.spaceSlug}/p/${h.slug}`} className="group block">
                <div className="mb-1 flex items-baseline gap-3">
                  <h2 className="text-lg font-semibold text-primary group-hover:underline">{h.title}</h2>
                  <span className="text-xs uppercase tracking-wide text-text-subtle">/{h.spaceSlug}</span>
                </div>
                {h.snippet && (
                  <p
                    className="text-[15px] leading-relaxed text-text"
                    dangerouslySetInnerHTML={{ __html: sanitizeSnippet(h.snippet, initialQuery) }}
                  />
                )}
                {h.tags && h.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {h.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Source hits */}
      {sourceHits.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Uploaded sources</h2>
          <ul className="divide-y divide-border-muted">
            {sourceHits.map((h) => (
              <li key={h.id} className="py-3">
                <Link href={`/sources#${h.id}`} className="group block">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium group-hover:text-primary group-hover:underline">{h.label}</span>
                    <Badge variant="secondary" className="text-[10px]">{h.type}</Badge>
                  </div>
                  {h.snippet && <p className="mt-1 text-sm text-text-muted">{h.snippet}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// Escape HTML then highlight query terms
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function sanitizeSnippet(raw: string, query: string): string {
  // Postgres ts_headline emits <b>...</b> tags. We want to escape the rest but allow bold.
  // Simplest: escape everything then unescape <b>/</b>.
  const escaped = escapeHtml(raw).replace(/&lt;b&gt;/g, '<mark>').replace(/&lt;\/b&gt;/g, '</mark>');
  // If no <b> tags (fallback path), highlight query terms manually
  if (!/[<]mark[>]/.test(escaped) && query) {
    const terms = query.split(/\s+/).filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (terms.length) {
      const re = new RegExp(`(${terms.join('|')})`, 'ig');
      return escaped.replace(re, '<mark>$1</mark>');
    }
  }
  return escaped;
}

/* Minimal markdown renderer for LLM output — handles paragraphs, bold, italic, inline code,
   links, headings (##/###), bullet lists (flat + one-level-nested), ordered lists, tables. No raw HTML. */
function AiMarkdown({ text }: { text: string }) {
  const nodes = parseMarkdown(text);
  return <>{nodes.map((n, i) => renderNode(n, i))}</>;
}

type ListItem = { text: string; children?: ListItem[] };
type TableRow = string[];

type MdNode =
  | { kind: 'p'; content: string }
  | { kind: 'ul'; items: ListItem[] }
  | { kind: 'ol'; items: ListItem[] }
  | { kind: 'h'; level: 2 | 3 | 4; content: string }
  | { kind: 'table'; header: TableRow; rows: TableRow[] };

function indentOf(line: string): number {
  const m = line.match(/^([\s]*)/);
  return m ? m[1].replace(/\t/g, '    ').length : 0;
}

function parseMarkdown(md: string): MdNode[] {
  const lines = md.split(/\r?\n/);
  const out: MdNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    // Headings — accept any leading whitespace on defensive parse
    const trimmed = line.trim();
    if (trimmed.startsWith('#### ')) { out.push({ kind: 'h', level: 4, content: trimmed.slice(5) }); i++; continue; }
    if (trimmed.startsWith('### ')) { out.push({ kind: 'h', level: 3, content: trimmed.slice(4) }); i++; continue; }
    if (trimmed.startsWith('## ')) { out.push({ kind: 'h', level: 2, content: trimmed.slice(3) }); i++; continue; }
    if (trimmed.startsWith('# ')) { out.push({ kind: 'h', level: 2, content: trimmed.slice(2) }); i++; continue; }

    // Tables — pipe rows with a separator row after the header
    if (/^\|/.test(trimmed) && i + 1 < lines.length && /^\|?\s*[-:]+\s*(\|\s*[-:]+\s*)+\|?/.test(lines[i + 1].trim())) {
      const header = trimmed.split('|').map((c) => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1 || (arr[0] !== '' && arr[arr.length - 1] !== ''));
      // Simpler: split by | and drop empty edge cells
      const parseRow = (l: string): string[] => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const hdr = parseRow(trimmed);
      i += 2; // skip header + separator
      const rows: TableRow[] = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      out.push({ kind: 'table', header: hdr, rows });
      continue;
    }

    // Bullet list — accept `-` `*` `•` markers, allow leading indent for nested items
    if (/^\s*[-*•]\s+/.test(line)) {
      const items = parseList(lines, i, /^\s*[-*•]\s+/);
      out.push({ kind: 'ul', items: items.items });
      i = items.nextIdx;
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = parseList(lines, i, /^\s*\d+\.\s+/);
      out.push({ kind: 'ol', items: items.items });
      i = items.nextIdx;
      continue;
    }

    // Paragraph — accumulate consecutive non-empty non-structural lines
    const buf: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^\s*([-*•]\s|\d+\.\s|#{1,4}\s|\|)/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    out.push({ kind: 'p', content: buf.join(' ') });
  }
  return out;
}

function parseList(lines: string[], start: number, markerRe: RegExp): { items: ListItem[]; nextIdx: number } {
  const items: ListItem[] = [];
  let i = start;
  const baseIndent = indentOf(lines[start]);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const currIndent = indentOf(line);
    if (currIndent < baseIndent) break; // dedented — outer parser resumes
    if (!markerRe.test(line) && currIndent === baseIndent) break; // sibling non-list line at same level
    if (markerRe.test(line) && currIndent === baseIndent) {
      const text = line.replace(markerRe, '');
      const item: ListItem = { text };
      i++;
      // Consume any following lines that continue this item (either indented or nested list)
      const children: ListItem[] = [];
      while (i < lines.length) {
        const next = lines[i];
        if (!next.trim()) { i++; continue; }
        const nextIndent = indentOf(next);
        if (nextIndent > baseIndent && /^\s*[-*•]\s+/.test(next)) {
          const sub = parseList(lines, i, /^\s*[-*•]\s+/);
          children.push(...sub.items);
          i = sub.nextIdx;
          continue;
        }
        if (nextIndent > baseIndent && /^\s*\d+\.\s+/.test(next)) {
          const sub = parseList(lines, i, /^\s*\d+\.\s+/);
          children.push(...sub.items);
          i = sub.nextIdx;
          continue;
        }
        break;
      }
      if (children.length) item.children = children;
      items.push(item);
      continue;
    }
    // Line at same indent but doesn't match marker → list is over
    break;
  }
  return { items, nextIdx: i };
}

function renderNode(n: MdNode, key: number): React.ReactNode {
  if (n.kind === 'h') {
    const Tag = n.level === 2 ? 'h2' : n.level === 3 ? 'h3' : 'h4';
    return <Tag key={key}>{renderInline(n.content)}</Tag>;
  }
  if (n.kind === 'p') return <p key={key}>{renderInline(n.content)}</p>;
  if (n.kind === 'ul') return <ul key={key}>{n.items.map((it, j) => renderListItem(it, j))}</ul>;
  if (n.kind === 'ol') return <ol key={key}>{n.items.map((it, j) => renderListItem(it, j))}</ol>;
  return (
    <div key={key} className="overflow-x-auto">
      <table>
        <thead>
          <tr>{n.header.map((c, j) => <th key={j}>{renderInline(c)}</th>)}</tr>
        </thead>
        <tbody>
          {n.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{renderInline(c)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function renderListItem(it: ListItem, key: number): React.ReactNode {
  return (
    <li key={key}>
      {renderInline(it.text)}
      {it.children?.length ? <ul>{it.children.map((c, j) => renderListItem(c, j))}</ul> : null}
    </li>
  );
}

function renderInline(text: string): React.ReactNode {
  // Order: links → inline code → bold → italic
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/;
  while (remaining.length) {
    const m = remaining.match(linkRe);
    if (!m) { nodes.push(renderEmphasis(remaining, key++)); break; }
    const before = remaining.slice(0, m.index!);
    if (before) nodes.push(renderEmphasis(before, key++));
    const href = m[2];
    const isInternal = href.startsWith('/');
    if (isInternal) {
      nodes.push(<Link key={key++} href={href} className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary">{m[1]}</Link>);
    } else {
      nodes.push(<a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary">{m[1]}<ExternalLink className="h-3 w-3" /></a>);
    }
    remaining = remaining.slice(m.index! + m[0].length);
  }
  return nodes;
}

function renderEmphasis(text: string, keyBase: number): React.ReactNode {
  // Handle **bold**, *italic*, `code`. Emphasis must NOT span whitespace-only content, and
  // italic single-* patterns require the closing * to be adjacent to a non-space char (so
  // stray asterisks like "Scope:*" don't accidentally close an italic further left).
  //   - **X** — bold; X cannot contain another `*`.
  //   - *X*   — italic; X cannot contain `*` or start/end with whitespace.
  //   - `X`   — code; X cannot contain a backtick.
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^\s*][^*\n]*[^\s*]\*|\*[^\s*]\*|`[^`\n]+`)/g);
  return (
    <React.Fragment key={keyBase}>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**') && p.length >= 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith('`') && p.endsWith('`') && p.length >= 2) return <code key={i}>{p.slice(1, -1)}</code>;
        if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </React.Fragment>
  );
}
