import { NextRequest, NextResponse } from 'next/server';
import { inArray, sql } from 'drizzle-orm';
import { ensureDbReady } from '@/lib/db/init';
import { getDb, schema } from '@/lib/db/client';
import { textOutput, hasProviderKey, activeProvider } from '@/lib/llm';

// Retrieve top-K pages that best match the query using the same FTS as /api/search, then hand them
// to the LLM and ask for a grounded answer with `[Title](/s/space/p/slug)` links back to the KB.

function extractPlainText(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(extractPlainText).join(' ');
  if (typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (Array.isArray(content.content)) return content.content.map(extractPlainText).join(' ');
    if (Array.isArray(content.rows)) {
      return content.rows.map((r: any) => (r.cells ?? []).map(extractPlainText).join(' | ')).join('\n');
    }
  }
  return '';
}

function blocksToPlainMarkdown(blocks: any[]): string {
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
    } else if (t === 'table') {
      out.push(text);
    } else if (text) {
      out.push(text);
    }
  }
  return out.join('\n');
}

export async function POST(req: NextRequest) {
  await ensureDbReady();
  const db = getDb();
  const { q } = (await req.json()) as { q?: string };
  const query = (q ?? '').trim();
  if (!query) return NextResponse.json({ answer: '', citations: [] });

  if (!hasProviderKey()) {
    return NextResponse.json({
      answer: `_AI answer unavailable — no ${activeProvider().toUpperCase()}_API_KEY set in .env._`,
      citations: [],
    });
  }

  // Retrieval: natural-language questions ("how many emails are sent out") tokenise poorly under
  // `&`-joined FTS because every word — including stopwords like "how", "many", "out" — must match.
  // We drop stopwords, keep content words, and OR-join them; then union with per-term ILIKE hits so
  // a page mentioning any core noun ranks in. The LLM makes the final relevance call from a wider set.
  const STOPWORDS = new Set([
    'how','what','when','where','why','who','which','whose','whom','a','an','the','is','are','was','were','be','been','being','do','does','did','can','could','will','would','should','may','might','shall','must','have','has','had','of','to','in','on','at','for','and','or','but','so','if','then','than','as','by','with','from','into','onto','upon','off','out','up','down','over','under','about','many','much','some','any','all','each','every','no','not','yes','my','your','their','it','its','this','that','these','those','me','we','they','you','i','us','them','also','just','only','very','more','less','most','least','than','again','still','also','tell','show','give','make','take','get','put','know','need','see','look','find','use','used','using','via','vs','vs.','etc','etc.'
  ]);

  const rawTokens = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const contentWords = rawTokens.filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  const searchTokens = contentWords.length > 0 ? contentWords : rawTokens; // fall back if user typed only stopwords

  let pageRows: Array<{ id: string; title: string; slug: string; content: any; space_slug: string; space_name: string }> = [];

  const runFts = async (op: '&' | '|') => {
    const tsQuery = searchTokens.map((t) => `${t}:*`).join(` ${op} `);
    if (!tsQuery) return [] as any[];
    try {
      const res = await db.execute(sql`
        SELECT p.id, p.title, p.slug, p.content, sp.slug AS space_slug, sp.name AS space_name,
               ts_rank(p.search_tsv, to_tsquery('english', ${tsQuery})) AS rank
        FROM page p
        JOIN space sp ON sp.id = p.space_id
        WHERE p.search_tsv @@ to_tsquery('english', ${tsQuery})
        ORDER BY rank DESC
        LIMIT 12;
      `);
      return ((res as any).rows ?? res) as any[];
    } catch {
      return [] as any[];
    }
  };

  // Try `&` for precision first; if it returns fewer than 3, widen to `|`
  pageRows = await runFts('&');
  if (pageRows.length < 3) {
    const wide = await runFts('|');
    const seen = new Set(pageRows.map((r) => r.id));
    for (const r of wide) if (!seen.has(r.id)) pageRows.push(r);
    pageRows = pageRows.slice(0, 12);
  }

  // Boost title matches. FTS ts_rank underweights short pages that are exactly on-topic vs long
  // pages that mention the keywords in passing. If a content-word appears in the page title, we
  // pull that page to the front. This is what saved the Clauses page from being drowned by
  // higher-tf-density pages on the "how are clauses attached to shipment certificate" query.
  const titleMatchBoosted: typeof pageRows = [];
  const otherPages: typeof pageRows = [];
  for (const r of pageRows) {
    const titleLower = r.title.toLowerCase();
    const isTitleMatch = searchTokens.some((t) => t.length >= 4 && titleLower.includes(t));
    (isTitleMatch ? titleMatchBoosted : otherPages).push(r);
  }
  pageRows = [...titleMatchBoosted, ...otherPages];

  // Also run a direct title-ILIKE probe — catches pages whose FTS index isn't yet built (fresh
  // seed) or whose search_tsv is stale. Adds them to the pool if not already present.
  for (const t of searchTokens) {
    if (t.length < 4) continue;
    const like = `%${t}%`;
    const res = await db.execute(sql`
      SELECT p.id, p.title, p.slug, p.content, sp.slug AS space_slug, sp.name AS space_name
      FROM page p
      JOIN space sp ON sp.id = p.space_id
      WHERE p.title ILIKE ${like}
      LIMIT 3;
    `);
    const rows = ((res as any).rows ?? res) as any[];
    const seen = new Set(pageRows.map((r) => r.id));
    for (const r of rows) if (!seen.has(r.id)) pageRows.unshift(r); // prepend — title matches lead
  }
  pageRows = pageRows.slice(0, 14);

  // Last-resort: ILIKE on every content word, union results
  if (pageRows.length === 0) {
    for (const word of searchTokens) {
      const ilike = `%${word}%`;
      const res = await db.execute(sql`
        SELECT p.id, p.title, p.slug, p.content, sp.slug AS space_slug, sp.name AS space_name
        FROM page p
        JOIN space sp ON sp.id = p.space_id
        WHERE (p.title ILIKE ${ilike} OR p.content::text ILIKE ${ilike})
        ORDER BY p.updated_at DESC
        LIMIT 6;
      `);
      const rows = ((res as any).rows ?? res) as any[];
      const seen = new Set(pageRows.map((r) => r.id));
      for (const r of rows) if (!seen.has(r.id)) pageRows.push(r);
      if (pageRows.length >= 12) break;
    }
    pageRows = pageRows.slice(0, 12);
  }

  if (pageRows.length === 0) {
    return NextResponse.json({
      answer: `No pages match "${query}" in the KB — try a different phrasing, or open a space from the sidebar to browse.`,
      citations: [],
    });
  }

  // Build the LLM context — up to 10 pages, ~6000 chars per page. Total context ~60k chars ≈ 15k
  // tokens, comfortably under provider limits. Wider context per page matters because product pages
  // like clauses.md are 15k+ chars and a small clip loses the sections that actually answer the
  // question (e.g. how business rules attach clauses to shipments, how certificate PDFs render them).
  const contextSections = pageRows.slice(0, 10).map((p) => {
    const md = blocksToPlainMarkdown(p.content as any[]).slice(0, 6000);
    return `### ${p.title}\nPath: /s/${p.space_slug}/p/${p.slug}\nSpace: ${p.space_name}\n\n${md}`;
  });

  const system = `You are Nacora KB, a knowledge-base assistant for a Business Analyst on the Nacora MGA Embedded Cargo delivery. You answer the user's question grounded in the KB pages provided in the context below.

Rules:
- Draw ONLY from the provided context. If the exact detail isn't there, say what IS covered and point them to the closest relevant pages — don't refuse.
- The context is a broad retrieval — not every page is relevant. Pick the ones that actually answer the question and ignore the rest.
- Every non-trivial claim must cite the source page as a markdown link of the form [Page Title](/s/<space-slug>/p/<page-slug>).
- **BA prose only.** Do NOT use code identifiers — no class names, function names, database table names, ORM types, file paths, or endpoint URLs. Use business terms and UI labels only (e.g. "Global Clauses Library", "Clauses tab", "business rule", "Certificate document"). If the context contains code identifiers, translate them into their business-facing equivalent or omit them.
- **Be comprehensive.** Cover the *what*, the *how*, and *who uses it / where*. If the question asks how something works, walk through the flow step by step. There is no upper word cap — but every sentence should carry weight; don't pad.
- **Formatting discipline for the frontend markdown renderer:**
  - Use proper markdown headings — \`## Section\` for top-level sections, \`### Sub-section\` for nested ones. Do NOT use \`**Bold Title**\` in place of a heading.
  - Use flat bullet lists (\`- item\`). Do NOT indent nested sub-bullets under a bullet — the renderer flattens them into paragraph text and mangles the asterisks. If you need sub-structure, make the parent a \`###\` heading and put the details as flat bullets underneath.
  - For labelled bullets, put the label as bold at the start of the line: \`- **Scope:** Live in the central Global Clauses Library.\` — not \`*Scope:*\` and not \`- Scope:\` on one line with the value on the next.
  - Use markdown tables (\`| col | col |\`) only when there is a true side-by-side comparison, not to fake bullet layout.
- If there are ticket references in the source pages (e.g. "from I2G-29988"), preserve them in your answer — they're audit trail.
- Do not hallucinate paths, page names, endpoints, or numbers. Use only what's in the context.
- End the answer with a short "Sources" line listing the pages you actually drew from.`;

  const user = `Question: ${query}

KB context (candidate pages, ordered by retrieval rank; title-matched pages listed first):

${contextSections.join('\n\n---\n\n')}

Now answer the question thoroughly, following the rules above.`;

  let answer: string;
  try {
    answer = await textOutput({ system, user, maxTokens: 3500 });
  } catch (e) {
    answer = `_AI answer failed: ${e instanceof Error ? e.message : String(e)}._`;
  }

  const citations = pageRows.map((p) => ({
    id: p.id,
    title: p.title,
    spaceSlug: p.space_slug,
    spaceName: p.space_name,
    slug: p.slug,
    href: `/s/${p.space_slug}/p/${p.slug}`,
  }));

  return NextResponse.json({ answer, citations });
}
