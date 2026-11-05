import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ApiError } from '../lib/apiClient';
import { getMe } from '../api/auth';
import type { CurrentUser } from '../api/auth';

// The JWT lives here only - never AsyncStorage, never component state outside
// this context. See docs/Rules.md -> "Auth".
export const AUTH_TOKEN_KEY = 'triptel_auth_token';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthState = {
  status: AuthStatus;
  user: CurrentUser | null;
  token: string | null;
  // Only login/register return this (GET /auth/me doesn't - see
  // DECISIONS.md), so a session restored on app start can't know whether a
  // past-due password change is still outstanding. The backend enforces the
  // real boundary server-side on checkout/wallet regardless (FR-105); this
  // is UX gating, not the security boundary.
  mustChangePassword: boolean;
};

type AuthContextValue = AuthState & {
  signIn: (token: string, user: CurrentUser, mustChangePassword?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  clearMustChangePassword: () => void;
  // Merges a partial server response (e.g. PUT /auth/me/preferences) into
  // the signed-in user, so a screen that just saved a change doesn't need
  // to call GET /auth/me again to see its own update reflected.
  updateUser: (partial: Partial<CurrentUser>) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    token: null,
    mustChangePassword: false,
  });

  // Session restore on app start (FR-107): a valid stored token silently
  // restores the session; an invalid/expired one falls through to login.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      if (!token) {
        if (!cancelled) setState({ status: 'unauthenticated', user: null, token: null, mustChangePassword: false });
        return;
      }
      try {
        const user = await getMe(token);
        if (!cancelled) setState({ status: 'authenticated', user, token, mustChangePassword: false });
      } catch (error) {
        // There is no refresh-token endpoint - a 401 means the token is
        // dead, so clear it rather than retrying it. See docs/Rules.md.
        if (error instanceof ApiError && error.status === 401) {
          await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        }
        if (!cancelled) setState({ status: 'unauthenticated', user: null, token: null, mustChangePassword: false });
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      async signIn(token: string, user: CurrentUser, mustChangePassword = false) {
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
        setState({ status: 'authenticated', user, token, mustChangePassword });
      },
      async signOut() {
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        setState({ status: 'unauthenticated', user: null, token: null, mustChangePassword: false });
      },
      clearMustChangePassword() {
        setState((prev) => ({ ...prev, mustChangePassword: false }));
      },
      updateUser(partial: Partial<CurrentUser>) {
        setState((prev) => (prev.user ? { ...prev, user: { ...prev.user, ...partial } } : prev));
      },
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
