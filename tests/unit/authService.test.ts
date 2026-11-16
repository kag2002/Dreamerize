import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken
} from '../../src/server/services/authService';

describe('authService Unit Tests', () => {
  describe('Password Hashing & Verification', () => {
    it('hashes passwords into scrypt$<salt>$<hash> format', () => {
      const password = 'SecretPassword123!';
      const hash = hashPassword(password);

      expect(hash).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    });

    it('generates different salts and hashes for the same password', () => {
      const password = 'SecretPassword123!';
      const hash1 = hashPassword(password);
      const hash2 = hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(verifyPassword(password, hash1)).toBe(true);
      expect(verifyPassword(password, hash2)).toBe(true);
    });

    it('verifies correct password against hash', () => {
      const password = 'MySecurePassword!';
      const hash = hashPassword(password);

      expect(verifyPassword(password, hash)).toBe(true);
    });

    it('rejects incorrect password against hash', () => {
      const password = 'MySecurePassword!';
      const hash = hashPassword(password);

      expect(verifyPassword('WrongPassword!', hash)).toBe(false);
    });

    it('safely handles empty password or malformed hash', () => {
      expect(verifyPassword('', 'scrypt$123$456')).toBe(false);
      expect(verifyPassword('test', '')).toBe(false);
      expect(verifyPassword('test', 'not-scrypt-format')).toBe(false);
      expect(verifyPassword('test', 'scrypt$only-two-parts')).toBe(false);
    });
  });

  describe('JWT Token Generation & Verification', () => {
    it('generates and verifies valid JWT token with claims', () => {
      const user = {
        id: 'user-test-123',
        username: 'alice',
        email: 'alice@example.com',
        role: 'creator' as const
      };

      const token = generateToken(user);
      const payload = verifyToken(token);

      expect(payload.sub).toBe(user.id);
      expect(payload.username).toBe(user.username);
      expect(payload.email).toBe(user.email);
      expect(payload.role).toBe(user.role);
    });

    it('fails verification for tampered token', () => {
      const user = {
        id: 'user-test-123',
        username: 'alice',
        role: 'visitor' as const
      };

      const token = generateToken(user);
      const tampered = token.slice(0, -5) + 'xxxxx';

      expect(() => verifyToken(tampered)).toThrow();
    });

    it('fails verification for expired token', async () => {
      const user = {
        id: 'user-expired',
        username: 'bob',
        role: 'visitor' as const
      };

      // Generate token that expires in 1 millisecond
      const token = generateToken(user, '1ms');

      // Wait 50ms to ensure expiration
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(() => verifyToken(token)).toThrow();
    });
  });
});
