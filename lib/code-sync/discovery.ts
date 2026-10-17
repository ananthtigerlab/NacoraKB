import 'server-only';
import { fileAtRef } from './git';
import { toolJSON } from '@/lib/llm';

/*
  PRD §5.3 routing step, done at repo-wide scale for the first sync.

  Given the full Nacora file catalog + a handful of entry-point files (URL routers, settings,
  middleware, models, frontend route trees), ask Claude to trace the system as a user would —
  from login to logout — enumerate the business concepts a BA needs to know, then reconcile
  those concepts against the existing candidate pages.

  Output plan:
    - pages_to_populate — existing candidate pages that should be synthesised, with hint files.
    - new_pages        — concepts that don't fit any candidate page and warrant a new page under "The Product".

  The BA still approves everything. New-page proposals create the page (with a placeholder)
  AND emit a Proposal to populate it. If the BA rejects the proposal, they can just delete the page.
*/

// Files that describe the SHAPE of the system rather than one detail of it.
// Ordered roughly from most-informative to least — depth is used as the secondary sort.
const ENTRY_POINT_PATTERNS: RegExp[] = [
  /(?:^|\/)settings\.py$/,
  /(?:^|\/)urls\.py$/,
  /(?:^|\/)middleware\.py$/,
  /(?:^|\/)apps\.py$/,
  /(?:^|\/)models\.py$/,
  /(?:^|\/)views\.py$/,
  /(?:^|\/)admin\.py$/,
  /(?:^|\/)signals\.py$/,
  /(?:^|\/)tasks\.py$/,
  /(?:^|\/)serializers\.py$/,
  /(?:^|\/)permissions\.py$/,
  /(?:^|\/)choices\.py$/,
  /(?:^|\/)constants\.py$/,
  /(?:^|\/)app\.routes\.ts$/,
  /(?:^|\/)app\.module\.ts$/,
  /(?:^|\/)app-routing\.module\.ts$/,
  /(?:^|\/)routes\.tsx?$/,
];

const MAX_ENTRY_FILES = 18;
const ENTRY_FILE_CHARS = 4000;
const MAX_CATALOG_LINES = 800;

const DISCOVERY_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    pages_to_populate: {
      type: 'array',
      description:
        'Existing candidate pages that map to a concept you found. Only include pages you can meaningfully write from the code you have.',
      items: {
        type: 'object',
        properties: {
          page_slug: { type: 'string', description: 'Slug from the provided existing-pages list. Must match verbatim.' },
          concept_summary: { type: 'string', description: 'One or two sentences: what this page will describe.' },
          key_files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Up to 6 verbatim file paths from the catalog that best inform this page.',
          },
        },
        required: ['page_slug', 'concept_summary', 'key_files'],
      },
    },
    new_pages: {
      type: 'array',
      description:
        'Significant business concepts the codebase reveals that DO NOT fit any existing candidate page and warrant a new page under "The Product". Cap: 8. Quality over quantity — only propose a new page when the concept is genuinely distinct and load-bearing for a BA.',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'BA-friendly title, 1–4 words, Title Case.' },
          slug: { type: 'string', description: 'kebab-case slug, no spaces.' },
          concept_summary: { type: 'string', description: 'One or two sentences: what this new page will describe.' },
          reason: { type: 'string', description: 'Why this deserves its own page rather than folding into an existing one.' },
          key_files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Up to 6 verbatim file paths from the catalog.',
          },
        },
        required: ['title', 'slug', 'concept_summary', 'reason', 'key_files'],
      },
    },
    high_level_map: {
      type: 'string',
      description:
        'A short paragraph (max 6 sentences) describing the end-to-end user journey you traced — from login to logout — that grounded your concept list. Written for a BA. This will be shown as the rationale on the sync record.',
    },
  },
  required: ['pages_to_populate', 'new_pages', 'high_level_map'],
};

export type DiscoveryPlan = {
  pages_to_populate: Array<{ page_slug: string; concept_summary: string; key_files: string[] }>;
  new_pages: Array<{
    title: string;
    slug: string;
    concept_summary: string;
    reason: string;
    key_files: string[];
  }>;
  high_level_map: string;
};

const DISCOVERY_SYSTEM = `You are exploring the Nacora MGA Embedded Cargo codebase to build a Business Analyst knowledge base.

Nacora is Kuehne+Nagel's marine/cargo insurance broker; they act as an MGA on the TigerLab platform. Their product covers embedded cargo insurance (quotes issued at the point of shipment via a shipment portal), plus back-office policy administration.

Your job right now:

  1. TRACE the system as an end-user would experience it — from LOGIN to LOGOUT. Use the entry-point file excerpts (URL routers, settings, middleware, models, frontend route trees) and the full file catalog. You do not need to read every file — extrapolate from the paths and the entry points.

  2. Identify all major BUSINESS CONCEPTS a BA joining the delivery would need to understand. Coverage checklist:
       - Login & user types (who logs in where — back-office vs shipment portal; SSO/OTP if present)
       - Business Partner model (policyholder types, broker company, participant company, insurance company, underwriters)
       - Data entities the system revolves around (Policy, Shipment, Quote, Clause, Rating, Commodity, Certificate, etc.)
       - User journeys end-to-end (New Business policy creation, Quote & Book, MTA/adjustments, Cancellation, Renewal, Referral loops)
       - Calculations (premium calculation, rating lookups, currency conversion, special-rate application)
       - Business rules (referral triggers, decline reasons, choice-driven filtering, sanctions screening)
       - Integrations (currency, Google Maps, vessel data, sanctions)
       - Configuration/admin concepts (choices, clause library, document templates, base rater versioning, commodity classification, insuring conditions, numbering)
       - Cross-cutting behaviours (audit trail, permissions, notifications, bulk upload)
       - Any Nacora-specific behaviours (embedded flow, shipment-portal participants, cargo-sanctions screening)

  3. RECONCILE against the existing candidate pages. For each concept:
       - If it fits an existing candidate cleanly → pages_to_populate with that slug.
       - If it's a distinct significant concept with no candidate → new_pages with a BA-friendly title.

RULES:
  - Prefer merging into an existing page when the fit is reasonable. New pages should be genuinely orthogonal concepts.
  - Cap new_pages at 8. Do NOT propose new pages for small implementation details.
  - key_files must be VERBATIM paths from the catalog — the caller will match them exactly.
  - page_slug in pages_to_populate must be VERBATIM from the existing-pages list.
  - Slugs for new pages are kebab-case, 2–4 words.
  - The high_level_map field is 3–6 sentences describing the login→logout journey — think of it as the sentence a BA would use to explain what happens on the platform.`;

export async function discoverConcepts(
  headRef: string,
  existingPages: Array<{ slug: string; title: string }>,
  fileCatalog: string[],
): Promise<{ plan: DiscoveryPlan; entryPaths: string[] }> {
  const entryPaths = pickEntryPoints(fileCatalog);
  const entryFiles: Array<{ path: string; excerpt: string }> = [];
  for (const p of entryPaths) {
    const c = await fileAtRef(p, headRef);
    if (c) entryFiles.push({ path: p, excerpt: c.slice(0, ENTRY_FILE_CHARS) });
  }

  const catalogTop = fileCatalog.slice(0, MAX_CATALOG_LINES).join('\n');

  const plan = await toolJSON<DiscoveryPlan>({
    system: DISCOVERY_SYSTEM,
    user: `EXISTING CANDIDATE PAGES (under "The Product"):
${existingPages.map((p) => `  ${p.slug}: ${p.title}`).join('\n')}

FILE CATALOG (${fileCatalog.length} total, first ${Math.min(MAX_CATALOG_LINES, fileCatalog.length)} shown; primary Nacora paths first, shared platform paths second):
${catalogTop}

ENTRY-POINT FILE EXCERPTS (${entryFiles.length} files):
${entryFiles.map((f) => `\n--- ${f.path} ---\n${f.excerpt}`).join('\n')}
`,
    toolName: 'record_discovery',
    toolDescription: 'Return the discovery plan: which existing pages to populate and which new pages to create.',
    inputSchema: DISCOVERY_TOOL_SCHEMA,
    maxTokens: 12_000,
  });

  return { plan, entryPaths };
}

function pickEntryPoints(files: string[]): string[] {
  const matches = files
    .filter((p) => ENTRY_POINT_PATTERNS.some((re) => re.test(p)))
    // Prefer shorter paths (top-level entry points beat deep-nested ones).
    .map((p) => ({ path: p, depth: p.split('/').length }))
    .sort((a, b) => a.depth - b.depth);
  const chosen: string[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    if (chosen.length >= MAX_ENTRY_FILES) break;
    if (seen.has(m.path)) continue;
    seen.add(m.path);
    chosen.push(m.path);
  }
  return chosen;
}
