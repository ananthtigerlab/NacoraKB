// Generate Mermaid diagrams for every page in the KB by hitting the running dev server.
// PGlite is single-writer, so we can't open the DB directly while `npm run dev` is running —
// this script talks to the app's HTTP endpoints instead.
//
// Prerequisite: `npm run dev` running on http://localhost:3737 with an LLM API key in .env.
//
// Usage:
//   npx tsx scripts/generate-diagrams.ts             # only pages missing a diagram
//   npx tsx scripts/generate-diagrams.ts --force     # regenerate every page
//   npx tsx scripts/generate-diagrams.ts --space=product   # limit to a space
//   npx tsx scripts/generate-diagrams.ts --slug=rating     # single page
//   npx tsx scripts/generate-diagrams.ts --concurrency=3   # parallel workers (default 2)

export {}; // isolate module scope so BASE/arg/flag don't collide with sibling scripts

const BASE = process.env.NACORA_BASE ?? 'http://localhost:3737';

function arg(name: string): string | undefined {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p ? p.slice(name.length + 3) : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

type Page = { id: string; title: string; slug: string; spaceSlug: string; hasDiagram: boolean };

async function fetchAllPages(): Promise<Page[]> {
  const res = await fetch(`${BASE}/api/pages`);
  if (!res.ok) throw new Error(`GET /api/pages -> ${res.status}: ${await res.text()}`);
  const data = await res.json();
  // Support either { pages: [...] } or a raw array
  const raw: any[] = Array.isArray(data) ? data : data.pages ?? [];
  return raw.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    spaceSlug: p.spaceSlug ?? p.space_slug ?? p.space?.slug ?? '',
    hasDiagram: Boolean(p.diagram && String(p.diagram).trim()),
  }));
}

async function generateOne(pageId: string): Promise<{ diagram: string } | { error: string }> {
  const res = await fetch(`${BASE}/api/pages/${pageId}/diagram`, { method: 'POST' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: body.error ?? `HTTP ${res.status}` };
  return { diagram: body.diagram };
}

async function main() {
  const force = flag('force');
  const spaceFilter = arg('space');
  const slugFilter = arg('slug');
  const concurrency = Math.max(1, Math.min(6, Number(arg('concurrency') ?? '2')));

  let pages: Page[];
  try {
    pages = await fetchAllPages();
  } catch (e) {
    console.error(`✗ Can't reach ${BASE} — is \`npm run dev\` running?`);
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  if (spaceFilter) pages = pages.filter((p) => p.spaceSlug === spaceFilter);
  if (slugFilter) pages = pages.filter((p) => p.slug === slugFilter);
  if (!force) pages = pages.filter((p) => !p.hasDiagram);

  console.log(`\n${pages.length} page(s) to process (concurrency=${concurrency})\n`);
  if (pages.length === 0) {
    console.log('Nothing to do. Use --force to regenerate everything.');
    return;
  }

  let done = 0;
  let ok = 0;
  let failed = 0;
  const failures: Array<{ page: string; error: string }> = [];
  const t0 = Date.now();

  async function worker(id: number) {
    while (true) {
      const idx = done++;
      if (idx >= pages.length) return;
      const p = pages[idx];
      const start = Date.now();
      const label = `${String(idx + 1).padStart(3, ' ')}/${pages.length}  ${p.spaceSlug}/${p.slug}`;
      const result = await generateOne(p.id);
      const ms = Date.now() - start;
      if ('error' in result) {
        console.log(`${label}  FAILED  ${(ms / 1000).toFixed(1)}s  ${result.error.slice(0, 180)}`);
        failed++;
        failures.push({ page: `${p.spaceSlug}/${p.slug}`, error: result.error });
      } else {
        const firstLine = result.diagram.split('\n')[0]?.slice(0, 40) ?? '';
        console.log(`${label}  ${(ms / 1000).toFixed(1)}s  ${firstLine}`);
        ok++;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));

  const totalSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${ok} ok · ${failed} failed · ${totalSec}s total\n`);
  if (failures.length) {
    console.log('Failures:');
    for (const f of failures) console.log(`  ${f.page} — ${f.error.slice(0, 200)}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
