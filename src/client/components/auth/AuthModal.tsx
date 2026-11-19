import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../../shared/types/auth';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
}) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('visitor');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const res = await login(username, password);
        if (!res.ok) {
          setError(res.error || 'Login failed');
        } else {
          onClose();
        }
      } else {
        const res = await register(username, email, password, role);
        if (!res.ok) {
          setError(res.error || 'Registration failed');
        } else {
          onClose();
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(4, 7, 17, 0.78)',
        backdropFilter: 'blur(12px)',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(8, 13, 26, 0.98))',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '18px',
          padding: '2rem',
          color: '#f8fafc',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600, letterSpacing: '-0.02em' }}>
            {mode === 'login' ? 'Sign In to Dreamerize' : 'Create Account'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.35rem',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              padding: '0.65rem 0.85rem',
              borderRadius: '10px',
              fontSize: '0.875rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="username" style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
              Username
            </label>
            <input
              id="username"
              name="username"
              data-testid="username-input"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background: 'rgba(15, 23, 42, 0.8)',
                color: '#f8fafc',
                fontSize: '0.95rem',
              }}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Email
              </label>
              <input
                id="email"
                name="email"
                data-testid="email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@dreamerize.local"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  background: 'rgba(15, 23, 42, 0.8)',
                  color: '#f8fafc',
                  fontSize: '0.95rem',
                }}
              />
            </div>
          )}

          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
              Password
            </label>
            <input
              id="password"
              name="password"
              data-testid="password-input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                background: 'rgba(15, 23, 42, 0.8)',
                color: '#f8fafc',
                fontSize: '0.95rem',
              }}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label htmlFor="role" style={{ display: 'block', fontSize: '0.82rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                Account Role
              </label>
              <select
                id="role"
                name="role"
                data-testid="role-select"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  background: 'rgba(15, 23, 42, 0.9)',
                  color: '#f8fafc',
                  fontSize: '0.95rem',
                }}
              >
                <option value="visitor">Visitor (Explore & Relax)</option>
                <option value="creator">Creator (Curate & Tune Spaces)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            data-testid="auth-submit"
            disabled={submitting}
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              color: '#0f172a',
              fontWeight: 600,
              fontSize: '0.95rem',
              cursor: submitting ? 'wait' : 'pointer',
            }}
          >
            {mode === 'login' ? 'Log in' : 'Register'}
          </button>
        </form>

        <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: '#94a3b8' }}>
          {mode === 'login' ? (
            <>
              New to Dreamerize?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fbbf24',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fbbf24',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
