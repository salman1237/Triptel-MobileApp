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
  getPublicSettings: jest.fn().mockResolvedValue({ bangla_qr_image: null, payment_methods: [] }),
}));

jest.mock('../../src/api/auth', () => ({
  getMe: jest.fn(),
  updatePreferences: jest.fn(),
}));

jest.mock('../../src/api/wallets', () => ({
  getMyWallets: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
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
  phone: null,
  full_name: 'Traveler One',
  is_kyc_verified: false,
  preferred_currency: 'EUR',
  avatar_url: null,
  email_verified: true,
  has_google: false,
  wallets: [],
  merchant_profile: null,
  agent_profile: null,
};

async function renderProfile() {
  mockedSecureStore.getItemAsync.mockResolvedValue('existing-token');
  mockedGetMe.mockResolvedValue(meResponseBody);
  mockedGetMyWallets.mockResolvedValue([
    { id: 'w', wallet_type: 'DEFAULT', balance: 10, currency: 'EUR', is_frozen: false },
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

// FR-1302 - user can switch display currency from the profile screen, the
// choice applies immediately, and persists via PUT /auth/me/preferences
// when signed in (so it follows the account across devices, matching the
// web's setCurrency in src/lib/AppSettingsContext.tsx).
describe('Currency switcher (FR-1302)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a chip for every supported currency, with the default selected', async () => {
    const { findByTestId } = await renderProfile();
    for (const code of ['EUR', 'USD', 'BDT', 'GBP', 'AED', 'SAR']) {
      expect(await findByTestId(`profile-currency-${code}`)).toBeTruthy();
    }
    // AppSettingsContext's own default (BDT) applies here since this test
    // renders ProfileScreen directly, not through app/_layout.tsx's
    // CurrencySync that would otherwise pull in the account's EUR preference.
    const defaultChip = await findByTestId('profile-currency-BDT');
    expect(defaultChip.props.accessibilityState.selected).toBe(true);
  });

  it('switching currency updates the selected chip and the displayed wallet balance', async () => {
    mockedUpdatePreferences.mockResolvedValue({ status: 'success', preferred_currency: 'USD', phone: null });
    const { findByTestId } = await renderProfile();

    const usdChip = await findByTestId('profile-currency-USD');
    await fireEvent.press(usdChip);

    await waitFor(async () => {
      expect((await findByTestId('profile-currency-USD')).props.accessibilityState.selected).toBe(true);
    });
    expect((await findByTestId('profile-currency-BDT')).props.accessibilityState.selected).toBe(false);
    expect((await findByTestId('profile-wallet-balance')).props.children).toBe('$10.00');
  });

  it('persists the new currency server-side for a signed-in account', async () => {
    mockedUpdatePreferences.mockResolvedValue({ status: 'success', preferred_currency: 'GBP', phone: null });
    const { findByTestId } = await renderProfile();

    await fireEvent.press(await findByTestId('profile-currency-GBP'));

    await waitFor(() =>
      expect(mockedUpdatePreferences).toHaveBeenCalledWith('existing-token', { preferred_currency: 'GBP' })
    );
  });

  it('does not call the preferences endpoint when nobody is signed in', async () => {
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

    // Signed out shows the sign-in prompt instead of the switcher - this
    // confirms the switcher isn't reachable without a session, not that a
    // press is silently swallowed.
    expect(await findByTestId('profile-not-signed-in')).toBeTruthy();
    expect(mockedUpdatePreferences).not.toHaveBeenCalled();
  });
});
