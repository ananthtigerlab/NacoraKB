'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FileText, History as HistoryIcon } from 'lucide-react';

// PRD §10.1 — Cmd/Ctrl-K jumps to any page, runs a search, or starts an upload from anywhere.

type Page = { id: string; spaceId: string; title: string; slug: string };
type Space = { id: string; slug: string; name: string };

type PaletteContext = {
  open: () => void;
  close: () => void;
};

const CommandCtx = React.createContext<PaletteContext | null>(null);

export function useCommandPalette() {
  const ctx = React.useContext(CommandCtx);
  if (!ctx) throw new Error('useCommandPalette must be inside CommandPaletteProvider');
  return ctx;
}

export function CommandPaletteProvider({
  children,
  spaces,
  pages,
}: {
  children: React.ReactNode;
  spaces: Space[];
  pages: Page[];
}) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const ctx = React.useMemo<PaletteContext>(() => ({ open: () => setOpen(true), close: () => setOpen(false) }), []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <CommandCtx.Provider value={ctx}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl p-0">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <Command className="w-full" label="Command palette">
            <Command.Input
              placeholder="Jump to a page, or type an action…"
              className="w-full border-0 border-b border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-text-muted"
            />
            <Command.List className="max-h-80 overflow-y-auto scrollbar-thin p-1">
              <Command.Empty className="p-3 text-sm text-text-muted">No matches.</Command.Empty>

              <Command.Group heading="Navigate" className="text-[11px] uppercase tracking-wider text-text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2">
                <PaletteItem icon={<HistoryIcon className="h-3.5 w-3.5" />} label="History" onSelect={() => { router.push('/history'); setOpen(false); }} />
              </Command.Group>

              {spaces.map((s) => (
                <Command.Group
                  key={s.id}
                  heading={s.name}
                  className="text-[11px] uppercase tracking-wider text-text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2"
                >
                  {pages
                    .filter((p) => p.spaceId === s.id)
                    .map((p) => (
                      <PaletteItem
                        key={p.id}
                        icon={<FileText className="h-3.5 w-3.5" />}
                        label={p.title}
                        keywords={[s.name, p.title]}
                        onSelect={() => {
                          router.push(`/s/${s.slug}/p/${p.slug}`);
                          setOpen(false);
                        }}
                      />
                    ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </CommandCtx.Provider>
  );
}

function PaletteItem({ icon, label, onSelect, keywords }: { icon: React.ReactNode; label: string; onSelect: () => void; keywords?: string[] }) {
  return (
    <Command.Item
      value={label}
      keywords={keywords}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm aria-selected:bg-surface-muted"
    >
      {icon}
      <span>{label}</span>
    </Command.Item>
  );
}
