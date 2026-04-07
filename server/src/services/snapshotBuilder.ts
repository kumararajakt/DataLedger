import { Pool } from 'pg';

interface CategoryAggregate {
  category_id: string | null;
  category_name: string | null;
  total: number;
}

/**
 * Rebuild the monthly snapshot for a given user and month.
 * - Aggregates total_income (sum of positive amounts)
 * - Aggregates total_expense (sum of absolute value of negative amounts)
 * - Groups by category for by_category JSONB
 * - Upserts into monthly_snapshots
 */
export async function rebuildMonth(
  pool: Pool,
  userId: string,
  month: string  // YYYY-MM-01 format
): Promise<void> {
  // Normalize month to first day of month
  const normalizedMonth = normalizeMonth(month);

  // Aggregate transactions for the month
  const result = await pool.query<{
    total_income: string;
    total_expense: string;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_income,
       COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_expense
     FROM transactions
     WHERE user_id = $1
       AND DATE_TRUNC('month', date) = DATE_TRUNC('month', $2::date)`,
    [userId, normalizedMonth]
  );

  const { total_income, total_expense } = result.rows[0];

  // Aggregate by category
  const categoryResult = await pool.query<CategoryAggregate>(
    `SELECT
       t.category_id,
       c.name as category_name,
       SUM(t.amount) as total
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     WHERE t.user_id = $1
       AND DATE_TRUNC('month', t.date) = DATE_TRUNC('month', $2::date)
     GROUP BY t.category_id, c.name`,
    [userId, normalizedMonth]
  );

  // Build by_category object
  const byCategory: Record<
    string,
    { name: string | null; total: number }
  > = {};

  for (const row of categoryResult.rows) {
    const key = row.category_id ?? 'uncategorized';
    byCategory[key] = {
      name: row.category_name,
      total: parseFloat(String(row.total)),
    };
  }

  // Upsert into monthly_snapshots
  await pool.query(
    `INSERT INTO monthly_snapshots (user_id, month, total_income, total_expense, by_category)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, month)
     DO UPDATE SET
       total_income = EXCLUDED.total_income,
       total_expense = EXCLUDED.total_expense,
       by_category = EXCLUDED.by_category`,
    [
      userId,
      normalizedMonth,
      parseFloat(total_income),
      parseFloat(total_expense),
      JSON.stringify(byCategory),
    ]
  );
}

/**
 * Normalize a month string to YYYY-MM-01 format.
 * Accepts YYYY-MM-DD (uses first of month) or YYYY-MM.
 */
function normalizeMonth(month: string): string {
  // Already in YYYY-MM-01 format
  if (/^\d{4}-\d{2}-01$/.test(month)) return month;

  // YYYY-MM-DD format - take first day of month
  if (/^\d{4}-\d{2}-\d{2}$/.test(month)) {
    return month.substring(0, 7) + '-01';
  }

  // YYYY-MM format
  if (/^\d{4}-\d{2}$/.test(month)) {
    return month + '-01';
  }

  // Default: try to extract YYYY-MM
  const match = month.match(/^(\d{4}-\d{2})/);
  if (match) return match[1] + '-01';

  return month;
}
