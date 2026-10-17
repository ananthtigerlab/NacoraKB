'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, ChevronsLeft, ChevronsRight, FileText, History as HistoryIcon, FolderTree, MessageSquareWarning, Inbox, GitBranch, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type Page = { id: string; spaceId: string; parentPageId: string | null; title: string; slug: string; isSystem: boolean };
type Space = { id: string; slug: string; name: string; description: string | null; ordering: number };
type SpaceWithPages = Space & { pages: Page[] };

const STORAGE_KEY = 'nacora.sidebar.collapsed';

export function Sidebar({ data }: { data: SpaceWithPages[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setCollapsed(stored === '1');
    setHydrated(true);
  }, []);

  function toggle() {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      return next;
    });
  }

  // Avoid a flash-of-wrong-width during SSR/hydration; render expanded until we've read localStorage.
  const isCollapsed = hydrated && collapsed;

  if (isCollapsed) {
    return (
      <aside className="relative flex h-full w-10 shrink-0 flex-col items-center border-r border-border bg-surface-muted/40 py-3">
        <button
          onClick={toggle}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="relative flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface-muted/40">
      <div className="flex items-center justify-end px-2 pt-2">
        <button
          onClick={toggle}
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted hover:text-text"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 pt-1 pb-6">
          {data.map((space) => (
            <SpaceBlock key={space.id} space={space} pathname={pathname} />
          ))}
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">System</div>
            <SystemLink href="/history" label="History" icon={<HistoryIcon className="h-3.5 w-3.5" />} pathname={pathname} />
            <SystemLink href="/sources" label="Source Library" icon={<FolderTree className="h-3.5 w-3.5" />} pathname={pathname} />
            <SystemLink href="/proposals" label="Proposals" icon={<Inbox className="h-3.5 w-3.5" />} pathname={pathname} />
            <SystemLink href="/conflicts" label="Conflicts" icon={<MessageSquareWarning className="h-3.5 w-3.5" />} pathname={pathname} />
            <SystemLink href="/sync" label="Code Sync" icon={<GitBranch className="h-3.5 w-3.5" />} pathname={pathname} />
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}

function SpaceBlock({ space, pathname }: { space: SpaceWithPages; pathname: string }) {
  const [open, setOpen] = React.useState(true);
  const roots = space.pages.filter((p) => !p.parentPageId);
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-left text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text"
      >
        <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
        {space.name}
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5">
          {roots.map((p) => (
            <PageNode key={p.id} page={p} space={space} allPages={space.pages} depth={0} pathname={pathname} />
          ))}
          {roots.length === 0 && (
            <li className="px-2 py-1 text-xs italic text-text-muted">No pages yet.</li>
          )}
        </ul>
      )}
    </div>
  );
}

function PageNode({
  page,
  space,
  allPages,
  depth,
  pathname,
}: {
  page: Page;
  space: SpaceWithPages;
  allPages: Page[];
  depth: number;
  pathname: string;
}) {
  const children = allPages.filter((p) => p.parentPageId === page.id);
  const href = `/s/${space.slug}/p/${page.slug}`;
  const active = pathname === href;
  const [open, setOpen] = React.useState(depth < 1);
  return (
    <li>
      <div className="flex items-center gap-0.5" style={{ paddingLeft: depth * 12 }}>
        {children.length > 0 ? (
          <button onClick={() => setOpen((v) => !v)} className="rounded p-0.5 hover:bg-surface-muted" aria-label="Toggle">
            <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Link
          href={href}
          className={cn(
            'flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-surface-muted',
            active && 'bg-accent/10 font-medium text-text',
          )}
        >
          <FileText className="h-3.5 w-3.5 text-text-muted" />
          <span className="truncate">{page.title}</span>
        </Link>
      </div>
      {open && children.length > 0 && (
        <ul className="mt-0.5">
          {children.map((c) => (
            <PageNode key={c.id} page={c} space={space} allPages={allPages} depth={depth + 1} pathname={pathname} />
          ))}
        </ul>
      )}
    </li>
  );
}

function SystemLink({
  href,
  label,
  icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  pathname: string;
}) {
  const active = pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1 text-sm text-text-muted hover:bg-surface-muted hover:text-text',
        active && 'bg-accent/10 text-text',
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
