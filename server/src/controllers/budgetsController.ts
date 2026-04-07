import { Request, Response, NextFunction } from 'express';
import { createBudgetSchema, updateBudgetSchema } from '../schemas/budget';
import { BudgetModel } from '../models/budgetModel';
import { CategoryModel } from '../models/categoryModel';

export class BudgetsController {
  // GET /api/budgets - list budgets for user with spent amounts
  static async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const budgets = await BudgetModel.findAllForUser(userId);

      res.json({ data: budgets });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/budgets - create budget
  static async create(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const data = createBudgetSchema.parse(req.body);

      // Verify category is accessible
      const isAccessible = await CategoryModel.isAccessibleByUser(
        data.categoryId,
        userId
      );
      if (!isAccessible) {
        res.status(400).json({ error: 'Invalid or inaccessible category' });
        return;
      }

      const budget = await BudgetModel.create(userId, data);

      res.status(201).json({ data: budget });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/budgets/:id - update budget amount
  static async update(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const data = updateBudgetSchema.parse(req.body);

      const budget = await BudgetModel.update(id, userId, data);
      if (!budget) {
        res.status(404).json({ error: 'Budget not found' });
        return;
      }

      res.json({ data: budget });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/budgets/:id - delete budget
  static async delete(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const deleted = await BudgetModel.delete(id, userId);
      if (!deleted) {
        res.status(404).json({ error: 'Budget not found' });
        return;
      }

      res.json({ message: 'Budget deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}
