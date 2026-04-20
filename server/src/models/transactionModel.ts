import { pool, withUser } from '../db/pool';
import { rebuildMonth } from '../services/snapshotBuilder';

export interface InvestmentDetails {
  instrument_type: 'mutual_fund' | 'sip' | 'stock' | 'fd' | 'ppf' | 'nps' | 'bond' | 'gold' | 'silver';
  instrument_name?: string;
  units?: number;
  quantity?: number;
  nav_or_price?: number;
  folio_number?: string;
  platform?: string;
  interest_rate?: number;
  maturity_date?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  categoryId: string | null;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  source: 'csv' | 'pdf' | 'manual' | 'plaid';
  hash: string | null;
  rawData: Record<string, unknown> | null;
  notes: string | null;
  investmentDetails: InvestmentDetails | null;
  createdAt: Date;
  // Joined fields
  categoryName?: string | null;
  categoryColor?: string | null;
  categoryIcon?: string | null;
  category?: {
    id: string;
    name: string;
    color: string;
    icon: string;
    isSystem: boolean;
    userId: string | null;
  };
}

export interface TransactionListFilters {
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  type?: 'income' | 'expense' | 'transfer';
  search?: string;
  page?: number;
  limit?: number;
}

export interface TransactionListResult {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateTransactionInput {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  categoryId?: string | null;
  notes?: string | null;
  investmentDetails?: InvestmentDetails | null;
}

export interface UpdateTransactionInput {
  date?: string;
  description?: string;
  amount?: number;
  type?: 'income' | 'expense' | 'transfer';
  categoryId?: string | null;
  notes?: string | null;
  investmentDetails?: InvestmentDetails | null;
}

export class TransactionModel {
  static async list(
    userId: string,
    filters: TransactionListFilters
  ): Promise<TransactionListResult> {
    const { page = 1, limit = 50, dateFrom, dateTo, categoryId, type, search } = filters;
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
                t.amount, t.type, t.source, t.hash, t.raw_data, t.notes,
                t.investment_details, t.created_at,
                c.name as category_name, c.color as category_color, c.icon as category_icon
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE ${whereClause}
         ORDER BY t.date DESC, t.created_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...values, limit, offset]
      )
    );

    return {
      data: dataResult.rows.map((row) => this.mapRow(row)),
      total,
      page,
      limit,
    };
  }

  static async findById(
    id: string,
    userId: string
  ): Promise<Transaction | null> {
    const result = await withUser(userId, (client) =>
      client.query(
        `SELECT t.id, t.user_id, t.category_id, t.date, t.description,
                t.amount, t.type, t.source, t.hash, t.raw_data, t.notes,
                t.investment_details, t.created_at,
                c.name as category_name, c.color as category_color, c.icon as category_icon
         FROM transactions t
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.id = $1 AND t.user_id = $2`,
        [id, userId]
      )
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  static async create(
    userId: string,
    data: CreateTransactionInput
  ): Promise<Transaction> {
    const result = await withUser(userId, (client) =>
      client.query(
        `INSERT INTO transactions
           (user_id, category_id, date, description, amount, type, source, notes, investment_details)
         VALUES ($1, $2, $3, $4, $5, $6, 'manual', $7, $8)
         RETURNING id, user_id, category_id, date, description, amount, type, source,
                   hash, raw_data, notes, investment_details, created_at`,
        [
          userId,
          data.categoryId ?? null,
          data.date,
          data.description,
          data.amount,
          data.type,
          data.notes ?? null,
          data.investmentDetails ? JSON.stringify(data.investmentDetails) : null,
        ]
      )
    );

    const transaction = this.mapRow(result.rows[0]);

    // Rebuild snapshot for the affected month
    const month = data.date.substring(0, 7) + '-01';
    await rebuildMonth(pool, userId, month);

    return transaction;
  }

  static async update(
    id: string,
    userId: string,
    updates: UpdateTransactionInput
  ): Promise<Transaction | null> {
    // Get existing transaction
    const existing = await withUser(userId, (client) =>
      client.query(
        `SELECT id, date, user_id FROM transactions WHERE id = $1 AND user_id = $2`,
        [id, userId]
      )
    );

    if (existing.rows.length === 0) return null;

    const oldDate = existing.rows[0].date as Date;

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
    if ('investmentDetails' in updates) {
      setClauses.push(`investment_details = $${paramIndex++}`);
      values.push(updates.investmentDetails ? JSON.stringify(updates.investmentDetails) : null);
    }

    if (setClauses.length === 0) return null;

    values.push(id);

    const result = await withUser(userId, (client) =>
      client.query(
        `UPDATE transactions SET ${setClauses.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, user_id, category_id, date, description, amount, type, source,
                   hash, raw_data, notes, investment_details, created_at`,
        values
      )
    );

    if (result.rows.length === 0) return null;

    const updated = this.mapRow(result.rows[0]);
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

    return updated;
  }

  static async delete(id: string, userId: string): Promise<boolean> {
    // Get date for snapshot rebuild
    const existing = await withUser(userId, (client) =>
      client.query(
        `SELECT id, date FROM transactions WHERE id = $1 AND user_id = $2`,
        [id, userId]
      )
    );

    if (existing.rows.length === 0) return false;

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

    return true;
  }

  private static mapRow(row: Record<string, any>): Transaction {
    return {
      id: row.id,
      userId: row.user_id,
      categoryId: row.category_id,
      date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
      description: row.description,
      amount: parseFloat(row.amount),
      type: row.type,
      source: row.source,
      hash: row.hash,
      rawData: row.raw_data,
      notes: row.notes,
      investmentDetails: row.investment_details ?? null,
      createdAt: row.created_at,
      categoryName: row.category_name,
      categoryColor: row.category_color,
      categoryIcon: row.category_icon,
      category: row.category_id
        ? {
            id: row.category_id,
            name: row.category_name ?? '',
            color: row.category_color ?? '#888888',
            icon: row.category_icon ?? '',
            isSystem: false,
            userId: null,
          }
        : undefined,
    };
  }
}
