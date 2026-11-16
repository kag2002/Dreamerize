import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { getDatabase } from '../db/connection';
import { hashPassword, verifyPassword, generateToken } from '../services/authService';
import { validateBody } from '../middleware/validate';
import { authMiddleware } from '../middleware/auth';
import { registerSchema, loginSchema } from '../../shared/schemas/authSchema';
import { NODE_ENV } from '../config';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60 * 1000,
  path: '/'
};

router.post(
  '/register',
  validateBody(registerSchema),
  (req: Request, res: Response): void => {
    const { username, email, password, role } = req.body;
    const db = getDatabase();

    const existing = db
      .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
      .get(username, email) as { id: string } | undefined;

    if (existing) {
      res.status(400).json({
        error: 'ConflictError',
        message: 'Username or email already exists'
      });
      return;
    }

    const userId = `user-${crypto.randomUUID()}`;
    const passwordHash = hashPassword(password);
    const now = new Date().toISOString();
    const assignedRole = role || 'visitor';

    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, username, email, passwordHash, assignedRole, now, now);

    res.status(201).json({
      success: true,
      user: {
        id: userId,
        username,
        email,
        role: assignedRole
      }
    });
  }
);

router.post(
  '/login',
  validateBody(loginSchema),
  (req: Request, res: Response): void => {
    const { username, password } = req.body;
    const db = getDatabase();

    const user = db
      .prepare('SELECT id, username, email, password_hash, role FROM users WHERE username = ?')
      .get(username) as
      | { id: string; username: string; email: string; password_hash: string; role: 'creator' | 'visitor' }
      | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
      return;
    }

    const token = generateToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });

    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  }
);

router.post('/logout', (_req: Request, res: Response): void => {
  const { maxAge: _maxAge, ...clearCookieOptions } = COOKIE_OPTIONS;
  res.clearCookie('token', clearCookieOptions);
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
});

router.get('/me', authMiddleware, (req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    user: req.user
  });
});

export default router;
