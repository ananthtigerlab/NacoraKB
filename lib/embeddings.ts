import 'server-only';

/*
  PRD §11 Phase 4 — semantic search via pgvector.

  PGlite does not yet ship pgvector by default; enabling it requires the pglite-vector plugin
  (still experimental at the time of writing). This module is the seam: if/when the extension is
  available, uncomment the CREATE EXTENSION line and swap the search-bar to call `semanticSearch`.

  For now the fallback is Postgres FTS (see lib/db/migrate.ts). This file exists so the pipeline
  wiring is in place; Phase 4 flips a single import when pgvector lands.
*/

export async function ensureVectorExtension(): Promise<{ enabled: boolean; reason?: string }> {
  return { enabled: false, reason: 'pgvector not available in current PGlite build' };
}

export async function embed(_text: string): Promise<number[] | null> {
  // Placeholder: Anthropic doesn't ship an embeddings endpoint; when Phase 4 is enabled we
  // wire this to whichever embedding provider the BA picks (Voyage, OpenAI, or a local model).
  return null;
}

export async function semanticSearch(_query: string, _limit = 10): Promise<Array<{ pageId: string; score: number }>> {
  return [];
}
