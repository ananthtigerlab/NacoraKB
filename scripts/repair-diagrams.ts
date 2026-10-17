// Find every stored diagram that fails validation and regenerate just those. Cheap sweep after a
// prompt change; run whenever you want to be sure no broken diagrams are lurking on unopened pages.
//
// Prerequisite: `npm run dev` running on http://localhost:3737.
//
// Usage:
//   npx tsx scripts/repair-diagrams.ts
//   npx tsx scripts/repair-diagrams.ts --dry-run   # list broken diagrams, don't regenerate

const BASE = process.env.NACORA_BASE ?? 'http://localhost:3737';

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export {}; // isolate module scope so BASE/flag/validate don't collide with sibling scripts

// Uses the actual @excalidraw/mermaid-to-excalidraw parser (via jsdom) as the source of truth for
// "is this diagram broken" — the same code that runs in the browser.
// @ts-expect-error — no type shipped for jsdom in this project
import { JSDOM } from 'jsdom';

let parserPromise: Promise<(src: string) => Promise<{ ok: true } | { ok: false; reason: string }>> | null = null;

async function getParser() {
  if (parserPromise) return parserPromise;
  parserPromise = (async () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    const g: any = globalThis as any;
    const shim = (k: string, v: unknown) => {
      try { g[k] = v; } catch { Object.defineProperty(g, k, { value: v, configurable: true, writable: true }); }
    };
    shim('window', dom.window);
    shim('document', dom.window.document);
    shim('navigator', dom.window.navigator);
    shim('HTMLElement', dom.window.HTMLElement);
    shim('DocumentFragment', dom.window.DocumentFragment);
    shim('Element', dom.window.Element);
    shim('SVGElement', (dom.window as any).SVGElement);
    shim('DOMPurify', { sanitize: (s: string) => s, addHook: () => {}, removeHook: () => {} });
    class StubStyleSheet { insertRule() { return 0; } deleteRule() {} replaceSync() {} replace() { return Promise.resolve(this); } get cssRules() { return []; } }
    shim('CSSStyleSheet', StubStyleSheet as unknown as typeof CSSStyleSheet);
    const { parseMermaidToExcalidraw } = await import('@excalidraw/mermaid-to-excalidraw');
    return async (src: string) => {
      const s = (src ?? '').trim();
      if (!s) return { ok: false as const, reason: 'empty' };
      // mermaid-to-excalidraw only reliably renders `flowchart LR` without `subgraph`. Every
      // other type (state, ER, class, sequence) throws browser render errors. Force regen.
      const first = (s.split('\n', 1)[0] ?? '').trim();
      if (!/^flowchart\s+LR\b/.test(first)) {
        return { ok: false as const, reason: `only "flowchart LR" is supported — got "${first.slice(0, 60)}"` };
      }
      if (/^\s*subgraph\b/m.test(s)) {
        return { ok: false as const, reason: 'uses subgraph — renderer emits "SubGraph element not found"' };
      }
      try {
        await parseMermaidToExcalidraw(s);
        return { ok: true as const };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/getBBox is not a function|getComputedTextLength|getSubStringLength/i.test(msg)) return { ok: true as const };
        return { ok: false as const, reason: msg.slice(0, 200).replace(/\s+/g, ' ') };
      }
    };
  })();
  return parserPromise;
}

async function validate(src: string) {
  const parser = await getParser();
  return parser(src);
}

async function main() {
  const dryRun = flag('dry-run');

  const res = await fetch(`${BASE}/api/pages`);
  if (!res.ok) {
    console.error(`✗ Can't reach ${BASE}/api/pages — is \`npm run dev\` running?`);
    process.exit(1);
  }
  const { pages } = (await res.json()) as { pages: Array<{ id: string; slug: string; spaceSlug: string; diagram: string | null }> };

  const broken: Array<{ id: string; label: string; reason: string }> = [];
  for (const p of pages) {
    if (!p.diagram || !p.diagram.trim()) continue;
    const v = await validate(p.diagram);
    if (!v.ok) broken.push({ id: p.id, label: `${p.spaceSlug}/${p.slug}`, reason: v.reason });
  }

  if (broken.length === 0) {
    console.log(`\n✓ ${pages.length} pages checked — all diagrams valid.\n`);
    return;
  }
  console.log(`\n${broken.length} broken diagram(s):`);
  for (const b of broken) console.log(`  ${b.label}  — ${b.reason}`);
  if (dryRun) {
    console.log('\ndry-run — nothing regenerated.');
    return;
  }
  console.log('\nRegenerating…\n');

  let ok = 0;
  let stillBad = 0;
  for (let i = 0; i < broken.length; i++) {
    const b = broken[i];
    const label = `${String(i + 1).padStart(3)}/${broken.length}  ${b.label}`;
    const t0 = Date.now();
    try {
      const r = await fetch(`${BASE}/api/pages/${b.id}/diagram`, { method: 'POST' });
      const body = await r.json();
      if (!r.ok) {
        console.log(`${label}  FAILED  ${body.error ?? r.status}`);
        stillBad++;
        continue;
      }
      const v2 = await validate(body.diagram);
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      if (v2.ok) {
        console.log(`${label}  ${dt}s  fixed`);
        ok++;
      } else {
        console.log(`${label}  ${dt}s  STILL BAD — ${v2.reason}`);
        stillBad++;
      }
    } catch (e) {
      console.log(`${label}  FAILED  ${e instanceof Error ? e.message : String(e)}`);
      stillBad++;
    }
  }
  console.log(`\n${ok} fixed, ${stillBad} still broken\n`);
  process.exit(stillBad > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
