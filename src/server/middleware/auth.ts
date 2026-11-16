import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';
import { UserRole } from '../../shared/types/auth';

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined);

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token is missing. Please log in.'
    });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      role: payload.role
    };
    next();
  } catch {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired authentication session.'
    });
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Role "${req.user.role}" does not have required permissions: [${allowedRoles.join(', ')}]`
      });
      return;
    }

    next();
  };
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined);

  if (token) {
    try {
      const payload = verifyToken(token);
      req.user = {
        id: payload.sub,
        username: payload.username,
        email: payload.email,
        role: payload.role
      };
    } catch {
      // Ignore invalid token for optional auth
    }
  }

  next();
}
