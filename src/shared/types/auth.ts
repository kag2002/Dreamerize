export type UserRole = 'creator' | 'visitor';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface JWTPayload {
  sub: string;
  username: string;
  email?: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
