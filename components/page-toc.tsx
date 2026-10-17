'use client';
import * as React from 'react';
import { Link2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';

/*
  Right-rail "On this page" table of contents.

  Reads headings from the page's BlockNote content, renders a sticky list of anchor links,
  scrolls the corresponding heading into view on click, and highlights whichever heading is
  currently in the viewport (via IntersectionObserver).

  BlockNote wraps every block in an element with a `data-id` attribute matching the block's id.
  We use that as the anchor target — no need to inject id attributes ourselves.
*/

type Heading = { blockId: string; text: string; level: 1 | 2 | 3 };

// The workspace layout uses `<main className="flex-1 overflow-y-auto">` as the scroll container
// — the window itself doesn't scroll. Walk up from a target to find the nearest ancestor whose
// overflow is scrollable; that's the element we need to move.
function scrollContainerOf(el: HTMLElement | null): HTMLElement | Window {
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    const overflowY = style.overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return window;
}

function scrollBlockIntoView(blockId: string) {
  const target = document.querySelector<HTMLElement>(`[data-id="${blockId}"]`);
  if (!target) return false;
  const container = scrollContainerOf(target);
  const offset = 80; // clear the fixed top bar

  if (container === window) {
    const y = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: 'smooth' });
  } else {
    const el = container as HTMLElement;
    const y = target.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - offset;
    el.scrollTo({ top: y, behavior: 'smooth' });
  }
  // Flash a highlight so the reader sees exactly which block was linked. Restarts if the
  // same block is jumped to again in quick succession.
  target.classList.remove('nacora-anchor-flash');
  // Force a reflow so the animation restarts cleanly the next time the class is added.
  void target.offsetWidth;
  target.classList.add('nacora-anchor-flash');
  setTimeout(() => target.classList.remove('nacora-anchor-flash'), 3200);
  return true;
}

export function PageToc({ content }: { content: any[] }) {
  const headings = React.useMemo(() => extractHeadings(content), [content]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Hash-scroll — runs on every page load regardless of how many headings this page has,
  // since anchor URLs can target any block (list item, paragraph, table, not just headings).
  React.useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#h-')) return;
    const id = hash.slice(3);
    let tries = 0;
    const tick = () => {
      if (scrollBlockIntoView(id)) return;
      if (tries++ < 30) setTimeout(tick, 150);
      else if (tries === 31) {
        // Stale link — the block no longer exists.
        toast({
          title: 'Anchor not found',
          description: `The block "${id.slice(0, 12)}…" no longer exists on this page.`,
          variant: 'destructive',
        });
      }
    };
    tick();
    // Deps intentionally empty: hash-scroll should fire once on mount, not re-run when content changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (headings.length < 2) return;
    const findWrappers = () => {
      const editor = document.querySelector('.bn-editor, .ProseMirror');
      if (!editor) return [] as HTMLElement[];
      const wrappers: HTMLElement[] = [];
      editor.querySelectorAll('[data-id]').forEach((el) => {
        if (el.querySelector('[data-content-type="heading"], h1, h2, h3, h4, h5, h6')) {
          wrappers.push(el as HTMLElement);
        }
      });
      return wrappers;
    };

    let attempts = 0;
    let disconnect: (() => void) | null = null;
    const setup = () => {
      const wrappers = findWrappers();
      if (wrappers.length === 0 && attempts < 20) {
        attempts += 1;
        setTimeout(setup, 100);
        return;
      }
      if (wrappers.length === 0) return;

      // Determine which element to use as the IntersectionObserver root — the scrollable
      // ancestor. If it's the window, pass null.
      const container = scrollContainerOf(wrappers[0]);
      const root = container === window ? null : (container as HTMLElement);

      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (visible[0]) {
            const id = (visible[0].target as HTMLElement).getAttribute('data-id');
            if (id) setActiveId(id);
          }
        },
        { root, rootMargin: '-15% 0px -70% 0px', threshold: [0, 1] },
      );
      wrappers.forEach((el) => observer.observe(el));
      disconnect = () => observer.disconnect();

      // Hash-scroll now handled by its own effect above; runs regardless of headings count.
    };
    setup();
    return () => {
      if (disconnect) disconnect();
    };
  }, [headings]);

  if (headings.length < 2) return null;

  async function copyAnchor(blockId: string) {
    const base = window.location.origin + window.location.pathname;
    const url = `${base}#h-${blockId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(blockId);
      setTimeout(() => setCopiedId((cur) => (cur === blockId ? null : cur)), 1200);
      toast({ title: 'Anchor link copied', description: url, variant: 'success' });
    } catch {
      toast({ title: 'Copy failed', description: 'Your browser blocked clipboard access.', variant: 'destructive' });
    }
  }

  const onClickToc = (blockId: string) => {
    if (!scrollBlockIntoView(blockId)) return;
    history.replaceState(null, '', `#h-${blockId}`);
  };

  return (
    <aside className="hidden shrink-0 xl:block xl:w-56">
      <nav className="sticky top-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          On this page
        </div>
        <ul className="space-y-0.5 text-sm">
          {headings.map((h) => (
            <li
              key={h.blockId}
              style={{ paddingLeft: (h.level - 1) * 12 }}
              className="group leading-snug"
            >
              <div className="flex items-center gap-1">
                <a
                  href={`#h-${h.blockId}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onClickToc(h.blockId);
                  }}
                  className={cn(
                    'block flex-1 truncate rounded px-2 py-0.5 text-text-muted transition-colors hover:text-text',
                    activeId === h.blockId && 'font-medium text-accent',
                  )}
                  title={h.text}
                >
                  {h.text}
                </a>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); copyAnchor(h.blockId); }}
                  className="shrink-0 rounded p-0.5 text-text-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-muted hover:text-primary focus:opacity-100"
                  aria-label={`Copy link to "${h.text}"`}
                  title="Copy link to this heading"
                >
                  {copiedId === h.blockId ? (
                    <Check className="h-3 w-3 text-success" />
                  ) : (
                    <Link2 className="h-3 w-3" />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function extractHeadings(content: any[]): Heading[] {
  const out: Heading[] = [];
  const walk = (blocks: any[]) => {
    for (const b of blocks ?? []) {
      if (b?.type === 'heading') {
        const level = Math.min(3, Math.max(1, Number(b.props?.level ?? 1))) as 1 | 2 | 3;
        const text = extractText(b.content);
        if (text) out.push({ blockId: b.id, text, level });
      }
      if (Array.isArray(b?.children)) walk(b.children);
    }
  };
  walk(content);
  return out;
}

function extractText(content: any): string {
  if (!Array.isArray(content)) return '';
  return content
    .map((c: any) => (typeof c?.text === 'string' ? c.text : ''))
    .join('')
    .trim();
}
