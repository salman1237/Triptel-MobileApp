import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import { getMe, updatePreferences } from '../../src/api/auth';
import { getMyWallets } from '../../src/api/wallets';
import ProfileScreen from '../../app/(tabs)/profile';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/api/settings', () => ({
  getLanguages: jest.fn().mockResolvedValue([]),
  getTranslations: jest.fn().mockResolvedValue({ language_code: 'en', namespaces: {} }),
  getRates: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../src/api/auth', () => ({
  getMe: jest.fn(),
  updatePreferences: jest.fn(),
}));

jest.mock('../../src/api/wallets', () => ({
  getMyWallets: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetMe = getMe as jest.Mock;
const mockedUpdatePreferences = updatePreferences as jest.Mock;
const mockedGetMyWallets = getMyWallets as jest.Mock;

const meResponseBody = {
  id: 'u1',
  email: 'traveler@example.com',
  username: 'traveler',
  role: 'USER',
  status: 'ACTIVE',
  phone: '+8801111111111',
  full_name: 'Traveler One',
  is_kyc_verified: false,
  preferred_currency: 'EUR',
  avatar_url: null,
  email_verified: true,
  has_google: true,
  wallets: [],
  merchant_profile: null,
  agent_profile: null,
};

function wallet(overrides: Partial<{ id: string; wallet_type: string; balance: number; currency: string; is_frozen: boolean }>) {
  return {
    id: 'w',
    wallet_type: 'DEFAULT',
    balance: 0,
    currency: 'EUR',
    is_frozen: false,
    ...overrides,
  };
}

async function renderProfile() {
  mockedSecureStore.getItemAsync.mockResolvedValue('existing-token');
  mockedGetMe.mockResolvedValue(meResponseBody);
  mockedGetMyWallets.mockResolvedValue([
    wallet({ wallet_type: 'DEFAULT', balance: 12 }),
    wallet({ wallet_type: 'REWARD', balance: 3 }),
    wallet({ wallet_type: 'COMMISSION', balance: 100 }),
  ]);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = await render(
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <AuthProvider>
          <ProfileScreen />
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
  await waitFor(() => expect(mockedGetMe).toHaveBeenCalled());
  return utils;
}

describe('Profile screen (FR-1001)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the signed-in user: name, role, email verification, and Google badge', async () => {
    const { findByTestId } = await renderProfile();

    expect((await findByTestId('profile-name')).props.children).toBe('Traveler One');
    expect((await findByTestId('profile-role')).props.children).toBe('USER');
    expect((await findByTestId('profile-email')).props.children).toBe('traveler@example.com');
    expect((await findByTestId('profile-email-verified-badge')).props.children).toBe('Verified');
    expect(await findByTestId('profile-google-badge')).toBeTruthy();
  });

  it('shows the spendable wallet balance, excluding COMMISSION', async () => {
    const { findByTestId } = await renderProfile();

    // DEFAULT 12 + REWARD 3 = 15 EUR spendable; COMMISSION's 100 excluded.
    // Exact match, not .toContain - "115.00" also contains the substring
    // "15.00", which would hide a wallet-filter regression.
    const balance = await findByTestId('profile-wallet-balance');
    expect(balance.props.children).toBe('৳15.00');
  });

  it('saves an edited phone number and shows a confirmation', async () => {
    mockedUpdatePreferences.mockResolvedValue({ status: 'success', preferred_currency: 'EUR', phone: '+8802222222222' });

    const { getByTestId, findByTestId } = await renderProfile();

    await fireEvent.changeText(getByTestId('profile-phone-input'), '+8802222222222');
    await fireEvent.press(getByTestId('profile-phone-save'));

    expect(mockedUpdatePreferences).toHaveBeenCalledWith('existing-token', { phone: '+8802222222222' });
    expect(await findByTestId('profile-phone-saved')).toBeTruthy();
  });

  it('signs out and routes home', async () => {
    const { getByTestId } = await renderProfile();

    await fireEvent.press(getByTestId('profile-sign-out'));

    await waitFor(() => expect(mockedSecureStore.deleteItemAsync).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('shows a sign-in prompt instead of crashing when nobody is signed in', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { findByTestId } = await render(
      <QueryClientProvider client={queryClient}>
        <AppSettingsProvider>
          <AuthProvider>
            <ProfileScreen />
          </AuthProvider>
        </AppSettingsProvider>
      </QueryClientProvider>
    );

    expect(await findByTestId('profile-not-signed-in')).toBeTruthy();
  });
});
