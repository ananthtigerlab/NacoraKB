'use client';
import * as React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

// PRD §5.9 — Free-form tags, add as many as you want, autocomplete existing.

export function TagInput({
  pageId,
  initialTags,
  allTags,
}: {
  pageId: string;
  initialTags: string[];
  allTags: string[];
}) {
  const [tags, setTags] = React.useState<string[]>(initialTags);
  const [input, setInput] = React.useState('');
  const suggestions = React.useMemo(
    () =>
      input.trim().length === 0
        ? []
        : allTags.filter((t) => t.toLowerCase().includes(input.toLowerCase()) && !tags.includes(t)).slice(0, 6),
    [input, allTags, tags],
  );

  async function commit(next: string[]) {
    setTags(next);
    await fetch(`/api/pages/${pageId}/tags`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: next }),
    });
  }

  function add(name: string) {
    const t = name.trim().toLowerCase();
    if (!t) return;
    if (tags.includes(t)) return;
    commit([...tags, t]);
    setInput('');
  }

  function remove(name: string) {
    commit(tags.filter((t) => t !== name));
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <Badge key={t} variant="secondary" className="gap-1">
          #{t}
          <button
            aria-label={`Remove tag ${t}`}
            className="rounded-full hover:bg-text/10"
            onClick={() => remove(t)}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <div className="relative">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(input);
            }
          }}
          placeholder="Add tag…"
          className="h-7 w-32 text-xs"
        />
        {suggestions.length > 0 && (
          <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-md border border-border bg-surface p-1 shadow-md">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => add(s)}
                className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-surface-muted"
              >
                #{s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
