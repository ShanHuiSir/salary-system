import { useState, useEffect, useCallback } from 'react';
import {
  clearAuthSession,
  getAuthSession,
  getCurrentUser,
  loginWithPassword,
  logoutFromServer,
  type AuthUser,
} from '@/lib/api';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => getAuthSession()?.user ?? null);
  const [checking, setChecking] = useState(() => Boolean(getAuthSession()?.accessToken));

  useEffect(() => {
    let cancelled = false;
    const session = getAuthSession();

    if (!session?.accessToken) return;

    getCurrentUser()
      .then((currentUser) => {
        if (!cancelled) setUser(currentUser);
      })
      .catch(() => {
        clearAuthSession();
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const loggedInUser = await loginWithPassword(username, password);
      setUser(loggedInUser);
      return true;
    } catch {
      setUser(null);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await logoutFromServer();
    setUser(null);
  }, []);

  return { isAuthenticated: Boolean(user), checking, user, login, logout };
}
