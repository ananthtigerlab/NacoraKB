// NOTE: previously imported 'server-only' to hard-fail on accidental client import. Removed so
// tsx scripts (scripts/generate-diagrams.ts etc.) can load this file directly. This module is
// still server-only by convention — never import it from a "use client" component.

/*
  Provider-agnostic LLM call for tool-shaped JSON output.

  Callers describe the tool (name, description, JSON-schema parameters) and get back the parsed args
  object. The concrete provider (Anthropic Claude / Google Gemini) is chosen at runtime from env vars:

    LLM_PROVIDER = "anthropic" (default) | "gemini"

  This lets synthesis, discovery, and ingest all call `toolJSON(...)` without knowing which provider
  they're talking to.
*/

export type ToolJSONOptions = {
  model?: string;
  system?: string;
  user: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
  maxTokens?: number;
};

export type Provider = 'anthropic' | 'gemini';

export function activeProvider(): Provider {
  const p = (process.env.LLM_PROVIDER ?? '').toLowerCase();
  if (p === 'gemini') return 'gemini';
  return 'anthropic';
}

export function hasProviderKey(): boolean {
  return activeProvider() === 'gemini'
    ? !!process.env.GEMINI_API_KEY
    : !!process.env.ANTHROPIC_API_KEY;
}

export async function toolJSON<T>(opts: ToolJSONOptions): Promise<T> {
  const provider = activeProvider();
  if (provider === 'gemini') {
    const { toolJSONGemini } = await import('./gemini');
    return toolJSONGemini<T>(opts);
  }
  const { toolJSONAnthropic } = await import('./anthropic');
  return toolJSONAnthropic<T>(opts);
}

export type TextOutputOptions = {
  model?: string;
  system?: string;
  user: string;
  maxTokens?: number;
};

/**
 * Plain-text completion — no function calling, no JSON schema. Use for large free-form output
 * (multi-KB markdown, prose) where a structured JSON container would trip provider validators.
 */
export async function textOutput(opts: TextOutputOptions): Promise<string> {
  const provider = activeProvider();
  if (provider === 'gemini') {
    const { textOutputGemini } = await import('./gemini');
    return textOutputGemini(opts);
  }
  const { textOutputAnthropic } = await import('./anthropic');
  return textOutputAnthropic(opts);
}
