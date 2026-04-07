import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { ReportsController } from '../controllers/reportsController';

const router: Router = Router();

router.use(authMiddleware);

// GET /api/reports/monthly?month=YYYY-MM
router.get('/monthly', ReportsController.monthly);

// GET /api/reports/category-breakdown?month=YYYY-MM
router.get('/category-breakdown', ReportsController.categoryBreakdown);

// GET /api/reports/trends?months=6
router.get('/trends', ReportsController.trends);

export default router;
