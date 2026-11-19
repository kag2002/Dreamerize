import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { SessionUser, UserRole } from '../../shared/types/auth';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (
    username: string,
    email: string,
    password: string,
    role?: UserRole
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const syncRoleGlobal = (u: SessionUser | null) => {
    if (typeof window !== 'undefined') {
      (window as any).__currentUserRole = u?.role ?? null;
      (window as any).__currentUser = u;
    }
  };

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        const foundUser = data?.user ?? null;
        setUser(foundUser);
        syncRoleGlobal(foundUser);
      } else {
        setUser(null);
        syncRoleGlobal(null);
      }
    } catch {
      setUser(null);
      syncRoleGlobal(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, error: data?.message || 'Invalid credentials' };
      }
      setUser(data.user);
      syncRoleGlobal(data.user);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Network error' };
    }
  }, []);

  const register = useCallback(
    async (username: string, email: string, password: string, role: UserRole = 'visitor') => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username, email, password, role }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return { ok: false, error: data?.message || 'Registration failed' };
        }
        // Auto-login after registration
        await login(username, password);
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err?.message || 'Network error' };
      }
    },
    [login]
  );

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore network errors on logout
    }
    setUser(null);
    syncRoleGlobal(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
