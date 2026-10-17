import { desc, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { ProposalsList } from '@/components/proposals-list';

export default async function ProposalsPage() {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.proposals)
    .orderBy(desc(schema.proposals.createdAt))
    .limit(100);

  const pageIds = Array.from(new Set(rows.map((r) => r.targetPageId)));
  const pageRows = pageIds.length
    ? await db.select().from(schema.pages).where(inArray(schema.pages.id, pageIds))
    : [];
  const pagesById = new Map(pageRows.map((p) => [p.id, p]));

  const items = rows.map((r) => {
    const p = pagesById.get(r.targetPageId);
    return {
      id: r.id,
      status: r.status,
      rationale: r.modelRationale,
      createdAt: r.createdAt as unknown as string,
      pageId: r.targetPageId,
      pageTitle: p?.title ?? '(deleted page)',
      currentContent: p?.content ?? [],
      proposedContent: r.proposedContent,
    };
  });

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Proposals</h1>
      <p className="mb-6 text-sm text-text-muted">
        Everything Claude has drafted from your uploads and code sync. Approve, edit, or reject — nothing hits a page until you say so.
      </p>
      <ProposalsList items={items} />
    </div>
  );
}
