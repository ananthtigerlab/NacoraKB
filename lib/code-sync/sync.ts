import 'server-only';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { logAudit } from '@/lib/audit';
import {
  changedFiles,
  currentHead,
  fileAtRef,
  getRepoPath,
  listScopedFilesAtHead,
} from './git';
import { toolJSON, textOutput, hasProviderKey } from '@/lib/llm';
import { discoverConcepts, type DiscoveryPlan } from './discovery';
import { markdownToBlocks, parseSynthesisResponse } from '@/lib/synthesis/markdown-blocks';

/*
  PRD §5.4 — code grounding + sync.

  Two modes:
    - INITIAL (no last_synced_commit): discovery pass (login→logout trace) → per-page synthesis
      for existing candidate pages AND newly proposed pages.
    - INCREMENTAL: `git diff last..HEAD` scoped to Nacora paths → per-affected-page synthesis.

  Both modes emit Proposals in 'pending' status. The BA approves/edits/rejects (PRD §5.5).
*/

const MAX_PAGES_PER_SYNC = 24;
const MAX_FILES_PER_PAGE = 6;
const FILE_EXCERPT_CHARS = 6000;

const ROUTE_TOOL_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    affected_pages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          page_id: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['page_id', 'reason'],
      },
    },
  },
  required: ['affected_pages'],
};

const PICK_FILES_TOOL_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    file_paths: {
      type: 'array',
      description: `Up to ${MAX_FILES_PER_PAGE} file paths (from the provided list, verbatim) that best cover the concepts on this page. Rank by relevance — most important first.`,
      items: { type: 'string' },
    },
  },
  required: ['file_paths'],
};

// Synthesis is done via plain-text output (not function calling) because provider validators
// (esp. Gemini) fail to fill big-string fields inside a function-call argument reliably. The model
// writes markdown; we parse it into BlockNote blocks server-side.
// Conflicts are surfaced as a small toolJSON call after the fact if needed.

// PRD §7 + BA writing style — the mandatory house rules the synthesiser must obey.
// Kept as a named constant so the artifact-ingest pipeline can reuse it (see lib/synthesis/ingest.ts).
export const BA_STYLE_RULES = `You are writing for a Business Analyst joining the Nacora delivery.
Not a developer. Not a stakeholder brief. Someone who needs to understand — functionally — what the system does.

STYLE (mandatory):
- Focus on FUNCTIONAL and BEHAVIOURAL — what the user sees, what the user does, what the system does in response, what business rules apply. What triggers what.
- Show CALCULATIONS with their inputs and formulas in plain English. e.g. "Premium = base rate × sum insured × commodity factor × currency conversion. base rate comes from the Base Rater version active at quote time…". Use example numbers if it helps.
- State BUSINESS RULES as plain-English trigger conditions. e.g. "If commodity group is 'hazmat' and policyholder type is 'broker', the shipment is referred for underwriter approval before booking."
- Name the domain entities the BA will meet (Policy, Shipment, Business Partner, Broker Company, Clause, Special Rate Request, MTA, etc.). Do NOT name Python classes, function names, database tables, or file paths inside the prose. Those are developer-speak — the BA doesn't need them.
- No code fences. No inline backticks around identifiers. No import statements or SQL.
- Skip line-by-line implementation details. A fact only earns its place on the page if a BA needs to know it to reason about behaviour.
- Short paragraphs, bullets, small tables. Aim for sentences under 25 words.

STRUCTURE (mandatory sections, in this order — omit a section if genuinely nothing to say there):
1. What it is — 2–3 sentences of plain English defining the concept in the product.
2. Who uses it & where — user types (Broker, Policyholder, Underwriter, Admin, Participant) and the screens/portals they use (Backoffice at nacora-bo.i2go.io, Shipment Portal at nacora-sp.i2go.io).
3. How it works — the flow. Numbered steps for a process; headings + short paragraphs for a data model. Include screen names / form step numbers where relevant.
4. Business rules & calculations — bullet list. Rules as "If X, then Y." Calculations as plain-English formulas with inputs identified.
5. Related concepts — 3–6 bullets naming other pages a BA reads next (plain text titles, no links).

DO NOT include a "Source files" heading, a file-path list, or references to code paths in the visible prose. Provenance is tracked separately (the page shows source chips at the top).

OUTPUT FORMAT (mandatory — parsed by code, must be exact):

---RATIONALE---
<one or two sentences: what you rewrote and why. Plain text, no markdown.>

---CONTENT---
<the full page body in markdown, following the STRUCTURE above>

Markdown allowed: # / ## / ### headings, paragraphs, - bullet lists, 1. numbered lists, > blockquotes, **bold**, *italic*. Nothing else — no tables, no code fences, no links, no images, no inline backticks.`;

export type RunSyncOptions = {
  /** Ignore last_synced_commit and treat this run as initial (discovery pass). */
  forceInitial?: boolean;
};

export async function runSync(opts: RunSyncOptions = {}): Promise<{
  mode: 'initial' | 'incremental' | 'noop';
  syncId: string;
  changedCount: number;
  proposalCount: number;
  conflictCount: number;
  newPagesCreated?: number;
}> {
  const db = getDb();
  const repoPath = getRepoPath();

  const [lastRow] = await db.select().from(schema.settings).where(eq(schema.settings.key, 'last_synced_commit'));
  const from = opts.forceInitial ? null : ((lastRow?.value as string | null) ?? null);
  const to = await currentHead();

  if (from && from === to) {
    return { mode: 'noop', syncId: '', changedCount: 0, proposalCount: 0, conflictCount: 0 };
  }

  const mode: 'initial' | 'incremental' = from ? 'incremental' : 'initial';

  // Discover files in scope.
  let filesForContext: Array<{ path: string; scope: 'primary' | 'shared'; status: string }>;
  if (mode === 'initial') {
    filesForContext = (await listScopedFilesAtHead()).map((f) => ({ ...f, status: 'A' }));
  } else {
    filesForContext = await changedFiles(from, to);
  }

  const syncId = nanoid();
  await db.insert(schema.codeSyncs).values({
    id: syncId,
    fromCommit: from,
    toCommit: to,
    changesSummary: {
      repoPath,
      mode,
      changedFiles: filesForContext.slice(0, 200),
      counts: {
        primary: filesForContext.filter((c) => c.scope === 'primary').length,
        shared: filesForContext.filter((c) => c.scope === 'shared').length,
      },
    },
    affectedPageIds: [],
  });

  if (lastRow) {
    await db.update(schema.settings).set({ value: to, updatedAt: new Date() }).where(eq(schema.settings.key, 'last_synced_commit'));
  } else {
    await db.insert(schema.settings).values({ key: 'last_synced_commit', value: to });
  }

  await logAudit({
    type: 'code_sync',
    actor: 'sync',
    payload: { mode, from, to, changedCount: filesForContext.length },
    relatedIds: { codeSyncId: syncId },
  });

  if (filesForContext.length === 0 || !hasProviderKey()) {
    return { mode, syncId, changedCount: filesForContext.length, proposalCount: 0, conflictCount: 0, newPagesCreated: 0 };
  }

  // Load pages + spaces once.
  const spaces = await db.select().from(schema.spaces);
  const spaceById = new Map(spaces.map((s) => [s.id, s]));
  const productSpace = spaces.find((s) => s.slug === 'product');

  type PageRecord = {
    id: string;
    title: string;
    slug: string;
    spaceId: string;
    groundingMode: 'code_first' | 'human_source' | null;
    content: unknown;
  };
  const codeFirstPages: PageRecord[] = (
    await db
      .select({
        id: schema.pages.id,
        title: schema.pages.title,
        slug: schema.pages.slug,
        spaceId: schema.pages.spaceId,
        groundingMode: schema.pages.groundingMode,
        content: schema.pages.content,
      })
      .from(schema.pages)
  ).filter((p) => (p.groundingMode ?? 'human_source') === 'code_first');
  const pagesById = new Map<string, PageRecord>(codeFirstPages.map((p) => [p.id, p]));

  // ------------------------------------------------------------------
  // ROUTING (initial mode = discovery pass; incremental = change-based router)
  // ------------------------------------------------------------------

  type Target = { pageId: string; reason: string; hintFiles: string[] };
  let targets: Target[] = [];
  let newPagesCreated = 0;
  let discoveryPlan: DiscoveryPlan | null = null;

  if (mode === 'initial' && productSpace) {
    const productPages = codeFirstPages.filter((p) => p.spaceId === productSpace.id);
    let plan: DiscoveryPlan | null = null;
    try {
      const result = await discoverConcepts(
        to,
        productPages.map((p) => ({ slug: p.slug, title: p.title })),
        filesForContext.map((f) => f.path),
      );
      plan = result.plan;
    } catch (err) {
      console.warn('[sync] discovery failed, falling back to candidate pages:', (err as Error).message);
      await logAudit({
        type: 'code_sync.discovery_failed',
        actor: 'sync',
        payload: { error: (err as Error).message },
        relatedIds: { codeSyncId: syncId },
      });
    }

    if (!plan) {
      // Fallback: populate the first N candidate pages without new-page discovery.
      targets = productPages.slice(0, MAX_PAGES_PER_SYNC).map((p) => ({
        pageId: p.id,
        reason: 'Initial code-grounded synthesis (discovery skipped)',
        hintFiles: [],
      }));
    } else {
      discoveryPlan = plan;

    // 1) Create new pages for each new_pages entry, immediately (BA can delete if wrong).
    const productPageSlugs = new Set(productPages.map((p) => p.slug));
    for (const np of plan.new_pages) {
      let slug = np.slug;
      let i = 1;
      while (productPageSlugs.has(slug)) {
        i += 1;
        slug = `${np.slug}-${i}`;
      }
      const newPageId = nanoid();
      const placeholder = [
        {
          id: nanoid(),
          type: 'paragraph',
          props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
          content: [
            {
              type: 'text',
              text: `This page was proposed by the initial code-grounded sync. Concept: ${np.concept_summary}`,
              styles: { italic: true },
            },
          ],
          children: [],
        },
        {
          id: nanoid(),
          type: 'paragraph',
          props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
          content: [
            {
              type: 'text',
              text: 'Approve the corresponding proposal to populate it, or delete this page if the concept isn’t relevant.',
              styles: {},
            },
          ],
          children: [],
        },
      ];
      await db.insert(schema.pages).values({
        id: newPageId,
        spaceId: productSpace.id,
        parentPageId: null,
        title: np.title,
        slug,
        icon: null,
        groundingMode: 'code_first',
        content: placeholder,
      });
      pagesById.set(newPageId, {
        id: newPageId,
        title: np.title,
        slug,
        spaceId: productSpace.id,
        groundingMode: 'code_first',
        content: placeholder,
      });
      productPageSlugs.add(slug);
      newPagesCreated += 1;
      await logAudit({
        type: 'structural.page_created_by_sync',
        actor: 'sync',
        payload: { title: np.title, slug, reason: np.reason, concept: np.concept_summary },
        relatedIds: { pageId: newPageId, codeSyncId: syncId },
      });
      targets.push({
        pageId: newPageId,
        reason: np.concept_summary,
        hintFiles: (np.key_files ?? []).slice(0, MAX_FILES_PER_PAGE),
      });
    }

    // 2) Map pages_to_populate → existing page ids.
    const slugToId = new Map(productPages.map((p) => [p.slug, p.id]));
    for (const pop of plan.pages_to_populate) {
      const pageId = slugToId.get(pop.page_slug);
      if (!pageId) continue;
      targets.push({
        pageId,
        reason: pop.concept_summary,
        hintFiles: (pop.key_files ?? []).slice(0, MAX_FILES_PER_PAGE),
      });
    }

    // Cap for time/token safety. Existing-page targets come after new-page targets,
    // so priority goes: newly discovered concepts → existing candidates.
    targets = targets.slice(0, MAX_PAGES_PER_SYNC);

      // Update the sync record with the discovery narrative so /sync history shows the trace.
      const [currentSync] = await db.select().from(schema.codeSyncs).where(eq(schema.codeSyncs.id, syncId));
      await db
        .update(schema.codeSyncs)
        .set({
          changesSummary: {
            ...((currentSync?.changesSummary as Record<string, unknown>) ?? {}),
            discoveryMap: plan.high_level_map,
            newPagesProposed: plan.new_pages.map((p) => ({ title: p.title, slug: p.slug, reason: p.reason })),
          },
        })
        .where(eq(schema.codeSyncs.id, syncId));
    }
  } else if (mode === 'incremental') {
    const pagesForModel = codeFirstPages.map((p) => ({
      id: p.id,
      title: p.title,
      space: spaceById.get(p.spaceId)?.name ?? '',
    }));
    const changeSummary = filesForContext
      .slice(0, 200)
      .map((c) => `[${c.scope}] ${c.status} ${c.path}`)
      .join('\n');
    const routing = await toolJSON<{ affected_pages: Array<{ page_id: string; reason: string }> }>({
      system:
        `You are the code-sync router. Given a list of file changes in the Nacora Django/React monorepo and the list of code-first knowledge-base pages, decide which pages the changes affect.\n\nPAGES:\n${JSON.stringify(pagesForModel, null, 2)}`,
      user: `Changes since last sync (${from ?? 'initial'} → ${to.slice(0, 8)}):\n${changeSummary}`,
      toolName: 'route_code_changes',
      toolDescription: 'Return pages affected by the code changes.',
      inputSchema: ROUTE_TOOL_INPUT_SCHEMA,
      maxTokens: 1500,
    });
    const validIds = new Set(codeFirstPages.map((p) => p.id));
    targets = routing.affected_pages
      .filter((t) => validIds.has(t.page_id))
      .slice(0, MAX_PAGES_PER_SYNC)
      .map((t) => ({ pageId: t.page_id, reason: t.reason, hintFiles: [] }));
  }

  // File catalog for the fallback file-picker.
  const fileCatalog = filesForContext.map((f) => `${f.scope === 'shared' ? '*' : ' '} ${f.path}`).join('\n');

  // ------------------------------------------------------------------
  // SYNTHESIS PER PAGE
  // ------------------------------------------------------------------

  let proposalCount = 0;
  let conflictCount = 0;

  for (const target of targets) {
    const page = pagesById.get(target.pageId);
    if (!page) continue;

    // Prefer discovery hint files; only run the picker if we don't have any.
    let picked: string[] = target.hintFiles.slice(0, MAX_FILES_PER_PAGE);
    if (picked.length === 0) {
      try {
        const pick = await toolJSON<{ file_paths: string[] }>({
          system:
            `You pick source files most relevant to a knowledge-base page.\nGiven the page's title and its current content, choose up to ${MAX_FILES_PER_PAGE} file paths from the provided catalog. Return paths VERBATIM from the catalog. Lines marked with '*' are shared platform code — prefer client-specific paths when both are relevant.`,
          user: `PAGE: ${page.title}\nSPACE: ${spaceById.get(page.spaceId)?.name}\n\nFILE CATALOG:\n${fileCatalog.slice(0, 40_000)}`,
          toolName: 'pick_files',
          toolDescription: 'Choose file paths most relevant to this page.',
          inputSchema: PICK_FILES_TOOL_INPUT_SCHEMA,
          maxTokens: 800,
        });
        picked = (pick.file_paths ?? []).slice(0, MAX_FILES_PER_PAGE);
      } catch (err) {
        console.warn('[sync] file-pick failed for', page.title, (err as Error).message);
      }
    }

    if (picked.length === 0) picked = filesForContext.slice(0, MAX_FILES_PER_PAGE).map((f) => f.path);

    const fileContents: Array<{ path: string; excerpt: string }> = [];
    for (const p of picked) {
      const content = await fileAtRef(p, to);
      if (content) fileContents.push({ path: p, excerpt: content.slice(0, FILE_EXCERPT_CHARS) });
    }
    if (fileContents.length === 0) {
      console.warn('[sync] no readable files for', page.title);
      continue;
    }

    let raw: string;
    try {
      raw = await textOutput({
        system: BA_STYLE_RULES,
        user: `PAGE: ${page.title}
SPACE: ${spaceById.get(page.spaceId)?.name}
CONCEPT (from discovery): ${target.reason}

CURRENT PAGE CONTENT (may be a placeholder):
${extractPlainText(page.content).slice(0, 6_000)}

RELEVANT SOURCE FILES (${fileContents.length}) — READ THESE AS EVIDENCE ONLY; DO NOT NAME THEM IN THE PROSE:
${fileContents.map((f) => `\n--- ${f.path} ---\n${f.excerpt}`).join('\n').slice(0, 40_000)}`,
        maxTokens: 8000,
      });
    } catch (err) {
      console.warn('[sync] synth failed for', page.title, (err as Error).message);
      continue;
    }

    const { rationale, markdown } = parseSynthesisResponse(raw);
    if (!markdown.trim()) {
      console.warn('[sync] empty markdown from model for', page.title);
      continue;
    }
    const normalised = markdownToBlocks(markdown);
    const conflicts: Array<{ code_statement: string; human_statement: string }> = [];

    const proposalId = nanoid();
    await db.insert(schema.proposals).values({
      id: proposalId,
      codeSyncId: syncId,
      targetPageId: page.id,
      proposedContent: normalised,
      modelRationale: rationale,
      status: 'pending',
    });
    proposalCount += 1;

    for (const c of conflicts) {
      await db.insert(schema.conflicts).values({
        id: nanoid(),
        pageId: page.id,
        sectionRef: null,
        codeStatement: c.code_statement,
        humanStatement: c.human_statement,
        humanSourceId: null,
        status: 'open',
      });
      conflictCount += 1;
    }

    await logAudit({
      type: 'proposal_created',
      actor: 'sync',
      payload: {
        pageTitle: page.title,
        rationale,
        conflicts: conflicts.length,
        sourceFiles: fileContents.map((f) => f.path),
        mode,
      },
      relatedIds: { pageId: page.id, proposalId, codeSyncId: syncId },
    });
  }

  await db
    .update(schema.codeSyncs)
    .set({ affectedPageIds: targets.map((t) => t.pageId) })
    .where(eq(schema.codeSyncs.id, syncId));

  return { mode, syncId, changedCount: filesForContext.length, proposalCount, conflictCount, newPagesCreated };
}

// Flatten BlockNote block JSON to a plain-text summary — fed back to the model as "current content"
// so it knows what already exists on the page without needing to parse the full block tree.
function extractPlainText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  const chunks: string[] = [];
  const walk = (arr: any[]) => {
    for (const b of arr) {
      if (Array.isArray(b?.content)) {
        for (const inline of b.content) {
          if (inline?.text) chunks.push(inline.text);
        }
        chunks.push('\n');
      }
      if (Array.isArray(b?.children)) walk(b.children);
    }
  };
  walk(content as any[]);
  return chunks.join(' ').replace(/\s+\n\s*/g, '\n').trim();
}
