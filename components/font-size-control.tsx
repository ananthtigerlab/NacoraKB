'use client';
import * as React from 'react';
import { Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const STORAGE_KEY = 'nacora.reading.fontScale';
const DEFAULT_SCALE = 1;
const MIN = 0.5;
const MAX = 5;
const STEP = 0.1;

export function applyScale(scale: number) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--reading-scale', String(scale));
}

export function FontSizeControl() {
  const [scale, setScale] = React.useState<number>(DEFAULT_SCALE);

  React.useEffect(() => {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    const initial = stored && !Number.isNaN(stored) ? stored : DEFAULT_SCALE;
    setScale(initial);
    applyScale(initial);
  }, []);

  function change(delta: number) {
    setScale((prev) => {
      const next = Math.min(MAX, Math.max(MIN, Number((prev + delta).toFixed(2))));
      localStorage.setItem(STORAGE_KEY, String(next));
      applyScale(next);
      return next;
    });
  }

  return (
    <div className="flex items-center overflow-hidden rounded-md border border-border bg-surface">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => change(-STEP)}
            className="flex h-8 w-8 items-center justify-center text-text-muted hover:bg-surface-muted hover:text-text"
            aria-label="Decrease font size"
          >
            <Type className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Decrease font size</TooltipContent>
      </Tooltip>
      <span className="w-9 text-center text-[11px] tabular-nums text-text-muted">
        {Math.round(scale * 100)}%
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => change(STEP)}
            className="flex h-8 w-8 items-center justify-center text-text-muted hover:bg-surface-muted hover:text-text"
            aria-label="Increase font size"
          >
            <Type className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Increase font size</TooltipContent>
      </Tooltip>
    </div>
  );
}
