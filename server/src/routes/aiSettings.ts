import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { encrypt, decrypt, maskKey } from '../services/encryption';
import { getAiSettings, callAi, PROVIDER_DEFAULTS, type AiProvider } from '../services/ai/client';

const router: Router = Router();
router.use(authMiddleware);

const saveSchema = z.object({
  enabled:  z.boolean(),
  provider: z.enum(['anthropic', 'openai', 'openrouter', 'local']),
  baseUrl:  z.string().optional().default(''),
  apiKey:   z.string().optional(),   // undefined → keep existing; '' → clear; string → new key
  model:    z.string().optional().default(''),
});

// ── GET /api/settings/ai ───────────────────────────────────────────────────

router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await pool.query(
        `SELECT enabled, provider, base_url, api_key, model
         FROM user_ai_settings WHERE user_id = $1`,
        [req.user.userId]
      );

      if (result.rows.length === 0) {
        res.json({ data: null });
        return;
      }

      const row = result.rows[0];
      let maskedApiKey = '';
      if (row.api_key) {
        try {
          maskedApiKey = maskKey(decrypt(row.api_key));
        } catch {
          maskedApiKey = '••••••••';
        }
      }

      res.json({
        data: {
          enabled:     row.enabled,
          provider:    row.provider as AiProvider,
          baseUrl:     row.base_url ?? '',
          model:       row.model ?? '',
          hasApiKey:   !!row.api_key,
          maskedApiKey,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/settings/ai ──────────────────────────────────────────────────

router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.userId;
      const data   = saveSchema.parse(req.body);

      const defaults = PROVIDER_DEFAULTS[data.provider as AiProvider] ?? PROVIDER_DEFAULTS.openai;
      const baseUrl  = data.baseUrl  || defaults.baseUrl;
      const model    = data.model    || defaults.model;

      // Determine what to do with the API key
      if (data.apiKey === undefined) {
        // Don't touch the existing key column
        await pool.query(
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
        await pool.query(
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

      res.json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  }
);

// ── DELETE /api/settings/ai ────────────────────────────────────────────────

router.delete(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await pool.query(`DELETE FROM user_ai_settings WHERE user_id = $1`, [req.user.userId]);
      res.json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/settings/ai/test ─────────────────────────────────────────────

router.post(
  '/test',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings = await getAiSettings(req.user.userId);
      if (!settings) {
        res.status(400).json({ error: 'AI is not configured or is disabled. Save your settings first.' });
        return;
      }

      const start = Date.now();
      try {
        const reply = await callAi(
          settings,
          [{ role: 'user', content: 'Reply with just the word OK.' }],
          10
        );
        res.json({
          data: {
            ok:        true,
            reply:     reply.trim().substring(0, 100),
            latencyMs: Date.now() - start,
          },
        });
      } catch (err) {
        res.json({
          data: {
            ok:        false,
            error:     err instanceof Error ? err.message : String(err),
            latencyMs: Date.now() - start,
          },
        });
      }
    } catch (err) {
      next(err);
    }
  }
);

export default router;
