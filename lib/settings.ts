import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';

// Small key-value store on top of schema.settings. Feature flags live here (Phase 4 auto-merge).

const DEFAULTS = {
  auto_merge_enabled: false as boolean,
  auto_merge_scopes: [] as string[],   // e.g. ['delivery'] to auto-merge only Delivery-space proposals
  auto_merge_max_pages: 2 as number,   // safety limit per source
} as const;

type Settings = typeof DEFAULTS;

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const db = getDb();
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
  if (!row) return DEFAULTS[key];
  return row.value as Settings[K];
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  const db = getDb();
  const [existing] = await db.select().from(schema.settings).where(eq(schema.settings.key, key)).limit(1);
  if (existing) {
    await db.update(schema.settings).set({ value: value as any, updatedAt: new Date() }).where(eq(schema.settings.key, key));
  } else {
    await db.insert(schema.settings).values({ key, value: value as any });
  }
}
