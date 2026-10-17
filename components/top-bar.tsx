'use client';
import Link from 'next/link';
import { Anchor, Command, Upload } from 'lucide-react';
import { SearchBar } from '@/components/search-bar';
import { Button } from '@/components/ui/button';
import { useCommandPalette } from '@/components/command-palette';
import { UploadDialog } from '@/components/upload-dialog';
import { FontSizeControl } from '@/components/font-size-control';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function TopBar() {
  const palette = useCommandPalette();
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <Link href="/" className="flex items-center gap-2 pr-2">
        <Anchor className="h-5 w-5 text-primary" />
        <span className="font-semibold tracking-tight">Nacora KB</span>
      </Link>
      {/* PRD §5.8: fixed global search bar pinned to the top of every page. */}
      <div className="flex-1 max-w-2xl">
        <SearchBar />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={() => palette.open()} aria-label="Command palette">
              <Command className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Command palette (⌘K)</TooltipContent>
        </Tooltip>
        <FontSizeControl />
        <UploadDialog>
          <Button size="sm" variant="accent">
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        </UploadDialog>
      </div>
    </header>
  );
}
