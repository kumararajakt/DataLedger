import { Request, Response, NextFunction } from 'express';
import { saveAiSettingsSchema } from '../schemas/aiSettings';
import { AiSettingsModel } from '../models/aiSettingsModel';
import { getAiSettings, callAi } from '../services/ai/client';

export class AiSettingsController {
  // GET /api/settings/ai
  static async getSettings(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const settings = await AiSettingsModel.getSettingsResponse(userId);

      res.json({ data: settings });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/settings/ai
  static async saveSettings(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const data = saveAiSettingsSchema.parse(req.body);

      await AiSettingsModel.save(userId, data);

      res.json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/settings/ai
  static async deleteSettings(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      await AiSettingsModel.delete(userId);

      res.json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/settings/ai/test
  static async testSettings(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const settings = await getAiSettings(userId);
      if (!settings) {
        res
          .status(400)
          .json({
            error:
              'AI is not configured or is disabled. Save your settings first.',
          });
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
            ok: true,
            reply: reply.trim().substring(0, 100),
            latencyMs: Date.now() - start,
          },
        });
      } catch (err) {
        res.json({
          data: {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            latencyMs: Date.now() - start,
          },
        });
      }
    } catch (err) {
      next(err);
    }
  }
}
