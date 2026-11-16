import { describe, it, expect, vi } from 'vitest';
import { Request, Response } from 'express';
import { authMiddleware, requireRole, optionalAuth } from '../../src/server/middleware/auth';
import { generateToken } from '../../src/server/services/authService';

function createMockReqRes(headers: Record<string, string> = {}, cookies: Record<string, string> = {}) {
  const req = {
    headers,
    cookies,
    user: undefined
  } as unknown as Request;

  const res = {
    statusCode: 200,
    jsonData: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.jsonData = data;
      return this;
    }
  } as unknown as Response & { statusCode: number; jsonData: any };

  const next = vi.fn();

  return { req, res, next };
}

describe('RBAC & Auth Middleware Unit Tests', () => {
  describe('authMiddleware', () => {
    it('returns 401 when token is missing', () => {
      const { req, res, next } = createMockReqRes();

      authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData.error).toBe('Unauthorized');
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when token is invalid', () => {
      const { req, res, next } = createMockReqRes({ authorization: 'Bearer invalid.token.payload' });

      authMiddleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData.error).toBe('Unauthorized');
      expect(next).not.toHaveBeenCalled();
    });

    it('sets req.user and calls next when Bearer token is valid', () => {
      const token = generateToken({
        id: 'u-1',
        username: 'charlie',
        email: 'charlie@test.local',
        role: 'creator'
      });
      const { req, res, next } = createMockReqRes({ authorization: `Bearer ${token}` });

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user?.id).toBe('u-1');
      expect(req.user?.username).toBe('charlie');
      expect(req.user?.role).toBe('creator');
    });

    it('sets req.user and calls next when cookie token is valid', () => {
      const token = generateToken({
        id: 'u-2',
        username: 'david',
        email: 'david@test.local',
        role: 'visitor'
      });
      const { req, res, next } = createMockReqRes({}, { token });

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user?.id).toBe('u-2');
      expect(req.user?.role).toBe('visitor');
    });
  });

  describe('requireRole middleware', () => {
    it('returns 401 if req.user is not set', () => {
      const { req, res, next } = createMockReqRes();
      const middleware = requireRole(['creator']);

      middleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.jsonData.error).toBe('Unauthorized');
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 if req.user does not have the required role', () => {
      const { req, res, next } = createMockReqRes();
      req.user = { id: 'u-3', username: 'eva', role: 'visitor' };

      const middleware = requireRole(['creator']);
      middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.jsonData.error).toBe('Forbidden');
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next if req.user has one of the allowed roles', () => {
      const { req, res, next } = createMockReqRes();
      req.user = { id: 'u-4', username: 'frank', role: 'creator' };

      const middleware = requireRole(['creator']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });
  });

  describe('optionalAuth middleware', () => {
    it('calls next without setting user if no token provided', () => {
      const { req, res, next } = createMockReqRes();

      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it('sets req.user and calls next if valid token is provided', () => {
      const token = generateToken({
        id: 'u-5',
        username: 'grace',
        role: 'visitor'
      });
      const { req, res, next } = createMockReqRes({ authorization: `Bearer ${token}` });

      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user?.username).toBe('grace');
    });

    it('calls next without throwing if invalid token is provided', () => {
      const { req, res, next } = createMockReqRes({ authorization: 'Bearer corrupt' });

      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });
  });
});
