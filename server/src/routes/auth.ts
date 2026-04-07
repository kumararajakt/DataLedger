import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../db/pool';

const router: Router = Router();

const BCRYPT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

const registerSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

interface TokenPayload {
  userId: string;
  email: string;
}

function generateAccessToken(payload: TokenPayload): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not configured');
  return jwt.sign(payload, secret, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function generateRefreshToken(payload: TokenPayload): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not configured');
  return jwt.sign(payload, secret, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
    path: '/',
  });
}

// POST /api/auth/register
router.post(
  '/register',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = registerSchema.parse(req.body);

      // Check if email already exists
      const existing = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Insert user
      const result = await query<{ id: string; email: string }>(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        [email, passwordHash]
      );

      const user = result.rows[0];

      // Generate tokens
      const tokenPayload: TokenPayload = { userId: user.id, email: user.email };
      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      setRefreshTokenCookie(res, refreshToken);

      res.status(201).json({
        accessToken,
        user: { id: user.id, email: user.email },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      // Find user
      const result = await query<{
        id: string;
        email: string;
        password_hash: string;
      }>('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);

      if (result.rows.length === 0) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const user = result.rows[0];

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.password_hash);

      if (!passwordValid) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      // Generate tokens
      const tokenPayload: TokenPayload = { userId: user.id, email: user.email };
      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      setRefreshTokenCookie(res, refreshToken);

      res.json({
        accessToken,
        user: { id: user.id, email: user.email },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refreshToken as string | undefined;

      if (!refreshToken) {
        res.status(401).json({ error: 'No refresh token provided' });
        return;
      }

      const secret = process.env.JWT_REFRESH_SECRET;
      if (!secret) {
        res.status(500).json({ error: 'Server configuration error' });
        return;
      }

      let payload: jwt.JwtPayload & TokenPayload;

      try {
        payload = jwt.verify(refreshToken, secret) as jwt.JwtPayload &
          TokenPayload;
      } catch {
        res.status(401).json({ error: 'Invalid or expired refresh token' });
        return;
      }

      if (!payload.userId || !payload.email) {
        res.status(401).json({ error: 'Invalid token payload' });
        return;
      }

      // Verify user still exists
      const userResult = await query<{ id: string; email: string }>(
        'SELECT id, email FROM users WHERE id = $1',
        [payload.userId]
      );

      if (userResult.rows.length === 0) {
        res.status(401).json({ error: 'User no longer exists' });
        return;
      }

      const user = userResult.rows[0];
      const tokenPayload: TokenPayload = { userId: user.id, email: user.email };
      const newAccessToken = generateAccessToken(tokenPayload);

      res.json({ accessToken: newAccessToken });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/auth/logout
router.delete('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  res.json({ message: 'Logged out successfully' });
});

export default router;
