import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { registerSchema, loginSchema } from '../schemas/auth';
import { UserModel } from '../models/userModel';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const BCRYPT_ROUNDS = 10;

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

export class AuthController {
  // POST /api/auth/register
  static async register(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, password } = registerSchema.parse(req.body);

      // Check if email already exists
      const exists = await UserModel.existsByEmail(email);
      if (exists) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      // Hash password and create user
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const user = await UserModel.create(email, passwordHash);

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

  // POST /api/auth/login
  static async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, password } = loginSchema.parse(req.body);

      // Find user
      const user = await UserModel.findByEmail(email);
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

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

  // POST /api/auth/refresh
  static async refresh(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
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
      const user = await UserModel.findById(payload.userId);
      if (!user) {
        res.status(401).json({ error: 'User no longer exists' });
        return;
      }

      const tokenPayload: TokenPayload = { userId: user.id, email: user.email };
      const newAccessToken = generateAccessToken(tokenPayload);

      res.json({ accessToken: newAccessToken });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/auth/logout
  static logout(_req: Request, res: Response): void {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    res.json({ message: 'Logged out successfully' });
  }
}
