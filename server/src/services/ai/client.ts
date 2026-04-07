import { pool } from '../../db/pool';
import { decrypt } from '../encryption';

export type AiProvider = 'anthropic' | 'openai' | 'openrouter' | 'local';

export interface AiSettings {
  enabled: boolean;
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const PROVIDER_DEFAULTS: Record<AiProvider, { baseUrl: string; model: string }> = {
  anthropic:  { baseUrl: 'https://api.anthropic.com',      model: 'claude-haiku-4-5-20251001' },
  openai:     { baseUrl: 'https://api.openai.com/v1',      model: 'gpt-4o-mini' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1',   model: 'openai/gpt-4o-mini' },
  local:      { baseUrl: 'http://localhost:11434/v1',       model: 'llama3' },
};

/** Load and decrypt AI settings for a user. Returns null if not configured or disabled. */
export async function getAiSettings(userId: string): Promise<AiSettings | null> {
  const result = await pool.query(
    `SELECT enabled, provider, base_url, api_key, model
     FROM user_ai_settings WHERE user_id = $1`,
    [userId]
  );
  if (result.rows.length === 0 || !result.rows[0].enabled) return null;

  const row      = result.rows[0];
  const provider = row.provider as AiProvider;
  const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.openai;

  let apiKey = '';
  try {
    apiKey = row.api_key ? decrypt(row.api_key) : '';
  } catch {
    return null; // decryption failure — treat as disabled
  }

  return {
    enabled:  true,
    provider,
    baseUrl:  row.base_url || defaults.baseUrl,
    apiKey,
    model:    row.model || defaults.model,
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Send a chat request to the configured AI provider. Returns the assistant's text reply. */
export async function callAi(
  settings: AiSettings,
  messages: ChatMessage[],
  maxTokens = 2048
): Promise<string> {
  if (settings.provider === 'anthropic') {
    return callAnthropic(settings, messages, maxTokens);
  }
  return callOpenAiCompat(settings, messages, maxTokens);
}

// ── Anthropic messages API ─────────────────────────────────────────────────

async function callAnthropic(
  settings: AiSettings,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const systemMsg  = messages.find((m) => m.role === 'system');
  const userMsgs   = messages.filter((m) => m.role !== 'system');

  const response = await fetch(`${settings.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type':      'application/json',
      'x-api-key':         settings.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      settings.model,
      max_tokens: maxTokens,
      ...(systemMsg ? { system: systemMsg.content } : {}),
      messages: userMsgs.map((m) => ({ role: m.role, content: m.content })),
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Anthropic API ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    content: Array<{ type: string; text: string }>;
  };
  return data.content?.[0]?.text ?? '';
}

// ── OpenAI-compatible API (OpenAI, OpenRouter, Ollama, LM Studio, …) ───────

async function callOpenAiCompat(
  settings: AiSettings,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const base = settings.baseUrl.replace(/\/+$/, '');
  const url  = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'authorization': `Bearer ${settings.apiKey}`,
  };

  // OpenRouter requires site identification headers
  if (settings.provider === 'openrouter') {
    headers['http-referer'] = 'https://finance-tracker.local';
    headers['x-title']      = 'Personal Finance Tracker';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model:      settings.model,
      max_tokens: maxTokens,
      messages:   messages.map((m) => ({ role: m.role, content: m.content })),
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`AI API ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? '';
}
