// Restore any page whose title is empty or literally "delete" back to the H1 from the source
// markdown at content/<space>/<slug>.md. Idempotent — pages with correct titles are left alone.
export {};

import { createRequire } from 'node:module';
{
  const require = createRequire(import.meta.url);
  try {
    const soPath = require.resolve('server-only');
    require.cache[soPath] = { id: soPath, filename: soPath, loaded: true, exports: {}, children: [], paths: [], require: null as any } as any;
  } catch { /* ok */ }
}

import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { getDb, getPg, schema } from '../lib/db/client';

function titleFromMarkdown(md: string): string | null {
  const m = md.match(/^\s*#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

async function main() {
  getPg(); // ensure singleton wired
  const db = getDb();
  const spaces = await db.select().from(schema.spaces);
  const spaceById = new Map(spaces.map((s) => [s.id, s.slug]));

  const rows = await db.select().from(schema.pages);
  const suspicious = rows.filter((r) => !r.title || /^delete$/i.test((r.title ?? '').trim()));
  console.log(`\n${suspicious.length} pages need title restoration:\n`);

  let fixed = 0;
  let notFound = 0;
  for (const p of suspicious) {
    const spaceSlug = spaceById.get(p.spaceId);
    if (!spaceSlug) continue;
    const mdPath = path.join(process.cwd(), 'content', spaceSlug, `${p.slug}.md`);
    if (!fs.existsSync(mdPath)) {
      console.log(`  ${spaceSlug}/${p.slug}  ×  no source at ${mdPath}`);
      notFound++;
      continue;
    }
    const md = fs.readFileSync(mdPath, 'utf8');
    const title = titleFromMarkdown(md);
    if (!title) {
      console.log(`  ${spaceSlug}/${p.slug}  ×  markdown has no H1`);
      notFound++;
      continue;
    }
    await db.update(schema.pages).set({ title, updatedAt: new Date() }).where(eq(schema.pages.id, p.id));
    console.log(`  ${spaceSlug}/${p.slug}  ✓  ${JSON.stringify(title)}`);
    fixed++;
  }
  console.log(`\n${fixed} restored, ${notFound} unresolved\n`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
