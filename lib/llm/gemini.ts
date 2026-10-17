import 'server-only';
import type { TextOutputOptions, ToolJSONOptions } from './index';

/*
  Gemini function-calling backend.

  Free-tier keys are available at https://aistudio.google.com/apikey (Vertex AI is a separate paid
  offering — the free API-key path is what we support here).

  Env vars:
    GEMINI_API_KEY   — required
    GEMINI_MODEL     — optional; default 'gemini-2.5-flash'. Use 'gemini-2.5-pro' for the big
                       discovery pass if you want higher quality (slower + fewer free requests/min).

  We call the REST API directly to avoid adding another SDK. Function-calling schemas are OpenAPI
  subset — a few JSON-Schema keys (additionalProperties, $schema) must be stripped or Gemini rejects
  the request.
*/

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';

export async function toolJSONGemini<T>(opts: ToolJSONOptions): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing — add it to .env (get one at https://aistudio.google.com/apikey)');
  const model = opts.model ?? DEFAULT_MODEL;
  const baseTokens = opts.maxTokens ?? 4096;

  // MALFORMED_FUNCTION_CALL usually means the response hit maxTokens mid-JSON. Retry once with
  // a much larger budget before giving up.
  let attempt = 0;
  let lastErr: Error | null = null;
  while (attempt < 2) {
    const tokens = attempt === 0 ? baseTokens : Math.min(baseTokens * 3, 32_000);
    try {
      return await callOnce<T>(apiKey, model, opts, tokens);
    } catch (err) {
      lastErr = err as Error;
      if (!/MALFORMED_FUNCTION_CALL|MAX_TOKENS|did not return a functionCall/i.test(lastErr.message)) {
        throw lastErr;
      }
      attempt += 1;
    }
  }
  throw lastErr ?? new Error('Gemini call failed');
}

async function callOnce<T>(apiKey: string, model: string, opts: ToolJSONOptions, maxTokens: number): Promise<T> {
  const parameters = sanitiseSchemaForGemini(opts.inputSchema);

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: opts.user }] }],
    tools: [
      {
        functionDeclarations: [
          {
            name: opts.toolName,
            description: opts.toolDescription,
            parameters,
          },
        ],
      },
    ],
    toolConfig: {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: [opts.toolName],
      },
    },
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.2,
    },
  };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }

  const res = await fetch(`${API_ROOT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = (await res.json()) as any;
  const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
  const call = parts.find((p) => p.functionCall)?.functionCall;
  if (!call || typeof call !== 'object') {
    const finishReason = data?.candidates?.[0]?.finishReason;
    const safety = data?.candidates?.[0]?.safetyRatings;
    throw new Error(
      `Gemini did not return a functionCall (finishReason=${finishReason}, safety=${JSON.stringify(safety ?? []).slice(0, 200)})`,
    );
  }
  return (call.args ?? {}) as T;
}

export async function textOutputGemini(opts: TextOutputOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing — add it to .env (get one at https://aistudio.google.com/apikey)');
  const model = opts.model ?? DEFAULT_MODEL;

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: opts.user }] }],
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 4096,
      temperature: 0.2,
    },
  };
  if (opts.system) {
    body.systemInstruction = { parts: [{ text: opts.system }] };
  }

  const res = await fetch(`${API_ROOT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 500)}`);
  }
  const data = (await res.json()) as any;
  const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('').trim();
  if (!text) {
    const finishReason = data?.candidates?.[0]?.finishReason;
    const safety = data?.candidates?.[0]?.safetyRatings;
    throw new Error(
      `Gemini returned no text (finishReason=${finishReason}, safety=${JSON.stringify(safety ?? []).slice(0, 200)})`,
    );
  }
  return text;
}

/**
 * Gemini's function-calling schema is an OpenAPI subset. Strip fields it doesn't accept.
 * Notably: `additionalProperties`, `$schema`. Also normalises `type: 'object'` with no
 * properties (used for BlockNote block payloads) to keep Gemini's validator happy.
 */
function sanitiseSchemaForGemini(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(sanitiseSchemaForGemini);
  if (schema && typeof schema === 'object') {
    const source = schema as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(source)) {
      if (key === 'additionalProperties') continue;
      if (key === '$schema' || key === '$id' || key === '$ref') continue;
      out[key] = sanitiseSchemaForGemini(value);
    }
    return out;
  }
  return schema;
}
