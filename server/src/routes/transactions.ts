import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { TransactionsController } from '../controllers/transactionsController';

const router: Router = Router();

router.use(authMiddleware);

// GET /api/transactions
router.get('/', TransactionsController.list);

// POST /api/transactions
router.post('/', TransactionsController.create);

// POST /api/transactions/auto-classify
router.post('/auto-classify', TransactionsController.autoClassify);

// PATCH /api/transactions/:id
router.patch('/:id', TransactionsController.update);

// DELETE /api/transactions/:id
router.delete('/:id', TransactionsController.delete);

export default router;
