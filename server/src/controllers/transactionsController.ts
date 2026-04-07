import { Request, Response, NextFunction } from 'express';
import {
  createTransactionSchema,
  updateTransactionSchema,
  listTransactionsQuerySchema,
} from '../schemas/transaction';
import { TransactionModel } from '../models/transactionModel';
import { CategoryModel } from '../models/categoryModel';

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
