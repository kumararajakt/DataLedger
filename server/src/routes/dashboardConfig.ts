import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { DashboardConfigController } from '../controllers/dashboardConfigController';

const router: Router = Router();
router.use(authMiddleware);

router.get('/',    DashboardConfigController.getConfig);
router.post('/',   DashboardConfigController.saveConfig);
router.delete('/', DashboardConfigController.resetConfig);

export default router;
