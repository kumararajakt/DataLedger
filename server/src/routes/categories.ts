import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { query } from '../db/pool';
import { authMiddleware } from '../middleware/auth';

const router: Router = Router();

router.use(authMiddleware);

const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color')
    .optional()
    .default('#6B7280'),
  icon: z.string().max(10, 'Icon too long').optional().default('❓'),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color')
    .optional(),
  icon: z.string().max(10).optional(),
});

// GET /api/categories - get all categories for user (system + custom)
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.userId;

      const result = await query(
        `SELECT id, user_id, name, color, icon, is_system
         FROM categories
         WHERE user_id = $1 OR (user_id IS NULL AND is_system = true)
         ORDER BY is_system DESC, name ASC`,
        [userId]
      );

      res.json({ data: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/categories - create custom category
router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.userId;
      const { name, color, icon } = createCategorySchema.parse(req.body);

      // Check for duplicate name for this user
      const existing = await query(
        `SELECT id FROM categories WHERE name = $1 AND user_id = $2`,
        [name, userId]
      );

      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'Category with this name already exists' });
        return;
      }

      const result = await query(
        `INSERT INTO categories (user_id, name, color, icon, is_system)
         VALUES ($1, $2, $3, $4, false)
         RETURNING id, user_id, name, color, icon, is_system`,
        [userId, name, color, icon]
      );

      res.status(201).json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/categories/:id - update custom category
router.patch(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.userId;
      const { id } = req.params;
      const updates = updateCategorySchema.parse(req.body);

      // Verify ownership and that it's not a system category
      const existing = await query(
        `SELECT id, is_system, user_id FROM categories WHERE id = $1`,
        [id]
      );

      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      const category = existing.rows[0] as {
        id: string;
        is_system: boolean;
        user_id: string | null;
      };

      if (category.is_system) {
        res.status(403).json({ error: 'Cannot modify system categories' });
        return;
      }

      if (category.user_id !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Build update query dynamically
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

      if (setClauses.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      values.push(id);

      const result = await query(
        `UPDATE categories SET ${setClauses.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, user_id, name, color, icon, is_system`,
        values
      );

      res.json({ data: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/categories/:id - delete custom category
router.delete(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user.userId;
      const { id } = req.params;

      // Verify ownership and that it's not a system category
      const existing = await query(
        `SELECT id, is_system, user_id FROM categories WHERE id = $1`,
        [id]
      );

      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      const category = existing.rows[0] as {
        id: string;
        is_system: boolean;
        user_id: string | null;
      };

      if (category.is_system) {
        res.status(403).json({ error: 'Cannot delete system categories' });
        return;
      }

      if (category.user_id !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      await query('DELETE FROM categories WHERE id = $1', [id]);

      res.json({ message: 'Category deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
