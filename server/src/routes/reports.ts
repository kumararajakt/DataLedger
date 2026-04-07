import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { authMiddleware } from '../middleware/auth';
import { rebuildMonth } from '../services/snapshotBuilder';

const router: Router = Router();

router.use(authMiddleware);

const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
});

const trendsQuerySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

// GET /api/reports/monthly?month=YYYY-MM
router.get(
  '/monthly',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.userId;
      const { month } = monthQuerySchema.parse(req.query);
      const monthDate = month + '-01';

      // Try to get from snapshot
      let snapshot = await pool.query(
        `SELECT id, user_id, month, total_income, total_expense, by_category
         FROM monthly_snapshots
         WHERE user_id = $1 AND month = $2`,
        [userId, monthDate]
      );

      // If missing, compute on the fly
      if (snapshot.rows.length === 0) {
        await rebuildMonth(pool, userId, monthDate);

        snapshot = await pool.query(
          `SELECT id, user_id, month, total_income, total_expense, by_category
           FROM monthly_snapshots
           WHERE user_id = $1 AND month = $2`,
          [userId, monthDate]
        );
      }

      if (snapshot.rows.length === 0) {
        // No transactions in this month
        res.json({
          data: {
            month: monthDate,
            total_income: 0,
            total_expense: 0,
            savings: 0,
            by_category: {},
          },
        });
        return;
      }

      const row = snapshot.rows[0] as {
        month: Date | string;
        total_income: string;
        total_expense: string;
        by_category: Record<string, unknown>;
      };

      const totalIncome = parseFloat(row.total_income);
      const totalExpense = parseFloat(row.total_expense);

      res.json({
        data: {
          month: monthDate,
          total_income: totalIncome,
          total_expense: totalExpense,
          savings: totalIncome - totalExpense,
          by_category: row.by_category,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/reports/category-breakdown?month=YYYY-MM
router.get(
  '/category-breakdown',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.userId;
      const { month } = monthQuerySchema.parse(req.query);
      const monthDate = month + '-01';

      // Aggregate transactions by category for the month
      const result = await pool.query(
        `SELECT
           c.id as category_id,
           c.name as category,
           c.color,
           c.icon,
           SUM(ABS(t.amount)) as amount,
           t.type
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.user_id = $1
           AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', $2::date)
           AND t.type = 'expense'
         GROUP BY c.id, c.name, c.color, c.icon, t.type
         ORDER BY amount DESC`,
        [userId, monthDate]
      );

      const totalExpense = result.rows.reduce(
        (sum, row) => sum + parseFloat(row.amount as string),
        0
      );

      const breakdown = result.rows.map((row) => ({
        categoryId: row.category_id as string | null,
        category: (row.category as string | null) ?? 'Uncategorized',
        color: (row.color as string | null) ?? '#6B7280',
        icon: (row.icon as string | null) ?? '❓',
        amount: parseFloat(row.amount as string),
        percentage:
          totalExpense > 0
            ? Math.round(
                (parseFloat(row.amount as string) / totalExpense) * 10000
              ) / 100
            : 0,
      }));

      res.json({ data: breakdown, total: totalExpense });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/reports/trends?months=6
router.get(
  '/trends',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.userId;
      const { months } = trendsQuerySchema.parse(req.query);

      // Generate the list of months to query (last N months including current)
      const monthList: string[] = [];
      const now = new Date();

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        monthList.push(`${yyyy}-${mm}-01`);
      }

      // Query snapshots for these months
      const snapshotResult = await pool.query(
        `SELECT month, total_income, total_expense
         FROM monthly_snapshots
         WHERE user_id = $1 AND month = ANY($2::date[])`,
        [userId, monthList]
      );

      // Build a map of existing snapshots
      const snapshotMap = new Map<
        string,
        { total_income: number; total_expense: number }
      >();

      for (const row of snapshotResult.rows) {
        const monthStr =
          row.month instanceof Date
            ? row.month.toISOString().substring(0, 10)
            : String(row.month).substring(0, 10);

        snapshotMap.set(monthStr, {
          total_income: parseFloat(row.total_income),
          total_expense: parseFloat(row.total_expense),
        });
      }

      // For months without snapshots, compute on the fly
      const missingMonths = monthList.filter((m) => !snapshotMap.has(m));

      if (missingMonths.length > 0) {
        // Check if there are any transactions in these months first
        const txResult = await pool.query(
          `SELECT DISTINCT DATE_TRUNC('month', date)::date as month
           FROM transactions
           WHERE user_id = $1 AND DATE_TRUNC('month', date) = ANY($2::date[])`,
          [userId, missingMonths]
        );

        const monthsWithTx = new Set(
          txResult.rows.map((r) => {
            const d = r.month instanceof Date ? r.month : new Date(r.month);
            return d.toISOString().substring(0, 10);
          })
        );

        // Rebuild snapshots for months that have transactions
        await Promise.all(
          missingMonths
            .filter((m) => monthsWithTx.has(m))
            .map(async (m) => {
              await rebuildMonth(pool, userId, m);

              const snapshotRow = await pool.query(
                `SELECT total_income, total_expense
                 FROM monthly_snapshots
                 WHERE user_id = $1 AND month = $2`,
                [userId, m]
              );

              if (snapshotRow.rows.length > 0) {
                snapshotMap.set(m, {
                  total_income: parseFloat(snapshotRow.rows[0].total_income),
                  total_expense: parseFloat(snapshotRow.rows[0].total_expense),
                });
              }
            })
        );
      }

      // Build trends array
      const trends = monthList.map((month) => {
        const snapshot = snapshotMap.get(month);
        const income = snapshot?.total_income ?? 0;
        const expense = snapshot?.total_expense ?? 0;

        return {
          month,
          income,
          expense,
          savings: income - expense,
        };
      });

      res.json({ data: trends });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
