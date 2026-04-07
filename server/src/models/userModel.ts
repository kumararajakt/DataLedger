import { query } from '../db/pool';

export interface User {
  id: string;
  email: string;
  password_hash: string;
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
      'SELECT id, email, password_hash, created_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;
    return result.rows[0];
  }

  static async findByEmail(email: string): Promise<User | null> {
    const result = await query<User>(
      'SELECT id, email, password_hash, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) return null;
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
