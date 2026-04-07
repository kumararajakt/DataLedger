import { query } from '../db/pool';
import { encrypt, decrypt, maskKey } from '../services/encryption';

export interface AiSettings {
  userId: string;
  enabled: boolean;
  provider: 'anthropic' | 'openai' | 'openrouter' | 'local';
  baseUrl: string;
  apiKey?: string;
  model: string;
  updatedAt: Date;
}

export interface AiSettingsResponse {
  enabled: boolean;
  provider: 'anthropic' | 'openai' | 'openrouter' | 'local';
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  maskedApiKey: string;
}

export interface SaveAiSettingsInput {
  enabled: boolean;
  provider: 'anthropic' | 'openai' | 'openrouter' | 'local';
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export class AiSettingsModel {
  static async findByUserId(userId: string): Promise<AiSettings | null> {
    const result = await query(
      `SELECT user_id, enabled, provider, base_url, api_key, model, updated_at
       FROM user_ai_settings WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      userId: row.user_id,
      enabled: row.enabled,
      provider: row.provider,
      baseUrl: row.base_url ?? '',
      apiKey: row.api_key ? decrypt(row.api_key) : undefined,
      model: row.model ?? '',
      updatedAt: row.updated_at,
    };
  }

  static async getSettingsResponse(
    userId: string
  ): Promise<AiSettingsResponse | null> {
    const settings = await this.findByUserId(userId);
    if (!settings) return null;

    return {
      enabled: settings.enabled,
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      model: settings.model,
      hasApiKey: !!settings.apiKey,
      maskedApiKey: settings.apiKey ? maskKey(settings.apiKey) : '',
    };
  }

  static async save(
    userId: string,
    data: SaveAiSettingsInput
  ): Promise<void> {
    const defaults = this.getProviderDefaults(data.provider);
    const baseUrl = data.baseUrl || defaults.baseUrl;
    const model = data.model || defaults.model;

    if (data.apiKey === undefined) {
      // Don't touch the existing key column
      await query(
        `INSERT INTO user_ai_settings (user_id, enabled, provider, base_url, model, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           enabled    = EXCLUDED.enabled,
           provider   = EXCLUDED.provider,
           base_url   = EXCLUDED.base_url,
           model      = EXCLUDED.model,
           updated_at = NOW()`,
        [userId, data.enabled, data.provider, baseUrl, model]
      );
    } else {
      // '' → NULL (clear), otherwise encrypt the new key
      const encryptedKey = data.apiKey === '' ? null : encrypt(data.apiKey);
      await query(
        `INSERT INTO user_ai_settings (user_id, enabled, provider, base_url, api_key, model, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           enabled    = EXCLUDED.enabled,
           provider   = EXCLUDED.provider,
           base_url   = EXCLUDED.base_url,
           api_key    = EXCLUDED.api_key,
           model      = EXCLUDED.model,
           updated_at = NOW()`,
        [userId, data.enabled, data.provider, baseUrl, encryptedKey, model]
      );
    }
  }

  static async delete(userId: string): Promise<void> {
    await query(`DELETE FROM user_ai_settings WHERE user_id = $1`, [userId]);
  }

  private static getProviderDefaults(
    provider: 'anthropic' | 'openai' | 'openrouter' | 'local'
  ): { baseUrl: string; model: string } {
    const defaults: Record<string, { baseUrl: string; model: string }> = {
      anthropic: {
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-3-sonnet-20240229',
      },
      openai: {
        baseUrl: 'https://api.openai.com',
        model: 'gpt-3.5-turbo',
      },
      openrouter: {
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'anthropic/claude-3-sonnet',
      },
      local: {
        baseUrl: 'http://localhost:11434/v1',
        model: 'llama3',
      },
    };

    return defaults[provider] ?? defaults.openai;
  }
}
