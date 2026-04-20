import { query } from '../db/pool';

export interface User {
  id: string;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  created_at: Date;
}

export interface UserWithoutPassword {
  id: string;
  email: string;
  created_at: Date;
}

export class UserModel {
  static async findById(id: string): Promise<User | null> {
    const result = await query<User>(
      'SELECT id, email, password_hash, google_id, created_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  static async findByEmail(email: string): Promise<User | null> {
    const result = await query<User>(
      'SELECT id, email, password_hash, google_id, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  static async findOrCreateByGoogle(
    googleId: string,
    email: string
  ): Promise<UserWithoutPassword> {
    // Try to find by google_id first, then by email (to link existing account)
    const existing = await query<{ id: string; email: string; created_at: Date }>(
      `SELECT id, email, created_at FROM users
       WHERE google_id = $1 OR email = $2
       LIMIT 1`,
      [googleId, email]
    );

    if (existing.rows.length > 0) {
      // Link google_id if not already set
      await query(
        'UPDATE users SET google_id = $1 WHERE id = $2 AND google_id IS NULL',
        [googleId, existing.rows[0].id]
      );
      return existing.rows[0];
    }

    const result = await query<{ id: string; email: string; created_at: Date }>(
      'INSERT INTO users (email, google_id) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, googleId]
    );
    return result.rows[0];
  }

  static async existsByEmail(email: string): Promise<boolean> {
    const result = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    return result.rows.length > 0;
  }

  static async create(
    email: string,
    passwordHash: string
  ): Promise<UserWithoutPassword> {
    const result = await query<{ id: string; email: string; created_at: Date }>(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );

    return result.rows[0];
  }
}
