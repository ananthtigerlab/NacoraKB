import 'server-only';
import { nanoid } from 'nanoid';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { toolJSON, textOutput, hasProviderKey } from '@/lib/llm';
import { logAudit } from '@/lib/audit';
import { BA_STYLE_RULES } from '@/lib/code-sync/sync';
import { markdownToBlocks, parseSynthesisResponse } from './markdown-blocks';

/*
  PRD §5.3 — The ingest & synthesis loop.

  Given a Source that has just been added:
    1. Interpret  — a structured understanding of what the artifact says.
    2. Route      — which existing page(s) it affects (never invents new pages in v1 without BA opt-in).
    3. Synthesise — for each affected page, draft proposed new BlockNote content that respects pinned
                    edits and grounding mode.
    4. Propose    — insert Proposal rows in 'pending' status. Nothing is written to a page yet.

  Approve/Edit/Reject happens via /api/proposals/[id]/decide (PRD §5.5).
*/

const INTERPRET_TOOL_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'Two-sentence summary of what the artifact is about.' },
    key_facts: {
      type: 'array',
      description: 'Discrete factual claims extracted from the artifact, each 1-2 sentences.',
      items: { type: 'string' },
    },
    entities: {
      type: 'array',
      description: 'Named entities mentioned — people, teams, systems, insurance concepts.',
      items: { type: 'string' },
    },
    inferred_topics: {
      type: 'array',
      description: 'Topic tags to help routing (e.g. "policy creation", "rating", "figma screens").',
      items: { type: 'string' },
    },
  },
  required: ['summary', 'key_facts', 'inferred_topics'],
};

type Interpretation = {
  summary: string;
  key_facts: string[];
  entities?: string[];
  inferred_topics: string[];
};

const ROUTE_TOOL_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    affected_pages: {
      type: 'array',
      description:
        'Existing pages this artifact meaningfully updates. Only include a page if the artifact adds or corrects material relevant to it — err on the side of fewer, more relevant matches. Return at most 4.',
      items: {
        type: 'object',
        properties: {
          page_id: { type: 'string' },
          reason: { type: 'string', description: 'One-sentence why this page is affected.' },
        },
        required: ['page_id', 'reason'],
      },
    },
  },
  required: ['affected_pages'],
};

type Routing = { affected_pages: Array<{ page_id: string; reason: string }> };

// Synthesis is done via plain-text output (not function calling). See lib/code-sync/sync.ts for why.

const INTERPRET_SYSTEM = `You are the interpretation stage of a Business Analyst's knowledge base.
The BA works on Nacora — an MGA (Managing General Agent) embedded cargo-insurance product built on the TigerLab platform.
Given a raw artifact (transcript, screenshot text, doc, slides, notes), produce a clean structured understanding.
Do not speculate beyond what the artifact says. Do not invent client names or numbers.`;

const ROUTE_SYSTEM = (pagesJson: string) => `You are the routing stage.
Given an interpreted artifact and a list of existing knowledge-base pages, decide which pages the artifact affects.
Pages are grouped by space. Each has an id, title, space name, and grounding mode.

PAGES (JSON):
${pagesJson}

Rules:
- Return only pages the artifact would meaningfully update. Return an empty list if none clearly apply.
- Prefer more specific pages over broad ones (e.g. "Rating" over "Architecture Overview" when a rating change is described).
- Never invent page_ids not in the list.`;

const SYNTHESE_SYSTEM = (page: {
  title: string;
  space: string;
  groundingMode: string;
  currentContent: string;
  pinnedContent: string;
}) => `${BA_STYLE_RULES}

CONTEXT FOR THIS PAGE:
- Title: ${page.title}
- Space: ${page.space}
- Grounding: ${page.groundingMode}  ← on code_first pages the codebase is authoritative; if the new artifact contradicts a code-grounded statement, log it as a conflict (do not silently overwrite). On human_source pages the artifact and BA notes are authoritative.

CURRENT PAGE CONTENT (JSON):
${page.currentContent}

PINNED CONTENT (must remain verbatim, in place):
${page.pinnedContent || '(none)'}
`;

export async function ingestSource(sourceId: string): Promise<{ proposalCount: number }> {
  if (!hasProviderKey()) {
    // Phase 0 mode — synthesis skipped.
    return { proposalCount: 0 };
  }

  const db = getDb();
  const [source] = await db.select().from(schema.sources).where(eq(schema.sources.id, sourceId)).limit(1);
  if (!source) throw new Error('source not found');

  const rawText = (source.extractedText || source.label || '').slice(0, 60_000);
  if (!rawText.trim()) return { proposalCount: 0 };

  // 1) Interpret
  const interp = await toolJSON<Interpretation>({
    system: INTERPRET_SYSTEM,
    user: `Artifact label: ${source.label}\nType: ${source.type}\nURL: ${source.url ?? '(none)'}\n\nARTIFACT TEXT:\n${rawText}`,
    toolName: 'record_interpretation',
    toolDescription: 'Record a structured interpretation of the artifact.',
    inputSchema: INTERPRET_TOOL_INPUT_SCHEMA,
    maxTokens: 1500,
  });

  const ingestionId = nanoid();
  await db.insert(schema.ingestions).values({
    id: ingestionId,
    sourceId,
    modelInterpretation: interp as any,
  });

  // 2) Route
  const pages = await db
    .select({
      id: schema.pages.id,
      title: schema.pages.title,
      spaceId: schema.pages.spaceId,
      groundingMode: schema.pages.groundingMode,
    })
    .from(schema.pages);
  const spaces = await db.select().from(schema.spaces);
  const spaceById = new Map(spaces.map((s) => [s.id, s]));

  const pagesForModel = pages.map((p) => ({
    id: p.id,
    title: p.title,
    space: spaceById.get(p.spaceId)?.name ?? '',
    grounding: p.groundingMode ?? spaceById.get(p.spaceId)?.groundingMode ?? 'human_source',
  }));

  const routing = await toolJSON<Routing>({
    system: ROUTE_SYSTEM(JSON.stringify(pagesForModel, null, 2)),
    user: `Artifact summary: ${interp.summary}\nInferred topics: ${interp.inferred_topics.join(', ')}\nKey facts:\n- ${interp.key_facts.join('\n- ')}`,
    toolName: 'route_to_pages',
    toolDescription: 'Return the list of pages this artifact affects.',
    inputSchema: ROUTE_TOOL_INPUT_SCHEMA,
    maxTokens: 1200,
  });

  const validPageIds = new Set(pages.map((p) => p.id));
  const targets = routing.affected_pages.filter((t) => validPageIds.has(t.page_id)).slice(0, 4);

  // 3) Synthesise per page
  let proposalCount = 0;
  for (const target of targets) {
    const [pg] = await db.select().from(schema.pages).where(eq(schema.pages.id, target.page_id)).limit(1);
    if (!pg) continue;
    const space = spaceById.get(pg.spaceId)!;
    const grounding = pg.groundingMode ?? space.groundingMode;
    const currentJson = JSON.stringify(pg.content, null, 2).slice(0, 30_000);
    const pinnedContent = extractPinnedText(pg.content as any);

    let raw: string;
    try {
      raw = await textOutput({
        system: SYNTHESE_SYSTEM({
          title: pg.title,
          space: space.name,
          groundingMode: grounding,
          currentContent: currentJson.slice(0, 6_000),
          pinnedContent,
        }),
        user: `New artifact ("${source.label}") — routing reason: ${target.reason}\n\nArtifact summary: ${interp.summary}\nKey facts:\n- ${interp.key_facts.join('\n- ')}\n\nOriginal artifact excerpt:\n${rawText.slice(0, 15_000)}`,
        maxTokens: 6000,
      });
    } catch (err) {
      console.warn('[synthesis] page skipped', pg.id, (err as Error).message);
      continue;
    }

    const { rationale, markdown } = parseSynthesisResponse(raw);
    if (!markdown.trim()) {
      console.warn('[synthesis] empty markdown from model for', pg.title);
      continue;
    }
    const normalised = markdownToBlocks(markdown);

    const proposalId = nanoid();
    await db.insert(schema.proposals).values({
      id: proposalId,
      ingestionId,
      targetPageId: pg.id,
      proposedContent: normalised,
      modelRationale: rationale,
      status: 'pending',
    });

    await logAudit({
      type: 'proposal_created',
      actor: 'model',
      payload: { pageTitle: pg.title, rationale, reason: target.reason },
      relatedIds: { pageId: pg.id, proposalId, sourceId, ingestionId },
    });

    proposalCount += 1;
  }

  return { proposalCount };
}

// Extract text from any block whose props.pinned === true. Pinned content is preserved during synthesis.
function extractPinnedText(blocks: any[]): string {
  const chunks: string[] = [];
  const walk = (arr: any[]) => {
    for (const b of arr ?? []) {
      if (b?.props?.pinned === true) {
        chunks.push(JSON.stringify(b));
      }
      if (Array.isArray(b?.children)) walk(b.children);
    }
  };
  walk(blocks);
  return chunks.join('\n');
}
