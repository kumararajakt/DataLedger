import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';

const router: Router = Router();

router.use(authMiddleware);

const createBudgetSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}-01$/, 'Month must be in YYYY-MM-01 format (first of month)'),
  amount: z.number().positive('Amount must be positive').finite(),
});

const updateBudgetSchema = z.object({
  amount: z.number().positive('Amount must be positive').finite(),
});

// GET /api/budgets - list budgets for user with spent amounts
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.userId;

      const result = await query(
        `SELECT
           b.id,
           b.user_id,
           b.category_id,
           b.month,
           b.amount,
           c.name as category_name,
           c.color as category_color,
           c.icon as category_icon,
           COALESCE(
             ABS(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END)),
             0
           ) as spent
         FROM budgets b
         JOIN categories c ON b.category_id = c.id
         LEFT JOIN transactions t ON (
           t.category_id = b.category_id
           AND t.user_id = b.user_id
           AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', b.month)
         )
         WHERE b.user_id = $1
         GROUP BY b.id, b.user_id, b.category_id, b.month, b.amount,
                  c.name, c.color, c.icon
         ORDER BY b.month DESC, c.name ASC`,
        [userId]
      );

      res.json({ data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/budgets - create budget
router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.userId;
      const { categoryId, month, amount } = createBudgetSchema.parse(req.body);

      // Verify category is accessible
      const catResult = await query(
        `SELECT id FROM categories WHERE id = $1 AND (user_id = $2 OR is_system = true)`,
        [categoryId, userId]
      );

      if (catResult.rows.length === 0) {
        res.status(400).json({ error: 'Invalid or inaccessible category' });
        return;
      }

      const result = await query(
        `INSERT INTO budgets (user_id, category_id, month, amount)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, category_id, month)
         DO UPDATE SET amount = EXCLUDED.amount
         RETURNING id, user_id, category_id, month, amount`,
        [userId, categoryId, month, amount]
      );

      res.status(201).json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/budgets/:id - update budget amount
router.patch(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.userId;
      const { id } = req.params;
      const { amount } = updateBudgetSchema.parse(req.body);

      // Verify ownership
      const existing = await query(
        `SELECT id FROM budgets WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Budget not found' });
        return;
      }

      const result = await query(
        `UPDATE budgets SET amount = $1
         WHERE id = $2 AND user_id = $3
         RETURNING id, user_id, category_id, month, amount`,
        [amount, id, userId]
      );

      res.json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/budgets/:id - delete budget
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      const existing = await query(
        `SELECT id FROM budgets WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Budget not found' });
        return;
      }

      await query('DELETE FROM budgets WHERE id = $1 AND user_id = $2', [
        id,
        userId,
      ]);

      res.json({ message: 'Budget deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
