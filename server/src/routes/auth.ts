import { Router } from 'express';
import { AuthController } from '../controllers/authController';

const router: Router = Router();

// POST /api/auth/register
router.post('/register', AuthController.register);

// POST /api/auth/login
router.post('/login', AuthController.login);

// POST /api/auth/refresh
router.post('/refresh', AuthController.refresh);

// DELETE /api/auth/logout
router.delete('/logout', AuthController.logout);

export default router;
