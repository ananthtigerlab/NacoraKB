import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { ensureDbReady } from '@/lib/db/init';
import { getDb, schema } from '@/lib/db/client';
import { logAudit } from '@/lib/audit';

const DecisionSchema = z.object({
  decision: z.enum(['approved', 'edited', 'rejected']),
  editedContent: z.array(z.record(z.unknown())).nullable().optional(),
});

// PRD §5.5 — the only path that writes model-generated content onto a page in v1.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureDbReady();
  const { id } = await params;
  const db = getDb();
  const body = DecisionSchema.parse(await req.json());

  const [proposal] = await db.select().from(schema.proposals).where(eq(schema.proposals.id, id)).limit(1);
  if (!proposal) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (proposal.status !== 'pending') return NextResponse.json({ error: 'not_pending' }, { status: 409 });

  const [pageRow] = await db.select().from(schema.pages).where(eq(schema.pages.id, proposal.targetPageId)).limit(1);
  if (!pageRow) return NextResponse.json({ error: 'page_missing' }, { status: 404 });

  const decisionId = nanoid();
  await db.insert(schema.proposalDecisions).values({
    id: decisionId,
    proposalId: proposal.id,
    decision: body.decision,
    editedContent: body.decision === 'edited' ? (body.editedContent as any) : null,
  });
  await db.update(schema.proposals).set({ status: body.decision }).where(eq(schema.proposals.id, proposal.id));

  let versionId: string | null = null;
  if (body.decision === 'approved' || body.decision === 'edited') {
    const preVersionId = nanoid();
    await db.insert(schema.pageVersions).values({
      id: preVersionId,
      pageId: pageRow.id,
      title: pageRow.title,
      content: pageRow.content as any,
      createdBy: 'user',
    });

    const newContent = body.decision === 'edited' ? body.editedContent! : (proposal.proposedContent as any);
    const oldSourceIds = new Set((pageRow.sourceIds as string[]) ?? []);
    if (proposal.ingestionId) {
      const [ingestion] = await db
        .select()
        .from(schema.ingestions)
        .where(eq(schema.ingestions.id, proposal.ingestionId))
        .limit(1);
      if (ingestion) oldSourceIds.add(ingestion.sourceId);
    }
    await db
      .update(schema.pages)
      .set({ content: newContent, sourceIds: Array.from(oldSourceIds), updatedAt: new Date() })
      .where(eq(schema.pages.id, pageRow.id));

    versionId = nanoid();
    await db.insert(schema.pageVersions).values({
      id: versionId,
      pageId: pageRow.id,
      title: pageRow.title,
      content: newContent,
      createdBy: 'model',
    });

    await logAudit({
      type: 'merge',
      actor: 'user',
      payload: { decision: body.decision, decisionId, versionId },
      relatedIds: { pageId: pageRow.id, proposalId: proposal.id, versionId },
    });
  }

  await logAudit({
    type: 'proposal_decided',
    actor: 'user',
    payload: { decision: body.decision, decisionId, versionId },
    relatedIds: { proposalId: proposal.id, pageId: pageRow.id },
  });

  return NextResponse.json({ ok: true, versionId, decisionId });
}
