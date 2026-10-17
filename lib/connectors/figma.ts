import 'server-only';
import { nanoid } from 'nanoid';
import { getDb, schema } from '@/lib/db/client';
import { logAudit } from '@/lib/audit';

// PRD §12 — Nacora Figma board. Auth: FIGMA_PERSONAL_ACCESS_TOKEN.
// Uses the Figma REST API (/v1/files/:key). Extracts frame + node names as plain text so the
// synthesiser can route them to the right pages.

export async function pullFigma(fileKey: string) {
  const token = process.env.FIGMA_PERSONAL_ACCESS_TOKEN;
  if (!token) throw new Error('FIGMA_PERSONAL_ACCESS_TOKEN not set in .env');

  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
    headers: { 'X-Figma-Token': token },
  });
  if (!res.ok) throw new Error(`Figma ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as any;

  const names: string[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (node.name) names.push(`${node.type ?? '?'}: ${node.name}`);
    for (const c of node.children ?? []) walk(c);
  };
  walk(data.document);

  const label = `Figma — ${data.name}`;
  const url = `https://www.figma.com/file/${fileKey}`;
  const db = getDb();
  const id = nanoid();
  await db.insert(schema.sources).values({
    id,
    type: 'figma',
    label,
    url,
    extractedText: names.join('\n'),
    metadata: { fileKey, lastModified: data.lastModified },
  });
  await logAudit({ type: 'connector.figma_pull', actor: 'sync', payload: { fileKey, nodes: names.length } });
  return { id, nodes: names.length };
}
