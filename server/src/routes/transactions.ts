import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool, withUser } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { rebuildMonth } from '../services/snapshotBuilder';

const router: Router = Router();

router.use(authMiddleware);

const createTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  description: z.string().min(1, 'Description is required').max(500),
  amount: z.number().finite('Amount must be finite'),
  type: z.enum(['income', 'expense', 'transfer']),
  categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
});

const updateTransactionSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .optional(),
  description: z.string().min(1).max(500).optional(),
  amount: z.number().finite().optional(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const listQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// GET /api/transactions
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.userId;
      const filters = listQuerySchema.parse(req.query);

      const { page, limit, dateFrom, dateTo, categoryId, type, search } =
        filters;
      const offset = (page - 1) * limit;

      const conditions: string[] = ['t.user_id = $1'];
      const values: unknown[] = [userId];
      let paramIndex = 2;

      if (dateFrom) {
        conditions.push(`t.date >= $${paramIndex++}`);
        values.push(dateFrom);
      }
      if (dateTo) {
        conditions.push(`t.date <= $${paramIndex++}`);
        values.push(dateTo);
      }
      if (categoryId) {
        conditions.push(`t.category_id = $${paramIndex++}`);
        values.push(categoryId);
      }
      if (type) {
        conditions.push(`t.type = $${paramIndex++}`);
        values.push(type);
      }
      if (search) {
        conditions.push(`t.description ILIKE $${paramIndex++}`);
        values.push(`%${search}%`);
      }

      const whereClause = conditions.join(' AND ');

      // Get total count
      const countResult = await withUser(userId, (client) =>
        client.query(
          `SELECT COUNT(*) as total FROM transactions t WHERE ${whereClause}`,
          values
        )
      );

      const total = parseInt(countResult.rows[0].total as string, 10);

      // Get paginated results
      const dataResult = await withUser(userId, (client) =>
        client.query(
          `SELECT t.id, t.user_id, t.category_id, t.date, t.description,
                  t.amount, t.type, t.source, t.hash, t.raw_data, t.notes, t.created_at,
                  c.name as category_name, c.color as category_color, c.icon as category_icon
           FROM transactions t
           LEFT JOIN categories c ON t.category_id = c.id
           WHERE ${whereClause}
           ORDER BY t.date DESC, t.created_at DESC
           LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
          [...values, limit, offset]
        )
      );

      res.json({
        data: dataResult.rows,
        total,
        page,
        limit,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/transactions
router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.userId;
      const data = createTransactionSchema.parse(req.body);

      // Verify category ownership if provided
      if (data.categoryId) {
        const catResult = await pool.query(
          `SELECT id FROM categories WHERE id = $1 AND (user_id = $2 OR is_system = true)`,
          [data.categoryId, userId]
        );
        if (catResult.rows.length === 0) {
          res.status(400).json({ error: 'Invalid or inaccessible category' });
          return;
        }
      }

      const result = await withUser(userId, (client) =>
        client.query(
          `INSERT INTO transactions (user_id, category_id, date, description, amount, type, source)
           VALUES ($1, $2, $3, $4, $5, $6, 'manual')
           RETURNING id, user_id, category_id, date, description, amount, type, source, created_at`,
          [
            userId,
            data.categoryId ?? null,
            data.date,
            data.description,
            data.amount,
            data.type,
          ]
        )
      );

      const transaction = result.rows[0];

      // Rebuild snapshot for the affected month
      const month = data.date.substring(0, 7) + '-01';
      await rebuildMonth(pool, userId, month);

      res.status(201).json({ data: transaction });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/transactions/:id
router.patch(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.userId;
      const { id } = req.params;
      const updates = updateTransactionSchema.parse(req.body);

      // Verify ownership
      const existing = await withUser(userId, (client) =>
        client.query(
          `SELECT id, date, user_id FROM transactions WHERE id = $1 AND user_id = $2`,
          [id, userId]
        )
      );

      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      const oldDate = existing.rows[0].date as Date;

      // Verify category if provided
      if (updates.categoryId) {
        const catResult = await pool.query(
          `SELECT id FROM categories WHERE id = $1 AND (user_id = $2 OR is_system = true)`,
          [updates.categoryId, userId]
        );
        if (catResult.rows.length === 0) {
          res.status(400).json({ error: 'Invalid or inaccessible category' });
          return;
        }
      }

      const setClauses: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (updates.date !== undefined) {
        setClauses.push(`date = $${paramIndex++}`);
        values.push(updates.date);
      }
      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.amount !== undefined) {
        setClauses.push(`amount = $${paramIndex++}`);
        values.push(updates.amount);
      }
      if (updates.type !== undefined) {
        setClauses.push(`type = $${paramIndex++}`);
        values.push(updates.type);
      }
      if ('categoryId' in updates) {
        setClauses.push(`category_id = $${paramIndex++}`);
        values.push(updates.categoryId ?? null);
      }
      if ('notes' in updates) {
        setClauses.push(`notes = $${paramIndex++}`);
        values.push(updates.notes ?? null);
      }

      if (setClauses.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      values.push(id);

      const result = await withUser(userId, (client) =>
        client.query(
          `UPDATE transactions SET ${setClauses.join(', ')}
           WHERE id = $${paramIndex}
           RETURNING id, user_id, category_id, date, description, amount, type, source, notes, created_at`,
          values
        )
      );

      const updated = result.rows[0];
      const newDate = (updated.date as Date | string).toString();

      // Rebuild snapshots for affected months
      const oldMonth =
        oldDate instanceof Date
          ? oldDate.toISOString().substring(0, 7) + '-01'
          : String(oldDate).substring(0, 7) + '-01';

      const newMonth = (updates.date ?? newDate).substring(0, 7) + '-01';

      await rebuildMonth(pool, userId, oldMonth);
      if (oldMonth !== newMonth) {
        await rebuildMonth(pool, userId, newMonth);
      }

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/transactions/:id
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      // Verify ownership and get date for snapshot rebuild
      const existing = await withUser(userId, (client) =>
        client.query(
          `SELECT id, date FROM transactions WHERE id = $1 AND user_id = $2`,
          [id, userId]
        )
      );

      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      const transactionDate = existing.rows[0].date as Date;

      await withUser(userId, (client) =>
        client.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [
          id,
          userId,
        ])
      );

      // Rebuild snapshot for the affected month
      const month =
        transactionDate instanceof Date
          ? transactionDate.toISOString().substring(0, 7) + '-01'
          : String(transactionDate).substring(0, 7) + '-01';

      await rebuildMonth(pool, userId, month);

      res.json({ message: 'Transaction deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
