import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { BudgetsController } from '../controllers/budgetsController';

const router: Router = Router();

router.use(authMiddleware);

// GET /api/budgets - list budgets for user with spent amounts
router.get('/', BudgetsController.list);

// POST /api/budgets - create budget
router.post('/', BudgetsController.create);

// PATCH /api/budgets/:id - update budget amount
router.patch('/:id', BudgetsController.update);

// DELETE /api/budgets/:id - delete budget
router.delete('/:id', BudgetsController.delete);

export default router;
