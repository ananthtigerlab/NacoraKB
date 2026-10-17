import 'server-only';
import { nanoid } from 'nanoid';
import { getDb, schema } from '@/lib/db/client';
import { logAudit } from '@/lib/audit';

// PRD §12 — Google Docs / Slides. Full OAuth is Phase 3.b; for now we accept a "published to web"
// or link-shared URL (view access) and fetch the text export directly. This works for shared KT docs.

export async function pullGoogleDoc(url: string) {
  const docId = extractDocId(url);
  if (!docId) throw new Error('Could not extract Google Doc ID from URL');
  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const res = await fetch(exportUrl, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(
      `Google Doc fetch failed (${res.status}). The doc may be private — share it as "Anyone with the link can view" or wait for OAuth support.`,
    );
  }
  const text = await res.text();
  const label = `Google Doc — ${extractTitle(text) ?? docId}`;
  const db = getDb();
  const id = nanoid();
  await db.insert(schema.sources).values({
    id,
    type: 'doc',
    label,
    url,
    extractedText: text.slice(0, 200_000),
    metadata: { docId },
  });
  await logAudit({ type: 'connector.google_doc_pull', actor: 'sync', payload: { docId, length: text.length } });
  return { id };
}

function extractDocId(url: string): string | null {
  const m = url.match(/\/d\/([a-zA-Z0-9-_]{20,})/);
  return m ? m[1] : null;
}
function extractTitle(text: string): string | null {
  const first = text.split('\n').find((l) => l.trim().length > 0);
  return first?.slice(0, 100) ?? null;
}
