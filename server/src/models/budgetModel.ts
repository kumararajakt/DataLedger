import { query } from '../db/pool';

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  month: string;
  amount: number;
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  spent?: number;
}

export interface CreateBudgetInput {
  categoryId: string;
  month: string;
  amount: number;
}

export interface UpdateBudgetInput {
  amount: number;
}

export class BudgetModel {
  static async findAllForUser(userId: string): Promise<Budget[]> {
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

    return result.rows.map((row) => this.mapRow(row));
  }

  static async findById(id: string, userId: string): Promise<Budget | null> {
    const result = await query(
      `SELECT
         b.id,
         b.user_id,
         b.category_id,
         b.month,
         b.amount
       FROM budgets b
       WHERE b.id = $1 AND b.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  static async create(
    userId: string,
    data: CreateBudgetInput
  ): Promise<Budget> {
    const result = await query(
      `INSERT INTO budgets (user_id, category_id, month, amount)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, category_id, month)
       DO UPDATE SET amount = EXCLUDED.amount
       RETURNING id, user_id, category_id, month, amount`,
      [userId, data.categoryId, data.month, data.amount]
    );

    return this.mapRow(result.rows[0]);
  }

  static async update(
    id: string,
    userId: string,
    updates: UpdateBudgetInput
  ): Promise<Budget | null> {
    const result = await query(
      `UPDATE budgets SET amount = $1
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, category_id, month, amount`,
      [updates.amount, id, userId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  static async delete(id: string, userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM budgets WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  private static mapRow(row: Record<string, any>): Budget {
    return {
      id: row.id,
      userId: row.user_id,
      categoryId: row.category_id,
      month: row.month instanceof Date ? row.month.toISOString().split('T')[0] : String(row.month),
      amount: parseFloat(row.amount),
      categoryName: row.category_name,
      categoryColor: row.category_color,
      categoryIcon: row.category_icon,
      spent: row.spent ? parseFloat(row.spent) : 0,
    };
  }
}
