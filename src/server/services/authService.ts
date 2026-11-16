import crypto from 'node:crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { JWT_SECRET } from '../config';
import { JWTPayload, SessionUser, UserRole } from '../../shared/types/auth';

const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) {
    return false;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, expectedHashHex] = parts;
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });
  const expectedBuf = Buffer.from(expectedHashHex, 'hex');
  if (derivedKey.length !== expectedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(derivedKey, expectedBuf);
}

export function generateToken(user: { id: string; username: string; email?: string; role: UserRole }, expiresIn = '24h'): string {
  const payload: JWTPayload = {
    sub: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  };
  const options: SignOptions = {
    expiresIn: expiresIn as SignOptions['expiresIn']
  };
  return jwt.sign(payload, JWT_SECRET, options);
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}
