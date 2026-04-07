import { Request, Response, NextFunction } from 'express';
import {
  createCategorySchema,
  updateCategorySchema,
} from '../schemas/category';
import { CategoryModel } from '../models/categoryModel';

export class CategoriesController {
  // GET /api/categories - get all categories for user (system + custom)
  static async list(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const categories = await CategoryModel.findAllForUser(userId);

      res.json({ data: categories });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/categories - create custom category
  static async create(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const data = createCategorySchema.parse(req.body);

      // Check for duplicate name for this user
      const exists = await CategoryModel.existsByNameForUser(data.name, userId);
      if (exists) {
        res
          .status(409)
          .json({ error: 'Category with this name already exists' });
        return;
      }

      const category = await CategoryModel.create(
        userId,
        data.name,
        data.color,
        data.icon
      );

      res.status(201).json({ data: category });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/categories/:id - update custom category
  static async update(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const updates = updateCategorySchema.parse(req.body);

      // Verify ownership and that it's not a system category
      const category = await CategoryModel.findById(id);
      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      if (category.isSystem) {
        res.status(403).json({ error: 'Cannot modify system categories' });
        return;
      }

      if (category.userId !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const updated = await CategoryModel.update(id, updates);
      if (!updated) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/categories/:id - delete custom category
  static async delete(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      // Verify ownership and that it's not a system category
      const category = await CategoryModel.findById(id);
      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      if (category.isSystem) {
        res.status(403).json({ error: 'Cannot delete system categories' });
        return;
      }

      if (category.userId !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      await CategoryModel.delete(id);

      res.json({ message: 'Category deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}
