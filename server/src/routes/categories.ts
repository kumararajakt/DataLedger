import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { CategoriesController } from '../controllers/categoriesController';

const router: Router = Router();

router.use(authMiddleware);

// GET /api/categories - get all categories for user (system + custom)
router.get('/', CategoriesController.list);

// POST /api/categories - create custom category
router.post('/', CategoriesController.create);

// PATCH /api/categories/:id - update custom category
router.patch('/:id', CategoriesController.update);

// DELETE /api/categories/:id - delete custom category
router.delete('/:id', CategoriesController.delete);

export default router;
