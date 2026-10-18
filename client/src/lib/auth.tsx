import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import { api, ApiError, onUnauthorized, setCsrfToken } from './api';
import type { User } from './types';

interface Session {
  user: User;
  csrfToken: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setCsrf: (token: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const s = await api.get<Session>('/auth/me');
        setCsrfToken(s.csrfToken);
        return s;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setCsrfToken(null);
          return null;
        }
        throw err;
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  const clear = useCallback(() => {
    setCsrfToken(null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    qc.setQueryData(['me'], null);
  }, [qc]);

  useEffect(() => onUnauthorized(clear), [clear]);

  const login = useCallback(
    async (username: string, password: string) => {
      const s = await api.post<Session>('/auth/login', { username, password });
      setCsrfToken(s.csrfToken);
      qc.setQueryData(['me'], s);
    },
    [qc],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clear();
    }
  }, [clear]);

  const setCsrf = useCallback(
    (token: string) => {
      setCsrfToken(token);
      const cur = qc.getQueryData<Session | null>(['me']);
      if (cur) qc.setQueryData(['me'], { ...cur, csrfToken: token });
    },
    [qc],
  );

  return (
    <AuthContext.Provider
      value={{ user: me.data?.user ?? null, isLoading: me.isLoading, login, logout, setCsrf }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
