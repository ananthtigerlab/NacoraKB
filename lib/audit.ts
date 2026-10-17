import 'server-only';
import { nanoid } from 'nanoid';
import { getDb, schema } from './db/client';

// Append-only. NEVER edit or delete rows in audit_event (PRD §8).

export type AuditActor = 'user' | 'model' | 'sync' | 'system';

export type AuditEventInput = {
  type: string;
  actor: AuditActor;
  payload?: Record<string, unknown>;
  relatedIds?: Record<string, string | string[]>;
};

export async function logAudit(event: AuditEventInput): Promise<string> {
  const db = getDb();
  const id = nanoid();
  await db.insert(schema.auditEvents).values({
    id,
    type: event.type,
    actor: event.actor,
    payload: event.payload ?? {},
    relatedIds: event.relatedIds ?? {},
  });
  return id;
}
