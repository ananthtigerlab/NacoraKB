import { textOutput } from '@/lib/llm';

/*
  Turn a page's title + block content into a single Mermaid diagram that summarises the concept.

  The LLM picks its own diagram type (flowchart / sequence / state / mindmap / erDiagram / journey)
  based on what the page is about — a workflow page gets a flowchart, a lifecycle page gets a state
  diagram, a concept page gets a mindmap, etc.
*/

function extractPlainText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(extractPlainText).join(' ');
  if (typeof node === 'object') {
    if (typeof node.text === 'string') return node.text;
    if (Array.isArray(node.content)) return node.content.map(extractPlainText).join(' ');
    if (Array.isArray(node.rows)) {
      return node.rows.map((r: any) => (r.cells ?? []).map(extractPlainText).join(' | ')).join('\n');
    }
  }
  return '';
}

function blocksToMarkdown(blocks: any[]): string {
  if (!Array.isArray(blocks)) return '';
  const out: string[] = [];
  for (const b of blocks) {
    const t = b?.type;
    const text = extractPlainText(b?.content).trim();
    if (t === 'heading') {
      const lvl = Number(b?.props?.level ?? 2);
      out.push(`${'#'.repeat(Math.min(lvl, 6))} ${text}`);
    } else if (t === 'bulletListItem' || t === 'numberedListItem' || t === 'checkListItem') {
      out.push(`- ${text}`);
    } else if (text) {
      out.push(text);
    }
  }
  return out.join('\n');
}

const SYSTEM_PROMPT = `You are a technical illustrator for a knowledge-base wiki. You produce a single Mermaid diagram that summarises the concept described in a page, so readers can grasp the shape of the topic before reading the text. The diagram will be rendered with mermaid-to-excalidraw (hand-drawn sketch style), which supports ONLY these five diagram types.

DIAGRAM TYPE — you MUST emit "flowchart LR". No other type.

This is the only diagram type the rendering library supports reliably. For lifecycle / state-machine pages, draw the states as a linear or branching flowchart. For data-model / entity pages, draw the entities as boxes with arrows for relationships. For cross-actor interactions, use one row of nodes per actor.

DO NOT use: stateDiagram-v2, sequenceDiagram, erDiagram, classDiagram, mindmap, journey, timeline, gantt, pie, quadrantChart, subgraph. All of these break in the browser renderer with "element not found" errors.

RULES:
- Emit ONLY the Mermaid source, wrapped in a \`\`\`mermaid code fence. No preamble, no explanation, no trailing text.
- Keep it compact: 6–14 nodes. Roll up detail into buckets. This is an at-a-glance overview, not a spec.
- Labels: 1–4 words each. Use plain English (title case OK). NO code identifiers (BusinessPartner_v2), NO enum values (STATE_1), NO file paths, NO underscores in labels.
- FORBIDDEN characters inside any label text — these break the Mermaid parser and there is no way to escape them safely for mermaid-to-excalidraw:
  - Round parens \`( )\` — write \`Render HTML with Jinja2\`, not \`Render HTML (Jinja2)\`; \`Broker - Nacora\`, not \`Broker (Nacora)\`.
  - Forward slashes \`/\` — write \`Broker and Underwriter\`, not \`Broker/Underwriter\`; \`Yes or No\`, not \`Yes/No\`.
  - Semicolons \`;\` — every statement goes on its OWN line. Never write \`A --> B; C --> D\`.
  - Ampersands \`&\` — write two separate edges instead of \`X & Y --> Z\`.
  - Colons \`:\` — for stateDiagram descriptions, use \`State : text\` on its own line, and the text must not itself contain a period or colon.
  - Quotes, backslashes, pipes, square brackets, angle brackets, hyphens-that-look-like-arrows.
- Prefer commas or "and" to join items: \`Broker, Underwriter, Admin\` or \`Broker and Underwriter\`.
- Node IDs (the tokens on the left of arrows) MUST be single words, alphanumeric only, no spaces. Use A, B, C or short mnemonic IDs like Quote, Book, Ship.
- For flowcharts: prefer LR (left-to-right) orientation. Use ["Label"] for rectangles, {"Label"} for decisions.
- Do not invent facts. Only diagram what is actually described in the page.
- No comments, no CSS, no themes, no click handlers. Just the diagram.

DIAGRAM-TYPE-SPECIFIC RULES — these patterns break mermaid-to-excalidraw and MUST be avoided:

For stateDiagram-v2:
- Every state name MUST be a single unquoted word: \`Booked\`, \`UnderReview\`, \`ClaimsAdjuster\`. Combine words into one CamelCase token.
- NEVER use \`state Foo as "Foo Bar"\` — aliasing is unsupported. If you want a two-word label, either use the CamelCase state name alone, or use \`Foo : Foo Bar\` on the next line as a description.
- NEVER use composite states with braces: \`state Group { A --> B }\` is unsupported. Keep it flat.
- Every statement on its OWN line. Do not put two states or two transitions on the same line.

For erDiagram:
- Attribute names MUST be a single unquoted word: \`string firstName\`, not \`string "First Name"\`. Combine words into one CamelCase token.
- Relationship labels (\`||--o{ Foo : "label"\`) must be a single unquoted word or a very short unquoted phrase without spaces: \`||--o{ Foo : owns\`, not \`||--o{ Foo : "belongs to"\`. If the relationship needs two words, use CamelCase: \`belongsTo\`.
- Every relationship on its OWN line.

For flowchart LR:
- Never use \`;\` to join edges on one line. Every arrow (\`-->\`, \`-.->\`, \`==>\`) starts a new line.
- Edge labels use the \`-- text -->\` form and \`text\` cannot contain quotes, slashes, parens, or trailing periods.`;

export async function generateDiagram(title: string, content: any[]): Promise<string> {
  const md = blocksToMarkdown(content).slice(0, 6000);
  const baseUser = `Page title: ${title}

Page content:
${md}

Now emit the single best Mermaid diagram for this page.`;

  // First pass
  let raw = await textOutput({ system: SYSTEM_PROMPT, user: baseUser, maxTokens: 3000 });
  let src = cleanMermaid(raw);
  const first = validateMermaid(src);
  if (first.ok) return src;

  // Retry once with an explicit note about the problem
  const retryUser = `${baseUser}

The previous attempt failed validation: ${first.reason}. Emit a shorter diagram (6–10 nodes max) that is complete and syntactically valid. Do not truncate. Do not put forward slashes in labels.`;
  raw = await textOutput({ system: SYSTEM_PROMPT, user: retryUser, maxTokens: 3000 });
  src = cleanMermaid(raw);
  // Return whatever we got — the client shows a "Try again" button if it still won't parse.
  return src;
}

// Strip everything except the Mermaid source. Tolerant of unclosed fences (LLM sometimes truncates).
export function cleanMermaid(raw: string): string {
  let src = raw.trim();
  // Prefer the closed-fence form
  const closed = src.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
  if (closed) src = closed[1];
  else {
    // Unclosed fence — strip the leading fence + language tag
    src = src.replace(/^```(?:mermaid)?\s*\n?/i, '');
    // Strip a trailing fence if the model added one on the last line
    src = src.replace(/```[\s\S]*$/, '');
  }
  src = src.replace(/^mermaid\s*\n/i, '');
  return src.trim();
}

// Cheap structural sanity check — catches truncation and the most common syntax breakages
// without needing to load mermaid-to-excalidraw on the server (which touches `document`).
export function validateMermaid(src: string): { ok: true } | { ok: false; reason: string } {
  const s = src.trim();
  if (!s) return { ok: false, reason: 'diagram is empty' };
  if (s.length < 25) return { ok: false, reason: 'diagram is too short' };

  // Must start with a supported type keyword
  const firstLine = s.split('\n', 1)[0].trim();
  if (!/^flowchart\s+LR\b/.test(firstLine)) {
    return { ok: false, reason: `first line must be "flowchart LR" — got "${firstLine.slice(0, 60)}"` };
  }
  if (/^\s*subgraph\b/m.test(s)) {
    return { ok: false, reason: 'subgraph is not supported (renderer emits "SubGraph element not found") — inline the nodes instead' };
  }

  // Bracket balance (excluding characters inside "quoted" labels)
  let bal: Record<string, number> = { '[': 0, '(': 0, '{': 0 };
  const pairs: Record<string, string> = { ']': '[', ')': '(', '}': '{' };
  let inQuote = false;
  for (const ch of s) {
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (inQuote) continue;
    if (ch === '[' || ch === '(' || ch === '{') bal[ch]++;
    else if (ch === ']' || ch === ')' || ch === '}') bal[pairs[ch]]--;
  }
  for (const k of Object.keys(bal)) {
    if (bal[k] !== 0) return { ok: false, reason: `unbalanced ${k}${k === '[' ? ']' : k === '(' ? ')' : '}'} brackets — likely truncated` };
  }

  // Forbidden characters inside labels — all of these break mermaid-to-excalidraw
  if (/\[[^\]\n]*\/[^\]\n]*\]/.test(s) || /\{"?[^{}\n"]*\/[^{}\n"]*"?\}/.test(s)) {
    return { ok: false, reason: 'a label contains a forward slash — use "and", "or", or a comma' };
  }
  if (/\[[^\]\n]*\([^)\n]*\)[^\]\n]*\]/.test(s) || /\{"?[^{}\n"]*\([^)\n]*\)[^{}\n"]*"?\}/.test(s)) {
    return { ok: false, reason: 'a label contains parens — write "Foo with Bar" or "Foo - Bar" instead' };
  }
  // Semicolons outside quoted text — used as statement joiners
  const withoutQuotes = s.replace(/"[^"\n]*"/g, '');
  if (!/^(sequenceDiagram|classDiagram)/.test(withoutQuotes.trim()) && /;\s+[A-Za-z]/.test(withoutQuotes)) {
    return { ok: false, reason: 'a semicolon is joining statements on the same line — put each on its own line' };
  }
  // Ampersand-as-edge-source form is very fragile; reject to force separate edges
  if (/^(?:\s*)[A-Za-z0-9_]+\s*&\s*[A-Za-z0-9_]+.*-->/m.test(s)) {
    return { ok: false, reason: 'ampersand used to combine edge sources — write each edge separately' };
  }

  return { ok: true };
}
