'use client';
import dynamic from 'next/dynamic';
import type { EditorProps } from '@/components/editor';

// BlockNote and its deps (Yjs, ProseMirror) touch `document`/`window` on import.
// Load it purely client-side to avoid SSR "element type is invalid" errors.
export const Editor = dynamic<EditorProps>(
  () => import('@/components/editor').then((m) => m.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[200px] animate-pulse rounded-md border border-dashed border-border p-4 text-sm text-text-muted">
        Loading editor…
      </div>
    ),
  },
);
