import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { TextOutputOptions, ToolJSONOptions } from './index';

export const DEFAULT_ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing — add it to .env or set LLM_PROVIDER=gemini');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export async function toolJSONAnthropic<T>(opts: ToolJSONOptions): Promise<T> {
  const client = getAnthropic();
  const res = await client.messages.create({
    model: opts.model ?? DEFAULT_ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
    tools: [
      {
        name: opts.toolName,
        description: opts.toolDescription,
        input_schema: opts.inputSchema as any,
      },
    ],
    tool_choice: { type: 'tool', name: opts.toolName },
  });
  const block = res.content.find((c) => c.type === 'tool_use');
  if (!block || block.type !== 'tool_use') throw new Error('Anthropic: model did not return a tool_use block');
  return block.input as T;
}

export async function textOutputAnthropic(opts: TextOutputOptions): Promise<string> {
  const client = getAnthropic();
  const res = await client.messages.create({
    model: opts.model ?? DEFAULT_ANTHROPIC_MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
  });
  const text = res.content.find((c) => c.type === 'text');
  if (!text || text.type !== 'text') throw new Error('Anthropic returned no text block');
  return text.text;
}
