// Run the actual @excalidraw/mermaid-to-excalidraw parser against every stored diagram to see
// which ones REALLY fail (browser-accurate), not just what our cheap validator catches.
//
// Prerequisite: `npm run dev` running on http://localhost:3737.
//
// Usage: npx tsx scripts/audit-diagrams.ts
export {};

// @ts-expect-error — no type shipped for jsdom in this project
import { JSDOM } from 'jsdom';

const BASE = process.env.NACORA_BASE ?? 'http://localhost:3737';

async function main() {
  // Shim the DOM globals that mermaid + excalidraw look at on import.
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  const g: any = globalThis as any;
  const shim = (k: string, v: unknown) => {
    try { g[k] = v; } catch { Object.defineProperty(g, k, { value: v, configurable: true, writable: true }); }
  };
  shim('window', dom.window);
  shim('document', dom.window.document);
  shim('navigator', dom.window.navigator);
  shim('HTMLElement', dom.window.HTMLElement);
  shim('DOMPurify', { sanitize: (s: string) => s, addHook: () => {}, removeHook: () => {} });
  // mermaid touches CSSStyleSheet on import — jsdom doesn't ship one. A stub is enough for the
  // parseMermaidToExcalidraw code path (it never actually creates real stylesheets).
  class StubStyleSheet { insertRule() { return 0; } deleteRule() {} replaceSync() {} replace() { return Promise.resolve(this); } get cssRules() { return []; } }
  shim('CSSStyleSheet', StubStyleSheet as unknown as typeof CSSStyleSheet);
  shim('DocumentFragment', dom.window.DocumentFragment);
  shim('Element', dom.window.Element);
  shim('SVGElement', (dom.window as any).SVGElement);

  const { parseMermaidToExcalidraw } = await import('@excalidraw/mermaid-to-excalidraw');

  const res = await fetch(`${BASE}/api/pages`);
  if (!res.ok) {
    console.error(`✗ Can't reach ${BASE}/api/pages`);
    process.exit(1);
  }
  const { pages } = (await res.json()) as { pages: Array<{ id: string; slug: string; spaceSlug: string; diagram: string | null }> };

  const broken: Array<{ label: string; type: string; error: string }> = [];
  let checked = 0;
  let ok = 0;
  for (const p of pages) {
    if (!p.diagram || !p.diagram.trim()) continue;
    checked++;
    const type = (p.diagram.trim().split('\n', 1)[0] || '').trim().slice(0, 40);

    // Structural checks first — the mermaid-to-excalidraw library only reliably renders
    // `flowchart LR` without `subgraph`. Every other diagram type throws browser render errors.
    if (!/^flowchart\s+LR/.test(type)) {
      broken.push({ label: `${p.spaceSlug}/${p.slug}`, type, error: `only "flowchart LR" is supported (got "${type}") — regenerate` });
      continue;
    }
    if (/^\s*subgraph\b/m.test(p.diagram)) {
      broken.push({ label: `${p.spaceSlug}/${p.slug}`, type, error: 'uses subgraph — renderer emits "SubGraph element not found"' });
      continue;
    }

    try {
      await parseMermaidToExcalidraw(p.diagram.trim());
      ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/getBBox is not a function|is not a function.*getBBox|getComputedTextLength|getSubStringLength/i.test(msg)) {
        ok++;
        continue;
      }
      broken.push({ label: `${p.spaceSlug}/${p.slug}`, type, error: msg.slice(0, 220).replace(/\s+/g, ' ') });
    }
  }

  console.log(`\n${checked} diagrams checked · ${ok} ok · ${broken.length} broken\n`);
  if (broken.length) {
    console.log('Broken diagrams:');
    for (const b of broken) console.log(`  ${b.label.padEnd(55)}  [${b.type}]  ${b.error}`);
  }
  process.exit(broken.length > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
