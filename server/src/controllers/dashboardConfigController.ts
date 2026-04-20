import { Request, Response, NextFunction } from 'express';
import { saveDashboardConfigSchema } from '../schemas/dashboardConfig';
import { DashboardConfigModel } from '../models/dashboardConfigModel';

export class DashboardConfigController {
  // GET /api/settings/dashboard
  static async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const widgets = await DashboardConfigModel.findByUserId(userId);
      res.json({ data: { widgets: widgets ?? DashboardConfigModel.getDefaultWidgets() } });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/settings/dashboard
  static async saveConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { widgets } = saveDashboardConfigSchema.parse(req.body);
      await DashboardConfigModel.save(userId, widgets);
      res.json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/settings/dashboard  (reset to defaults)
  static async resetConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      await DashboardConfigModel.delete(userId);
      res.json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  }
}
