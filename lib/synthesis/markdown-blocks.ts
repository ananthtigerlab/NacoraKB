import { nanoid } from 'nanoid';

/*
  Convert simple markdown to BlockNote block JSON.

  Handles the subset our BA-style prompt asks the model to produce plus GFM tables:
    - # / ## / ### headings
    - Paragraphs (blank-line-separated)
    - Bullet lists (- or * or +)
    - Numbered lists (1. 2. …)
    - Blockquotes (> …)
    - Pipe tables (with header row + `|---|---|` separator)
    - Inline **bold** and *italic*
    - Inline code (`x`) is stripped — the BA prompt disallows code identifiers in prose

  Anything more exotic (links, images, code fences) is degraded to plain text so nothing crashes
  the editor. If the input is empty, produces a single empty paragraph so BlockNote has a valid
  document root.
*/

export type BlockContent = { type: 'text'; text: string; styles: Record<string, boolean> };

export type TableBlockContent = {
  type: 'tableContent';
  columnWidths: (number | null)[];
  headerRows?: number;
  headerCols?: number;
  rows: { cells: BlockContent[][] }[];
};

type SimpleType = 'paragraph' | 'heading' | 'bulletListItem' | 'numberedListItem' | 'quote';

export type Block =
  | {
      id: string;
      type: SimpleType;
      props: {
        textColor: string;
        backgroundColor: string;
        textAlignment: string;
        level?: 1 | 2 | 3;
      };
      content: BlockContent[];
      children: Block[];
    }
  | {
      id: string;
      type: 'table';
      props: { textColor: string; backgroundColor: string };
      content: TableBlockContent;
      children: Block[];
    };

export function markdownToBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const raw = stripCodeFences(markdown);
  const lines = raw.split('\n');
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    const text = paragraphLines.join(' ').trim();
    if (text) blocks.push(makeBlock('paragraph', text));
    paragraphLines = [];
  };

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trimEnd();

    // Table detection: header row is `| a | b |`, next non-blank row is separator `|---|---|`.
    if (isTableHeaderCandidate(line)) {
      const sep = lines[i + 1] ?? '';
      if (isTableSeparator(sep)) {
        flushParagraph();
        const { block, consumed } = parseTable(lines, i);
        blocks.push(block);
        i += consumed;
        continue;
      }
    }

    // Blank line — paragraph break.
    if (!line.trim()) {
      flushParagraph();
      i++;
      continue;
    }

    // Heading (# ## ###). More #s → level 3.
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      flushParagraph();
      const level = Math.min(3, h[1].length) as 1 | 2 | 3;
      blocks.push(makeHeading(h[2].trim(), level));
      i++;
      continue;
    }

    // Blockquote.
    if (line.startsWith('> ')) {
      flushParagraph();
      blocks.push(makeBlock('quote', line.slice(2).trim()));
      i++;
      continue;
    }
    if (line === '>') {
      flushParagraph();
      i++;
      continue;
    }

    // Bullet list item.
    const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      blocks.push(makeBlock('bulletListItem', bullet[1]));
      i++;
      continue;
    }

    // Numbered list item.
    const numbered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      blocks.push(makeBlock('numberedListItem', numbered[1]));
      i++;
      continue;
    }

    // Horizontal rule — treat as paragraph break.
    if (/^-{3,}$|^\*{3,}$|^_{3,}$/.test(line.trim())) {
      flushParagraph();
      i++;
      continue;
    }

    // Otherwise accumulate into the current paragraph.
    paragraphLines.push(line.trim());
    i++;
  }
  flushParagraph();

  if (blocks.length === 0) {
    blocks.push(makeBlock('paragraph', markdown.trim() || '(empty)'));
  }
  return blocks;
}

function stripCodeFences(md: string): string {
  return md.replace(/```[a-zA-Z0-9]*\n([\s\S]*?)```/g, (_m, inner) => inner);
}

function makeBlock(type: SimpleType, text: string): Block {
  return {
    id: nanoid(),
    type: type as any,
    props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
    content: parseInline(text),
    children: [],
  } as Block;
}

function makeHeading(text: string, level: 1 | 2 | 3): Block {
  return {
    id: nanoid(),
    type: 'heading',
    props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left', level },
    content: parseInline(text),
    children: [],
  };
}

// --- Table parsing ----------------------------------------------------------

function isTableHeaderCandidate(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.endsWith('|') && t.length > 2 && t.includes('|', 1);
}

function isTableSeparator(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith('|') || !t.endsWith('|')) return false;
  // Each cell must be dashes with optional colons and whitespace, e.g. `|---|:---:|---:|`.
  const cells = splitPipeRow(t);
  if (cells.length === 0) return false;
  return cells.every((c) => /^\s*:?-{3,}:?\s*$/.test(c));
}

function splitPipeRow(line: string): string[] {
  // Trim leading/trailing pipe, then split by unescaped pipes.
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|\s*$/, '');
  return trimmed.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim());
}

function parseTable(lines: string[], startIdx: number): { block: Block; consumed: number } {
  const headerCells = splitPipeRow(lines[startIdx]);
  const rows: string[][] = [headerCells];
  let i = startIdx + 2; // skip header + separator
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || !line.endsWith('|')) break;
    rows.push(splitPipeRow(line));
    i++;
  }
  const columnCount = Math.max(...rows.map((r) => r.length));
  const normalisedRows = rows.map((r) => {
    const padded = [...r];
    while (padded.length < columnCount) padded.push('');
    return { cells: padded.map((text) => parseInline(text)) };
  });
  const block: Block = {
    id: nanoid(),
    type: 'table',
    props: { textColor: 'default', backgroundColor: 'default' },
    content: {
      type: 'tableContent',
      columnWidths: Array(columnCount).fill(null),
      headerRows: 1,
      rows: normalisedRows,
    },
    children: [],
  };
  return { block, consumed: i - startIdx };
}

// --- Inline parser ---------------------------------------------------------

// Very small inline parser: **bold**, *italic* / _italic_. Inline code is stripped (BA prompt bans it).
function parseInline(text: string): BlockContent[] {
  const cleaned = text.replace(/`([^`]*)`/g, '$1');
  const out: BlockContent[] = [];
  const re = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned)) !== null) {
    if (match.index > last) {
      out.push({ type: 'text', text: cleaned.slice(last, match.index), styles: {} });
    }
    const token = match[0];
    if (token.startsWith('**')) {
      out.push({ type: 'text', text: token.slice(2, -2), styles: { bold: true } });
    } else if (token.startsWith('*') || token.startsWith('_')) {
      out.push({ type: 'text', text: token.slice(1, -1), styles: { italic: true } });
    }
    last = match.index + token.length;
  }
  if (last < cleaned.length) {
    out.push({ type: 'text', text: cleaned.slice(last), styles: {} });
  }
  if (out.length === 0) return [{ type: 'text', text: cleaned, styles: {} }];
  return out;
}

// -- Response parsing --------------------------------------------------------
// The synthesis prompts ask the model to output:
//
//   ---RATIONALE---
//   <one or two sentences>
//   ---CONTENT---
//   <markdown body>
//
// This helper is forgiving — if the markers aren't present, treat the whole response as content
// and leave rationale blank.

export function parseSynthesisResponse(text: string): { rationale: string; markdown: string } {
  const rationaleMarker = '---RATIONALE---';
  const contentMarker = '---CONTENT---';
  const contentIdx = text.indexOf(contentMarker);
  if (contentIdx < 0) {
    return { rationale: '', markdown: text.trim() };
  }
  const rationaleIdx = text.indexOf(rationaleMarker);
  const rationale = rationaleIdx >= 0
    ? text.slice(rationaleIdx + rationaleMarker.length, contentIdx).trim()
    : '';
  const markdown = text.slice(contentIdx + contentMarker.length).trim();
  return { rationale, markdown };
}
