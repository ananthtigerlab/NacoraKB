/*
  Rebuild only the pages whose stored content has pipe-delimited paragraphs
  where the current parser would produce proper table blocks. Preserves user edits
  on every other page.

  Run with:  npx tsx scripts/rebuild-broken-tables.ts
*/
import fs from 'node:fs';
import path from 'node:path';
import { getDb, schema } from '../lib/db/client';
import { markdownToBlocks } from '../lib/synthesis/markdown-blocks';
import { eq } from 'drizzle-orm';

type Block = { type: string; content?: any };

function extractText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object') {
    if (typeof node.text === 'string') return node.text;
    if (Array.isArray(node.content)) return node.content.map(extractText).join('');
  }
  return '';
}

function pageHasBrokenTables(blocks: Block[]): boolean {
  if (!Array.isArray(blocks)) return false;
  let pipeLines = 0;
  for (const b of blocks) {
    if (b?.type !== 'paragraph') continue;
    const text = extractText(b.content).trim();
    if (text.startsWith('|') && text.endsWith('|') && text.split('|').length >= 3) {
      pipeLines++;
    }
  }
  return pipeLines >= 2;
}

async function main() {
  const db = await getDb();
  const allSpaces = await db.select().from(schema.spaces);
  const spaceBySlug = new Map(allSpaces.map((s) => [s.slug, s]));

  const rows = await db.select().from(schema.pages);
  const contentRoot = path.join(process.cwd(), 'content');

  let checked = 0;
  let rebuilt = 0;
  const rebuiltPages: string[] = [];

  for (const p of rows) {
    checked++;
    if (!pageHasBrokenTables(p.content as Block[])) continue;

    const space = allSpaces.find((s) => s.id === p.spaceId);
    if (!space) continue;
    const mdPath = path.join(contentRoot, space.slug, `${p.slug}.md`);
    if (!fs.existsSync(mdPath)) {
      console.log(`  skip ${space.slug}/${p.slug} — no markdown source`);
      continue;
    }
    const md = fs.readFileSync(mdPath, 'utf8');
    // Strip the first-line `# Title` — title is stored on the page row already
    const stripped = md.replace(/^#\s+.+\n+/, '');
    const blocks = markdownToBlocks(stripped);
    await db.update(schema.pages).set({ content: blocks, updatedAt: new Date() }).where(eq(schema.pages.id, p.id));
    rebuilt++;
    rebuiltPages.push(`${space.slug}/${p.slug}`);
  }

  console.log(`\nChecked ${checked} pages, rebuilt ${rebuilt}:`);
  for (const s of rebuiltPages) console.log('  ' + s);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
