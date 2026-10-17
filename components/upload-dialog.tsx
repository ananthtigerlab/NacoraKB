'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';

// PRD §10.1 — zero-friction capture. Drag anywhere, paste screenshots, one action to start ingestion.

const SOURCE_TYPES = ['upload', 'transcript', 'screenshot', 'doc', 'slides', 'figma', 'jira'] as const;

export function UploadDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState('');
  const [type, setType] = React.useState<(typeof SOURCE_TYPES)[number]>('upload');
  const [tags, setTags] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [url, setUrl] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const router = useRouter();

  // Cmd-palette action opens the dialog too.
  React.useEffect(() => {
    const h = () => setOpen(true);
    document.addEventListener('nacora:open-upload', h);
    return () => document.removeEventListener('nacora:open-upload', h);
  }, []);

  // Global drop-anywhere handler (PRD §10.1: drag-and-drop anywhere).
  React.useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      setFile(e.dataTransfer.files[0]);
      setLabel((cur) => cur || e.dataTransfer!.files[0].name);
      setOpen(true);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  // Paste-from-clipboard for screenshots (PRD §10.1).
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) {
            setFile(f);
            setLabel((cur) => cur || `Screenshot ${new Date().toISOString().slice(0, 16)}`);
            setType('screenshot');
            setOpen(true);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  async function submit() {
    if (!file && !url && !notes) {
      toast({ title: 'Nothing to upload', description: 'Attach a file, paste a URL, or add notes.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      fd.append('label', label || file?.name || url || 'Untitled');
      fd.append('type', type);
      if (url) fd.append('url', url);
      if (notes) fd.append('notes', notes);
      if (tags) fd.append('tags', tags);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      toast({
        title: 'Uploaded',
        description: j.proposalCount
          ? `Claude drafted ${j.proposalCount} proposal(s). Review in the Proposals tab.`
          : 'Source added to your library. Phase 1 will draft page updates.',
        variant: 'success',
      });
      setOpen(false);
      setFile(null);
      setLabel('');
      setUrl('');
      setNotes('');
      setTags('');
      router.refresh();
    } catch (err) {
      toast({ title: 'Upload failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a source</DialogTitle>
          <DialogDescription>
            Drop a file, paste a URL, or jot notes. Claude will interpret it, decide which pages it affects, and draft a proposal for your review.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-text-muted">
            <UploadCloud className="mx-auto mb-1 h-6 w-6" />
            {file ? (
              <>
                <div className="font-medium text-text">{file.name}</div>
                <div className="text-xs">{(file.size / 1024).toFixed(1)} KB · {file.type || 'file'}</div>
              </>
            ) : (
              <div>Drop a file anywhere, or paste a screenshot.</div>
            )}
            <input
              id="file-picker"
              type="file"
              className="mt-2 block w-full text-xs"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label htmlFor="src-label">Label</Label>
              <Input id="src-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Meeting notes 12 Jun" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="src-type">Type</Label>
              <select
                id="src-type"
                value={type}
                onChange={(e) => setType(e.target.value as (typeof SOURCE_TYPES)[number])}
                className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="src-url">URL (optional)</Label>
            <Input id="src-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/…" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="src-tags">Tags (optional, comma-separated)</Label>
            <Input id="src-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="policy, rating" />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="src-notes">Notes (optional)</Label>
            <Textarea id="src-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything Claude should know when routing this to pages…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Uploading…' : 'Add source'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
