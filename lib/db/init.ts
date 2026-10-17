import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { nanoid } from 'nanoid';
import { getDb, getPg, resetPgCache, isCorruptDbError, schema } from './client';
import { migrate } from './migrate';

// Ensure the DB is migrated + seeded on first server request.
// The seed is fully idempotent (see seed-runner) so it runs on every boot to backfill any
// content/<space>/<slug>.md files added since last boot. Existing pages are left untouched.

let initPromise: Promise<void> | null = null;

async function runMigrateAndSeed() {
  await migrate();
  const db = getDb();
  const spaceCountBefore = (await db.select({ id: schema.spaces.id }).from(schema.spaces)).length;
  const { runSeed } = await import('./seed-runner');
  await runSeed(db);
  if (spaceCountBefore === 0) {
    await db.insert(schema.auditEvents).values({
      id: nanoid(),
      type: 'system.first_run',
      actor: 'system',
      payload: { note: 'Nacora KB initialised on first request' },
    });
  }
  await getPg().query('SELECT 1');
}

async function wipeAndReseed(reason: string) {
  console.warn(`[db] corrupt DB detected (${reason}) — wiping and re-seeding from disk`);
  resetPgCache();
  const dbDir = path.join(process.cwd(), 'data', 'db');
  const tmpPglite = '/tmp/pglite';
  try {
    if (fs.existsSync(dbDir)) fs.rmSync(dbDir, { recursive: true, force: true });
    if (fs.existsSync(tmpPglite)) fs.rmSync(tmpPglite, { recursive: true, force: true });
  } catch (e) {
    console.warn('[db] wipe failed:', (e as Error).message);
  }
  // Fresh directory, fresh PGlite instance
  fs.mkdirSync(dbDir, { recursive: true });
  await runMigrateAndSeed();
  console.log('[db] recovery complete — pages seeded from content/*.md; diagrams restored from content/diagrams/*');
}

async function doInit() {
  try {
    await runMigrateAndSeed();
  } catch (e) {
    if (!isCorruptDbError(e)) throw e;
    // DB is corrupt (WASM abort or relfilenode missing). Wipe and reseed. Diagrams come back
    // from the on-disk mirror at content/diagrams/, so the user only loses tags/versions
    // (not diagrams and not page content).
    await wipeAndReseed(e instanceof Error ? e.message : String(e));
  }
}

export function ensureDbReady(): Promise<void> {
  if (!initPromise) {
    initPromise = doInit().catch((e) => {
      // If init failed for any reason, clear the cached promise so the next request can retry
      // rather than being stuck with a rejected promise forever.
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}
