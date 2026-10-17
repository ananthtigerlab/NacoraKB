'use client';
import * as React from 'react';
import {
  useCreateBlockNote,
  FormattingToolbar,
  FormattingToolbarController,
  getFormattingToolbarItems,
  useBlockNoteEditor,
  useComponentsContext,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/style.css';
import '@blocknote/mantine/style.css';
import type { Block } from '@blocknote/core';
import { toast } from '@/components/ui/toast';

// Wrapper around BlockNote — pages are stored as block JSON in `page.content`.
// PRD §5.1: block-based editor (headings, rich text, tables, lists, callouts, code, embeds).
// PRD §10.1: no view/edit toggle, autosave, optimistic UI.

export type EditorProps = {
  pageId: string;
  initialContent: Block[] | undefined;
  onSaved?: () => void;
  readOnly?: boolean;
};

async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/blocks/image', { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

/**
 * "Copy anchor link" button rendered inside BlockNote's selection toolbar.
 * Works on any block type: heading, list item, paragraph, table row. Uses the same
 * `#h-<blockId>` URL scheme as PageToc so pasted links auto-scroll on load.
 */
function CopyAnchorButton() {
  const editor = useBlockNoteEditor();
  const Components = useComponentsContext();
  if (!Components) return null;
  return (
    <Components.FormattingToolbar.Button
      label="Copy link to this block"
      mainTooltip="Copy link to this block"
      onClick={async () => {
        const pos = editor.getTextCursorPosition();
        const blockId = pos?.block?.id;
        if (!blockId) return;
        const url = `${window.location.origin}${window.location.pathname}#h-${blockId}`;
        try {
          await navigator.clipboard.writeText(url);
          // Flash the block that was just linked so the user sees which one they copied.
          const el = document.querySelector<HTMLElement>(`[data-id="${blockId}"]`);
          if (el) {
            el.classList.remove('nacora-anchor-flash');
            void el.offsetWidth;
            el.classList.add('nacora-anchor-flash');
            setTimeout(() => el.classList.remove('nacora-anchor-flash'), 3200);
          }
          toast({ title: 'Anchor link copied', description: url, variant: 'success' });
        } catch {
          toast({ title: 'Copy failed', description: 'Your browser blocked clipboard access.', variant: 'destructive' });
        }
      }}
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden>
          <path d="M9 17H7A5 5 0 0 1 7 7h2" />
          <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      }
    />
  );
}

export function Editor({ pageId, initialContent, onSaved, readOnly }: EditorProps) {
  const editor = useCreateBlockNote({
    initialContent: initialContent && initialContent.length ? initialContent : undefined,
    uploadFile,
    tables: {
      splitCells: true,
      cellBackgroundColor: true,
      cellTextColor: true,
      headers: true,
    },
  });
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = React.useState<'idle' | 'pending' | 'saved'>('idle');

  const persist = React.useCallback(
    async (content: Block[]) => {
      setSaving('pending');
      try {
        const res = await fetch(`/api/pages/${pageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) throw new Error(await res.text());
        setSaving('saved');
        onSaved?.();
      } catch {
        setSaving('idle');
      }
    },
    [pageId, onSaved],
  );

  const handleChange = React.useCallback(() => {
    if (readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persist(editor.document as Block[]);
    }, 700);
  }, [editor, persist, readOnly]);

  return (
    <div className="relative">
      <BlockNoteView
        editor={editor}
        editable={!readOnly}
        onChange={handleChange}
        theme="light"
        formattingToolbar={false}
      >
        {/* Rebuild the default toolbar and append our "Copy anchor link" button at the end. */}
        <FormattingToolbarController
          formattingToolbar={() => (
            <FormattingToolbar>
              {getFormattingToolbarItems()}
              <CopyAnchorButton key="copy-anchor" />
            </FormattingToolbar>
          )}
        />
      </BlockNoteView>
      {saving !== 'idle' && (
        <span className="fixed bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-surface px-2.5 py-0.5 text-[11px] text-text-muted shadow-sm">
          {saving === 'pending' ? 'Saving…' : 'Saved'}
        </span>
      )}
    </div>
  );
}
