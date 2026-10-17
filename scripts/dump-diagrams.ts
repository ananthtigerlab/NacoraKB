// Attempt to read all diagrams straight out of PGlite without running migration first.
// If PGlite can boot but migration is what crashes, this pulls the diagrams into a JSON file.
//
// Output: data/diagrams-backup.json
export {};

import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const OUT = path.join(process.cwd(), 'data', 'diagrams-backup.json');

async function main() {
  const dbPath = path.join(process.cwd(), 'data', 'db');
  console.log(`opening PGlite at ${dbPath} (no migration)`);
  const pg = new PGlite(dbPath);
  try {
    // Skip DDL entirely — just try to SELECT what's already in the tables.
    const r = await pg.query<{
      id: string;
      title: string;
      slug: string;
      space_slug: string;
      diagram: string | null;
      diagram_scene: unknown;
    }>(`
      SELECT p.id, p.title, p.slug, sp.slug AS space_slug, p.diagram, p.diagram_scene
      FROM page p
      JOIN space sp ON sp.id = p.space_id
      ORDER BY sp.slug, p.slug;
    `);
    const rows = r.rows;
    const withDiagram = rows.filter((x) => (x.diagram && x.diagram.trim()) || x.diagram_scene);
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(withDiagram, null, 2));
    console.log(`\n✓ dumped ${withDiagram.length}/${rows.length} pages with diagrams → ${OUT}\n`);
  } finally {
    await pg.close();
  }
}

main().catch((e) => {
  console.error('✗ dump failed:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
