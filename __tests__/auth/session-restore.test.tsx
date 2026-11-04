import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider, useAuth, AUTH_TOKEN_KEY } from '../../src/state/AuthContext';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

const meResponseBody = {
  id: 'u1',
  email: 'traveler@example.com',
  username: 'traveler',
  role: 'USER',
  status: 'ACTIVE',
  phone: null,
  full_name: null,
  is_kyc_verified: false,
  preferred_currency: 'EUR',
  avatar_url: null,
  email_verified: true,
  has_google: false,
  wallets: [],
  merchant_profile: null,
  agent_profile: null,
};

function Probe() {
  const { status, user } = useAuth();
  return <Text testID="status">{`${status}:${user?.username ?? ''}`}</Text>;
}

// @testing-library/react-native v14's render() is async.
function renderWithProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

describe('session restore on app start (FR-107)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    globalThis.fetch = jest.fn();
  });

  it('silently restores the session when a valid token is stored', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue('valid-token');
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(meResponseBody),
    });

    const { getByTestId } = await renderWithProvider();

    await waitFor(() => expect(getByTestId('status').props.children).toBe('authenticated:traveler'));

    const [calledUrl, calledInit] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(calledUrl).toContain('/auth/me');
    expect(calledInit.headers.Authorization).toBe('Bearer valid-token');
    expect(mockedSecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('falls through to login with no network call when no token is stored', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    const { getByTestId } = await renderWithProvider();

    await waitFor(() => expect(getByTestId('status').props.children).toBe('unauthenticated:'));
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('clears an expired/invalid token on a 401 and falls through to login', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue('expired-token');
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ detail: 'Could not validate authentication credentials' }),
    });

    const { getByTestId } = await renderWithProvider();

    await waitFor(() => expect(getByTestId('status').props.children).toBe('unauthenticated:'));
    expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalledWith(AUTH_TOKEN_KEY);
  });
});
