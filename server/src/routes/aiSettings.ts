import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { AiSettingsController } from '../controllers/aiSettingsController';

const router: Router = Router();

router.use(authMiddleware);

// GET /api/settings/ai
router.get('/', AiSettingsController.getSettings);

// POST /api/settings/ai
router.post('/', AiSettingsController.saveSettings);

// DELETE /api/settings/ai
router.delete('/', AiSettingsController.deleteSettings);

// POST /api/settings/ai/test
router.post('/test', AiSettingsController.testSettings);

export default router;
