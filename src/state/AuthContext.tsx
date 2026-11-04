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
};

type AuthContextValue = AuthState & {
  signIn: (token: string, user: CurrentUser) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null, token: null });

  // Session restore on app start (FR-107): a valid stored token silently
  // restores the session; an invalid/expired one falls through to login.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      if (!token) {
        if (!cancelled) setState({ status: 'unauthenticated', user: null, token: null });
        return;
      }
      try {
        const user = await getMe(token);
        if (!cancelled) setState({ status: 'authenticated', user, token });
      } catch (error) {
        // There is no refresh-token endpoint - a 401 means the token is
        // dead, so clear it rather than retrying it. See docs/Rules.md.
        if (error instanceof ApiError && error.status === 401) {
          await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        }
        if (!cancelled) setState({ status: 'unauthenticated', user: null, token: null });
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
      async signIn(token: string, user: CurrentUser) {
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
        setState({ status: 'authenticated', user, token });
      },
      async signOut() {
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        setState({ status: 'unauthenticated', user: null, token: null });
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
