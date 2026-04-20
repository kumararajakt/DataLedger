import { query } from '../db/pool';
import type { Widget } from '../schemas/dashboardConfig';

export class DashboardConfigModel {
  static async findByUserId(userId: string): Promise<Widget[] | null> {
    const result = await query(
      `SELECT widgets FROM user_dashboard_config WHERE user_id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0].widgets as Widget[];
  }

  static async save(userId: string, widgets: Widget[]): Promise<void> {
    await query(
      `INSERT INTO user_dashboard_config (user_id, widgets, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         widgets    = EXCLUDED.widgets,
         updated_at = NOW()`,
      [userId, JSON.stringify(widgets)]
    );
  }

  static async delete(userId: string): Promise<void> {
    await query(
      `DELETE FROM user_dashboard_config WHERE user_id = $1`,
      [userId]
    );
  }

  static getDefaultWidgets(): Widget[] {
    return [
      { id: crypto.randomUUID(), type: 'stat',           enabled: true, position: 0, colSpan: 3,  rowSpan: 1, config: { metric: 'income',            label: 'Total Income' } },
      { id: crypto.randomUUID(), type: 'stat',           enabled: true, position: 1, colSpan: 3,  rowSpan: 1, config: { metric: 'expense',           label: 'Total Expense' } },
      { id: crypto.randomUUID(), type: 'stat',           enabled: true, position: 2, colSpan: 3,  rowSpan: 1, config: { metric: 'savings',           label: 'Net Savings' } },
      { id: crypto.randomUUID(), type: 'stat',           enabled: true, position: 3, colSpan: 3,  rowSpan: 1, config: { metric: 'transaction_count', label: 'Transactions' } },
      { id: crypto.randomUUID(), type: 'pie',            enabled: true, position: 4, colSpan: 6,  rowSpan: 2, config: { title: 'Payment Types' } },
      { id: crypto.randomUUID(), type: 'bank_breakdown', enabled: true, position: 5, colSpan: 6,  rowSpan: 2, config: { title: 'Category Breakdown', limit: 6 } },
      { id: crypto.randomUUID(), type: 'line',           enabled: true, position: 6, colSpan: 12, rowSpan: 2, config: { months: 6, title: 'Monthly Volume' } },
      { id: crypto.randomUUID(), type: 'table',          enabled: true, position: 7, colSpan: 12, rowSpan: 3, config: { source: 'recent_transactions', limit: 10, title: 'Transaction Overview' } },
    ];
  }
}
