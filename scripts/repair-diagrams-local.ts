// Fix broken Mermaid diagrams WITHOUT calling the LLM. Applies a stack of context-aware
// text transformations for the classes we've seen (parens/slashes/semicolons/truncation/
// ampersands/state-desc colons), verifies each attempt with the real @excalidraw/mermaid-to-excalidraw
// parser, and saves the first version that parses.
//
// Prerequisite: `npm run dev` running on http://localhost:3737.
// Usage: npx tsx scripts/repair-diagrams-local.ts        # fix in place
//        npx tsx scripts/repair-diagrams-local.ts --dry  # show what would change
export {};

// @ts-expect-error — no type shipped for jsdom in this project
import { JSDOM } from 'jsdom';

const BASE = process.env.NACORA_BASE ?? 'http://localhost:3737';

// ---------------- Rule set — every rule is idempotent and context-aware -------------------

function dropIncompleteTrailingLines(src: string): string {
  const lines = src.split('\n');
  while (lines.length > 1) {
    const last = lines[lines.length - 1].trim();
    if (
      !last ||
      /-->\s*$/.test(last) ||
      /--\s*$/.test(last) ||
      /\[\s*$/.test(last) ||                    // "I[Broker/" or "I["
      /\|\|--o?\{?\s*$/.test(last) ||           // ER "Role ||--o{"
      /:\s*$/.test(last) ||                     // dangling label separator
      /-->\s+[A-Za-z0-9]+\s*$/.test(last)       // "--> C" with no shape/content following
    ) {
      lines.pop();
      continue;
    }
    // Unclosed [ or ( or { on the last line
    const openSq = (last.match(/\[/g) || []).length;
    const closeSq = (last.match(/\]/g) || []).length;
    const openPa = (last.match(/\(/g) || []).length;
    const closePa = (last.match(/\)/g) || []).length;
    if (openSq > closeSq || openPa > closePa) { lines.pop(); continue; }
    break;
  }
  return lines.join('\n');
}

// Split "A; B" statement joiners onto their own lines so the parser sees separate statements
function splitOnSemicolons(src: string): string {
  const firstLine = src.split('\n', 1)[0];
  // Don't touch sequenceDiagram (semicolons are meaningful there) or classDiagram
  if (/^sequenceDiagram|^classDiagram/.test(firstLine.trim())) return src;
  const lines = src.split('\n').map((line) => {
    // Preserve semicolons inside "quoted" text
    const parts: string[] = [];
    let buf = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') inQuote = !inQuote;
      if (ch === ';' && !inQuote) {
        parts.push(buf);
        buf = '';
        continue;
      }
      buf += ch;
    }
    parts.push(buf);
    return parts.map((p) => p.trim()).filter(Boolean).join('\n    ');
  });
  return lines.join('\n');
}

// Rewrite parens INSIDE labels — [Render HTML (Jinja2)] → [Render HTML - Jinja2]
// Also in subgraph titles: subgraph Foo (Bar) → subgraph "Foo - Bar"
function stripParensInLabels(src: string): string {
  let out = src;
  // Labels wrapped in [] — keep only the label content, replace (x) with " - x" or " with x"
  out = out.replace(/\[([^\]\n]+)\]/g, (_m, inner: string) => {
    return `[${collapseParens(inner)}]`;
  });
  // Round-bracket-shaped node labels: (Label (Detail))
  out = out.replace(/\((?!\s*[)\s])([^()\n]+?)\s+\(([^()\n]+)\)\s*\)/g, (_m, a: string, b: string) => `(${a.trim()} - ${b.trim()})`);
  // Curly decision labels: {Are You Sure? (Yes/No)}
  out = out.replace(/\{"?([^{}\n"]+?)"?\}/g, (m, inner: string) => {
    const fixed = collapseParens(inner);
    return m.startsWith('{"') ? `{"${fixed}"}` : `{${fixed}}`;
  });
  // subgraph titles: subgraph Foo (Bar) → subgraph "Foo — Bar"
  out = out.replace(/^(\s*subgraph\s+)([^\n]+)$/gm, (_m, prefix: string, rest: string) => {
    if (rest.includes('(') && rest.includes(')')) {
      const cleaned = collapseParens(rest).replace(/"/g, '');
      return `${prefix}"${cleaned}"`;
    }
    return `${prefix}${rest}`;
  });
  return out;
}

function collapseParens(s: string): string {
  // "Foo (Bar)" → "Foo - Bar", "Foo (with X and Y)" → "Foo with X and Y", "Foo (a, b)" → "Foo - a, b"
  return s
    .replace(/\s*\(\s*([^()]+?)\s*\)/g, (_m, inner: string) => {
      const trimmed = inner.trim();
      // "with ...", "using ...", "via ..." reads better without the dash
      if (/^(with|using|via|for|on|by)\s/i.test(trimmed)) return ` ${trimmed}`;
      return ` - ${trimmed}`;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

// Replace forward slashes inside label text with context-appropriate words
function fixSlashesInLabels(src: string): string {
  const replaceInLabel = (label: string): string => {
    // "Yes/No" — very common decision label
    if (/^(yes\/no|true\/false|on\/off|open\/closed)$/i.test(label.trim())) {
      return label.replace('/', ' or ');
    }
    // "Broker/Underwriter/Admin" — enumerate roles
    if (label.split('/').length >= 3) {
      const parts = label.split('/').map((p) => p.trim()).filter(Boolean);
      return parts.slice(0, -1).join(', ') + ' and ' + parts.slice(-1);
    }
    // "Broker/Underwriter" — two-item pair → "Broker and Underwriter"
    if ((label.match(/\//g) || []).length === 1) {
      return label.replace(/\s*\/\s*/, ' and ');
    }
    return label;
  };
  let out = src;
  out = out.replace(/\[([^\]\n]+)\]/g, (_m, inner: string) => `[${replaceInLabel(inner)}]`);
  out = out.replace(/\{"?([^{}\n"]+?)"?\}/g, (m, inner: string) => {
    const fixed = replaceInLabel(inner);
    return m.startsWith('{"') ? `{"${fixed}"}` : `{${fixed}}`;
  });
  // Edge labels: `-- Yes/No -->`
  out = out.replace(/--\s+([^-][^\n]*?)\s+-->/g, (_m, mid: string) => `-- ${replaceInLabel(mid)} -->`);
  return out;
}

// Fix common single-line state-diagram descriptions: `State: description trailing.` → keep as-is
// but move `description trailing.` onto its own line via `State : description` syntax
function fixStateColonOnSameLine(src: string): string {
  if (!/^stateDiagram-v2/m.test(src)) return src;
  return src.replace(/^(\s*)([A-Za-z0-9_]+)\s*:\s*([^\n]+)$/gm, (_m, indent: string, state: string, desc: string) => {
    // Strip trailing punctuation and stray parens
    const cleaned = desc.replace(/\s*\(.*?\)\s*/g, ' ').replace(/[.;]+$/, '').trim();
    return `${indent}${state} : ${cleaned}`;
  });
}

// Fix flowchart edges that use "&" to combine sources — Mermaid needs `A & B --> C` all on one line
// The LLM often garbles this into malformed forms. Simplest: rewrite `X & Y ...` into two edges.
function unfoldAmpersandEdges(src: string): string {
  if (!/^(flowchart|graph)\b/m.test(src.split('\n', 1)[0])) return src;
  return src.split('\n').map((line) => {
    const m = line.match(/^(\s*)([A-Za-z0-9_]+(?:\s*&\s*[A-Za-z0-9_]+)+)\s*(-->|-\.->|---|-.-)(.*)$/);
    if (!m) return line;
    const [, indent, sources, arrow, rest] = m;
    const nodes = sources.split(/\s*&\s*/);
    return nodes.map((n) => `${indent}${n} ${arrow}${rest}`).join('\n');
  }).join('\n');
}

// Strip commas inside "quoted" attribute names in ER diagrams
function stripCommasInErAttributes(src: string): string {
  if (!/^erDiagram\b/m.test(src.split('\n', 1)[0])) return src;
  return src.replace(/"([^"\n]*),([^"\n]*)"/g, (_m, a: string, b: string) => `"${a.trim()} ${b.trim()}"`);
}

// Master list — order matters: drop truncation first, then structural fixes, then label fixes.
const RULES: Array<{ name: string; fn: (s: string) => string }> = [
  { name: 'drop-truncated-lines', fn: dropIncompleteTrailingLines },
  { name: 'split-on-semicolons', fn: splitOnSemicolons },
  { name: 'unfold-ampersand-edges', fn: unfoldAmpersandEdges },
  { name: 'strip-parens-in-labels', fn: stripParensInLabels },
  { name: 'fix-slashes-in-labels', fn: fixSlashesInLabels },
  { name: 'fix-state-colon-same-line', fn: fixStateColonOnSameLine },
  { name: 'strip-commas-in-er-attributes', fn: stripCommasInErAttributes },
];

// ------------------------ Runner --------------------------------------------

async function setupParser() {
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
  const isJsdomOnlyError = (msg: string) =>
    /getBBox is not a function|getComputedTextLength|getSubStringLength/i.test(msg);
  return async (src: string): Promise<{ ok: true } | { ok: false; err: string }> => {
    try {
      await parseMermaidToExcalidraw(src.trim());
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (isJsdomOnlyError(msg)) return { ok: true };
      return { ok: false, err: msg.slice(0, 200).replace(/\s+/g, ' ') };
    }
  };
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const dryRun = flag('dry');
  const check = await setupParser();

  const res = await fetch(`${BASE}/api/pages`);
  if (!res.ok) throw new Error(`GET /api/pages -> ${res.status}`);
  const { pages } = (await res.json()) as { pages: Array<{ id: string; slug: string; spaceSlug: string; diagram: string | null }> };

  const broken: Array<{ id: string; label: string; original: string; error: string }> = [];
  for (const p of pages) {
    if (!p.diagram || !p.diagram.trim()) continue;
    const v = await check(p.diagram);
    if (!v.ok) broken.push({ id: p.id, label: `${p.spaceSlug}/${p.slug}`, original: p.diagram, error: v.err });
  }
  console.log(`\n${broken.length} broken diagram(s) to try repairing\n`);
  if (broken.length === 0) return;

  let fixed = 0;
  let stillBad = 0;
  const stillBadList: string[] = [];
  const rulesUsed = new Map<string, number>();

  for (let i = 0; i < broken.length; i++) {
    const b = broken[i];
    const label = `${String(i + 1).padStart(3)}/${broken.length}  ${b.label.padEnd(55)}`;

    let candidate = b.original;
    const applied: string[] = [];
    // Try all rules; a fix might need several passes in sequence
    for (const rule of RULES) {
      const before = candidate;
      candidate = rule.fn(candidate);
      if (candidate !== before) applied.push(rule.name);
    }

    const verify = await check(candidate);
    if (verify.ok && candidate.trim().length > 30) {
      applied.forEach((r) => rulesUsed.set(r, (rulesUsed.get(r) ?? 0) + 1));
      if (dryRun) {
        console.log(`${label}  WOULD FIX  via [${applied.join(', ')}]`);
      } else {
        const putRes = await fetch(`${BASE}/api/pages/${b.id}/diagram`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ diagram: candidate }),
        });
        if (putRes.ok) console.log(`${label}  FIXED   via [${applied.join(', ')}]`);
        else console.log(`${label}  SAVE FAILED  ${putRes.status}`);
      }
      fixed++;
    } else {
      console.log(`${label}  STILL BAD  ${verify.ok === false ? verify.err.slice(0, 120) : 'became too short'}`);
      stillBad++;
      stillBadList.push(b.label);
    }
  }

  console.log(`\n${fixed} ${dryRun ? 'would be fixed' : 'fixed'} · ${stillBad} still need the LLM`);
  if (rulesUsed.size) {
    console.log('\nRules that helped:');
    [...rulesUsed.entries()].sort((a, b) => b[1] - a[1]).forEach(([r, n]) => console.log(`  ${r}: ${n}`));
  }
  if (stillBadList.length) {
    console.log('\nStill need LLM regeneration (top up billing then run scripts/repair-diagrams.ts):');
    stillBadList.forEach((s) => console.log(`  ${s}`));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
