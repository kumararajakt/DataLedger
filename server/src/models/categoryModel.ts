import { query } from '../db/pool';

export interface CategoryDbResult {
  id: string;
  user_id: string | null;
  name: string;
  color: string;
  icon: string;
  is_system: boolean;
}

export interface Category {
  id: string;
  userId: string | null;
  name: string;
  color: string;
  icon: string;
  isSystem: boolean;
}

export class CategoryModel {
  static async findAllForUser(userId: string): Promise<Category[]> {
    const result = await query<CategoryDbResult>(
      `SELECT id, user_id, name, color, icon, is_system
       FROM categories
       WHERE user_id = $1 OR (user_id IS NULL AND is_system = true)
       ORDER BY is_system DESC, name ASC`,
      [userId]
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  static async findById(id: string): Promise<Category | null> {
    const result = await query<CategoryDbResult>(
      'SELECT id, user_id, name, color, icon, is_system FROM categories WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  static async existsByNameForUser(
    name: string,
    userId: string
  ): Promise<boolean> {
    const result = await query(
      'SELECT id FROM categories WHERE name = $1 AND user_id = $2',
      [name, userId]
    );
    return result.rows.length > 0;
  }

  static async create(
    userId: string,
    name: string,
    color: string,
    icon: string
  ): Promise<Category> {
    const result = await query<CategoryDbResult>(
      `INSERT INTO categories (user_id, name, color, icon, is_system)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id, user_id, name, color, icon, is_system`,
      [userId, name, color, icon]
    );

    return this.mapRow(result.rows[0]);
  }

  static async update(
    id: string,
    updates: { name?: string; color?: string; icon?: string }
  ): Promise<Category | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.color !== undefined) {
      setClauses.push(`color = $${paramIndex++}`);
      values.push(updates.color);
    }
    if (updates.icon !== undefined) {
      setClauses.push(`icon = $${paramIndex++}`);
      values.push(updates.icon);
    }

    if (setClauses.length === 0) return null;

    values.push(id);

    const result = await query<CategoryDbResult>(
      `UPDATE categories SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, user_id, name, color, icon, is_system`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM categories WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  static async isSystemCategory(id: string): Promise<boolean | null> {
    const result = await query(
      'SELECT is_system FROM categories WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0].is_system;
  }

  static async isAccessibleByUser(
    id: string,
    userId: string
  ): Promise<boolean> {
    const result = await query(
      `SELECT id FROM categories WHERE id = $1 AND (user_id = $2 OR is_system = true)`,
      [id, userId]
    );
    return result.rows.length > 0;
  }

  private static mapRow(row: CategoryDbResult): Category {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      color: row.color,
      icon: row.icon,
      isSystem: row.is_system,
    };
  }
}
