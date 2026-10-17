import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema';

// Single, process-wide PGlite instance. Data persists to disk under ./data/db.
// PGlite is Postgres compiled to WASM — runs in the Node process, no external service.

const DB_DIR = path.join(process.cwd(), 'data', 'db');

// Cache on globalThis, not module scope. Next.js dev mode (Turbopack HMR) re-evaluates modules
// on file change; a module-scope singleton becomes two racing PGlite instances writing to the
// same data-dir, which tears the WAL and gives us the "RuntimeError: Aborted()" abort loop
// that kept eating our diagrams. `globalThis` survives HMR — the same PGlite is reused.
type CacheShape = {
  pg?: PGlite;
  db?: ReturnType<typeof drizzle<typeof schema>>;
};
const cacheKey = '__nacora_pglite_cache__';
const cache: CacheShape = ((globalThis as any)[cacheKey] ??= {});

function ensureDir() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
}

/**
 * PGlite doesn't clean up `postmaster.pid` on exit (the emscripten runtime can't run atexit
 * handlers reliably). If a previous process left one behind, PGlite refuses to boot with
 * `RuntimeError: Aborted()`. Since Nacora KB is single-writer by design, any postmaster.pid
 * we find at startup is guaranteed stale — safe to remove.
 */
function clearStalePostmasterPid() {
  const pidFile = path.join(DB_DIR, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    try {
      fs.unlinkSync(pidFile);
      console.log('[db] cleared stale postmaster.pid');
    } catch (e) {
      console.warn('[db] could not clear stale postmaster.pid:', (e as Error).message);
    }
  }
}

let shutdownHooksInstalled = false;
function installShutdownHooks() {
  if (shutdownHooksInstalled) return;
  shutdownHooksInstalled = true;
  const shutdown = async (signal: string) => {
    try {
      if (cache.pg) {
        await cache.pg.close();
        const pidFile = path.join(DB_DIR, 'postmaster.pid');
        if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
      }
    } catch {
      /* best effort */
    }
    console.log(`[db] shut down cleanly on ${signal}`);
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

export function getPg(): PGlite {
  if (!cache.pg) {
    ensureDir();
    clearStalePostmasterPid();
    cache.pg = new PGlite(DB_DIR);
    installShutdownHooks();
  }
  return cache.pg;
}

export function getDb() {
  if (!cache.db) {
    cache.db = drizzle(getPg(), { schema });
  }
  return cache.db;
}

/**
 * Reset the process-local PGlite cache. Called by the auto-recovery path when we detect a
 * corrupt DB (WASM `Aborted()` on `pg.exec`). Does NOT touch disk — callers can wipe data/db
 * before or after calling this, and the next getPg() will re-open with a fresh WASM instance.
 */
export function resetPgCache() {
  cache.pg = undefined;
  cache.db = undefined;
}

/** True if the error looks like a PGlite WASM abort (unrecoverable at the runtime level). */
export function isWasmAbort(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /RuntimeError:\s*Aborted\(\)/.test(msg) || /Build with -sASSERTIONS/.test(msg);
}

/**
 * True if the error indicates the on-disk DB is corrupt in a way that only wipe-and-reseed
 * can fix. Two classes seen in the wild:
 *   1. WASM abort (`Aborted()`) — the runtime can't continue at all.
 *   2. Postgres `58P01` "could not open file base/…" — catalog references a relfilenode
 *      that no longer exists on disk (torn WAL / SIGKILL / interrupted write).
 * Both are irrecoverable in place. Recovery is identical: wipe data/db, reseed from
 * content/*.md + content/diagrams/.
 */
export function isCorruptDbError(err: unknown): boolean {
  if (isWasmAbort(err)) return true;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : '';
  const code = err instanceof Error && 'cause' in err && err.cause && typeof err.cause === 'object'
    ? (err.cause as { code?: string }).code
    : undefined;
  if (code === '58P01') return true;
  return /could not open file "base\//.test(msg) || /could not open file "base\//.test(cause);
}

export type Db = ReturnType<typeof getDb>;
export { schema };
