import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { ensureDbReady } from '@/lib/db/init';
import { getDb, schema } from '@/lib/db/client';

// Postgres full-text over page.search_tsv + source.search_tsv, filtered by tag facets.
// Falls back to ILIKE if the generated tsvector columns aren't available on the running PGlite build.

export async function GET(req: NextRequest) {
  await ensureDbReady();
  const db = getDb();
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const tagFilters = req.nextUrl.searchParams.getAll('tag').map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!q && tagFilters.length === 0) return NextResponse.json([]);

  // Natural-language questions ("how many emails are sent") tokenise poorly under `&` — every
  // stopword becomes required. We drop stopwords, keep content words, and prefer `&` for precision,
  // then widen to `|` if too few hits.
  const STOPWORDS = new Set([
    'how','what','when','where','why','who','which','whose','whom','a','an','the','is','are','was','were','be','been','being','do','does','did','can','could','will','would','should','may','might','shall','must','have','has','had','of','to','in','on','at','for','and','or','but','so','if','then','than','as','by','with','from','into','onto','upon','off','out','up','down','over','under','about','many','much','some','any','all','each','every','no','not','yes','my','your','their','it','its','this','that','these','those','me','we','they','you','i','us','them','also','just','only','very','more','less','most','least','again','still'
  ]);
  const rawTokens = q ? q.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).filter(Boolean) : [];
  const contentTokens = rawTokens.filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  const usableTokens = contentTokens.length > 0 ? contentTokens : rawTokens;
  const tsQueryAnd = usableTokens.length ? usableTokens.map((t) => `${t}:*`).join(' & ') : null;
  const tsQueryOr = usableTokens.length ? usableTokens.map((t) => `${t}:*`).join(' | ') : null;
  const tsQuery = tsQueryAnd;

  // --- Page hits ---
  let pageIdFilter: string[] | null = null;
  if (tagFilters.length > 0) {
    const tagIds = (
      await db.select({ id: schema.tags.id }).from(schema.tags).where(inArray(schema.tags.name, tagFilters))
    ).map((t) => t.id);
    if (tagIds.length === 0) pageIdFilter = [];
    else {
      const rows = await db.select({ pageId: schema.pageTags.pageId }).from(schema.pageTags).where(inArray(schema.pageTags.tagId, tagIds));
      // AND across tags — page must have all requested tags.
      const counts = new Map<string, number>();
      for (const r of rows) counts.set(r.pageId, (counts.get(r.pageId) ?? 0) + 1);
      pageIdFilter = [...counts.entries()].filter(([, c]) => c >= tagFilters.length).map(([id]) => id);
    }
  }

  const runFtsPages = async (expr: string): Promise<any[]> => {
    try {
      const query = sql`
        SELECT p.id, p.title, p.slug, p.content, sp.slug AS space_slug,
               ts_headline('english', coalesce(p.content::text, ''), plainto_tsquery('english', ${q}),
                           'MaxWords=15, MinWords=5, ShortWord=2') AS snippet,
               ts_rank(p.search_tsv, to_tsquery('english', ${expr})) AS rank
        FROM page p
        JOIN space sp ON sp.id = p.space_id
        WHERE p.search_tsv @@ to_tsquery('english', ${expr})
        ${pageIdFilter ? sql`AND p.id IN (${sql.join(pageIdFilter.map((id) => sql`${id}`), sql`,`)})` : sql``}
        ORDER BY rank DESC
        LIMIT 15;
      `;
      const res = await db.execute(query);
      return (res as any).rows ?? res;
    } catch {
      return [];
    }
  };

  let pageRows: any[] = pageIdFilter && pageIdFilter.length === 0 ? [] : [];
  if (!(pageIdFilter && pageIdFilter.length === 0)) {
    if (tsQueryAnd) pageRows = await runFtsPages(tsQueryAnd);
    if (pageRows.length < 3 && tsQueryOr) {
      const wide = await runFtsPages(tsQueryOr);
      const seen = new Set(pageRows.map((r) => r.id));
      for (const r of wide) if (!seen.has(r.id)) pageRows.push(r);
      pageRows = pageRows.slice(0, 15);
    }
    if (pageRows.length === 0) {
      // Final fallback: ILIKE across the raw query, then per-token
      const candidates = q ? [q, ...usableTokens] : ['%'];
      for (const term of candidates) {
        const ilike = term === '%' ? '%' : `%${term}%`;
        const raw = sql`
          SELECT p.id, p.title, p.slug, p.content, sp.slug AS space_slug, substring(coalesce(p.content::text,'') from 1 for 240) AS snippet
          FROM page p
          JOIN space sp ON sp.id = p.space_id
          WHERE (p.title ILIKE ${ilike} OR p.content::text ILIKE ${ilike})
          ${pageIdFilter ? sql`AND p.id IN (${sql.join(pageIdFilter.map((id) => sql`${id}`), sql`,`)})` : sql``}
          ORDER BY p.updated_at DESC
          LIMIT 15;
        `;
        const res = await db.execute(raw);
        const rows = (res as any).rows ?? res;
        const seen = new Set(pageRows.map((r) => r.id));
        for (const r of rows) if (!seen.has(r.id)) pageRows.push(r);
        if (pageRows.length >= 15) break;
      }
      pageRows = pageRows.slice(0, 15);
    }

    // Title-match boost — same fix as /api/ai-answer. `ts_rank` underweights short pages that are
    // exactly on-topic vs long pages that mention the keywords in passing. Pull title-match hits
    // to the front and probe title-ILIKE separately so a page whose search_tsv is stale can still
    // surface if its title matches a content-word.
    if (usableTokens.length > 0) {
      const titleMatchers = usableTokens.filter((t) => t.length >= 4);
      if (titleMatchers.length > 0) {
        // 1. Direct title-ILIKE probe — union any missing title matches into the pool
        for (const t of titleMatchers) {
          const like = `%${t}%`;
          try {
            const res = await db.execute(sql`
              SELECT p.id, p.title, p.slug, p.content, sp.slug AS space_slug,
                     substring(coalesce(p.content::text,'') from 1 for 240) AS snippet
              FROM page p
              JOIN space sp ON sp.id = p.space_id
              WHERE p.title ILIKE ${like}
              ${pageIdFilter ? sql`AND p.id IN (${sql.join(pageIdFilter.map((id) => sql`${id}`), sql`,`)})` : sql``}
              LIMIT 5;
            `);
            const rows = ((res as any).rows ?? res) as any[];
            const seen = new Set(pageRows.map((r) => r.id));
            for (const r of rows) if (!seen.has(r.id)) pageRows.push(r);
          } catch {
            /* ignore — worst case, no boost applied */
          }
        }
        // 2. Pull title-match hits to the front of the ordering
        const titleBoosted: any[] = [];
        const rest: any[] = [];
        for (const r of pageRows) {
          const t = (r.title ?? '').toLowerCase();
          const isMatch = titleMatchers.some((w) => t.includes(w));
          (isMatch ? titleBoosted : rest).push(r);
        }
        pageRows = [...titleBoosted, ...rest].slice(0, 15);
      }
    }
  }

  const pageIds = pageRows.map((r) => r.id);
  const pageTagRows = pageIds.length
    ? await db
        .select({ pageId: schema.pageTags.pageId, name: schema.tags.name })
        .from(schema.pageTags)
        .innerJoin(schema.tags, eq(schema.pageTags.tagId, schema.tags.id))
        .where(inArray(schema.pageTags.pageId, pageIds))
    : [];
  const tagsByPage = new Map<string, string[]>();
  for (const t of pageTagRows) tagsByPage.set(t.pageId, [...(tagsByPage.get(t.pageId) ?? []), t.name]);

  // --- Source hits (only if there's a text query — tag-only filter is for pages) ---
  let sourceRows: any[] = [];
  if (q) {
    try {
      const src = sql`
        SELECT id, type, label, substring(coalesce(extracted_text,'') from 1 for 240) AS snippet
        FROM source
        WHERE (label ILIKE ${'%' + q + '%'} OR extracted_text ILIKE ${'%' + q + '%'})
        ORDER BY ingested_at DESC
        LIMIT 8;
      `;
      const res = await db.execute(src);
      sourceRows = (res as any).rows ?? res;
    } catch {
      /* ignore */
    }
  }

  // Build a clean text snippet from the block content (ts_headline runs against raw JSONB which
  // includes structural noise like `[{"id":"...","type":"heading"}...]`).
  function extractTextFromBlocks(content: any): string {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.map(extractTextFromBlocks).join(' ');
    if (typeof content === 'object') {
      if (typeof content.text === 'string') return content.text;
      if (Array.isArray(content.content)) return content.content.map(extractTextFromBlocks).join(' ');
      if (Array.isArray(content.rows)) {
        return content.rows.map((r: any) => (r.cells ?? []).map(extractTextFromBlocks).join(' | ')).join(' ');
      }
    }
    return '';
  }

  function makeSnippet(content: any, terms: string[]): string {
    const text = extractTextFromBlocks(content).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (terms.length === 0) return text.slice(0, 220);
    const lower = text.toLowerCase();
    let bestIdx = -1;
    for (const t of terms) {
      const i = lower.indexOf(t.toLowerCase());
      if (i >= 0 && (bestIdx === -1 || i < bestIdx)) bestIdx = i;
    }
    if (bestIdx === -1) return text.slice(0, 220);
    const start = Math.max(0, bestIdx - 60);
    const end = Math.min(text.length, bestIdx + 200);
    const clip = (start > 0 ? '… ' : '') + text.slice(start, end) + (end < text.length ? ' …' : '');
    // Wrap matched terms in <b> so the frontend highlighter converts them to <mark>
    const escaped = clip.replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;'));
    let highlighted = escaped;
    for (const t of terms) {
      const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
      highlighted = highlighted.replace(re, '<b>$1</b>');
    }
    return highlighted;
  }

  const highlightTerms = usableTokens.filter((t) => t.length >= 2);

  const hits = [
    ...pageRows.map((r: any) => ({
      kind: 'page' as const,
      id: r.id,
      title: r.title,
      slug: r.slug,
      spaceSlug: r.space_slug ?? r.spaceSlug,
      snippet: makeSnippet(r.content, highlightTerms),
      tags: tagsByPage.get(r.id) ?? [],
    })),
    ...sourceRows.map((r: any) => ({
      kind: 'source' as const,
      id: r.id,
      label: r.label,
      type: r.type,
      snippet: r.snippet ?? '',
    })),
  ];
  return NextResponse.json(hits);
}
