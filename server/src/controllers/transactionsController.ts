import { Request, Response, NextFunction } from 'express';
import {
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionsQuerySchema,
} from '../schemas/transaction';
import { TransactionModel } from '../models/transactionModel';
import { CategoryModel } from '../models/categoryModel';
import { pool, withUser } from '../db/pool';
import { getAiSettings } from '../services/ai/client';
import { enrichImport } from '../services/ai/enrichImport';
import type { NormalizedTransaction } from '../services/normalizer';
import { rebuildMonth } from '../services/snapshotBuilder';

export class TransactionsController {
  // GET /api/transactions
  static async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const filters = listTransactionsQuerySchema.parse(req.query);

      const result = await TransactionModel.list(userId, filters);

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/transactions
  static async create(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const data = createTransactionSchema.parse(req.body);

      // Verify category ownership if provided
      if (data.categoryId) {
        const isAccessible = await CategoryModel.isAccessibleByUser(
          data.categoryId,
          userId
        );
        if (!isAccessible) {
          res.status(400).json({ error: 'Invalid or inaccessible category' });
          return;
        }
      }

      const transaction = await TransactionModel.create(userId, data);

      res.status(201).json({ data: transaction });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/transactions/:id
  static async update(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const updates = updateTransactionSchema.parse(req.body);

      // Verify category if provided
      if (updates.categoryId) {
        const isAccessible = await CategoryModel.isAccessibleByUser(
          updates.categoryId,
          userId
        );
        if (!isAccessible) {
          res.status(400).json({ error: 'Invalid or inaccessible category' });
          return;
        }
      }

      const updated = await TransactionModel.update(id, userId, updates);
      if (!updated) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/transactions/auto-classify
  static async autoClassify(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;

      const aiSettings = await getAiSettings(userId);
      if (!aiSettings) {
        res.status(400).json({ error: 'AI is not configured or is disabled.' });
        return;
      }

      // Fetch uncategorized transactions (cap at 100 to stay within prompt limits)
      const txResult = await withUser(userId, (client) =>
        client.query(
          `SELECT id, description, amount::float, date FROM transactions
           WHERE user_id = $1 AND category_id IS NULL
           ORDER BY date DESC LIMIT 100`,
          [userId]
        )
      );

      const toClassify = txResult.rows;
      if (toClassify.length === 0) {
        res.json({ data: { classified: 0, total: 0 } });
        return;
      }

      // Load categories for name→ID resolution
      const catResult = await pool.query(
        `SELECT id, name FROM categories
         WHERE user_id = $1 OR (is_system = true AND user_id IS NULL)`,
        [userId]
      );
      const categoryNames = catResult.rows.map((c: { name: string }) => c.name);
      const catByName = new Map<string, string>(
        catResult.rows.map((c: { name: string; id: string }) => [c.name.toLowerCase(), c.id])
      );

      // Convert to NormalizedTransaction shape for enrichImport
      const normalized: NormalizedTransaction[] = toClassify.map((tx) => ({
        date: tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : String(tx.date),
        description: tx.description,
        amount: parseFloat(tx.amount),
        type: parseFloat(tx.amount) >= 0 ? 'income' : 'expense',
        rawRow: {},
      }));

      const enriched = await enrichImport(normalized, aiSettings, categoryNames).catch(() => null);
      if (!enriched) {
        res.status(500).json({ error: 'AI classification failed.' });
        return;
      }

      // Bulk-update category_id (and notes where still empty)
      const client = await pool.connect();
      let classified = 0;
      const affectedMonths = new Set<string>();

      try {
        await client.query('BEGIN');
        await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);

        for (let i = 0; i < toClassify.length; i++) {
          const tx = toClassify[i];
          const ai = enriched[i];
          if (!ai?.aiCategoryName) continue;

          const categoryId = catByName.get(ai.aiCategoryName.toLowerCase());
          if (!categoryId) continue;

          await client.query(
            `UPDATE transactions
             SET category_id = $1, notes = COALESCE(notes, $2)
             WHERE id = $3`,
            [categoryId, ai.notes ?? null, tx.id]
          );

          classified++;
          const dateStr = tx.date instanceof Date
            ? tx.date.toISOString().split('T')[0]
            : String(tx.date);
          affectedMonths.add(dateStr.substring(0, 7) + '-01');
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      await Promise.all(
        Array.from(affectedMonths).map((m) =>
          rebuildMonth(pool, userId, m).catch(console.error)
        )
      );

      res.json({ data: { classified, total: toClassify.length } });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/transactions/:id
  static async delete(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const deleted = await TransactionModel.delete(id, userId);
      if (!deleted) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      res.json({ message: 'Transaction deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}
