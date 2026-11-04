import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import PackageBrowser from '../../src/components/PackageBrowser';
import { getMyWallets } from '../../src/api/wallets';
import { getMe } from '../../src/api/auth';
import type { Product } from '../../src/api/catalog';
import type { Wallet } from '../../src/api/wallets';

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
}));

jest.mock('../../src/api/discounts', () => ({
  checkDiscountCode: jest.fn(),
  previewDiscount: jest.fn(),
}));

jest.mock('../../src/api/wallets', () => ({
  getMyWallets: jest.fn(),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetMe = getMe as jest.Mock;
const mockedGetMyWallets = getMyWallets as jest.Mock;

const products: Product[] = [
  {
    id: 'p1',
    country_id: 1,
    title_en: 'Starter',
    title_bn: null,
    data_amount_gb: 3,
    validity_days: 7,
    retail_price: 10,
    currency: 'EUR',
    is_unlimited: false,
    is_active: true,
    is_featured: false,
    coverage_networks: null,
  },
];

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

function wallet(overrides: Partial<Wallet>): Wallet {
  return {
    id: 'w',
    wallet_type: 'DEFAULT',
    balance: 0,
    currency: 'EUR',
    is_frozen: false,
    ...overrides,
  };
}

async function renderAuthenticatedBrowser() {
  mockedSecureStore.getItemAsync.mockResolvedValue('existing-token');
  mockedGetMe.mockResolvedValue(meResponseBody);

  const utils = await render(
    <AppSettingsProvider>
      <AuthProvider>
        <PackageBrowser products={products} />
      </AuthProvider>
    </AppSettingsProvider>
  );
  await waitFor(() => expect(mockedGetMe).toHaveBeenCalled());
  return utils;
}

describe('Payment method choice (FR-304)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the Wallet-vs-Gateway chooser when the wallet covers the price', async () => {
    mockedGetMyWallets.mockResolvedValue([
      wallet({ wallet_type: 'DEFAULT', balance: 7 }),
      wallet({ wallet_type: 'REWARD', balance: 5 }),
    ]);

    const { getByTestId, findByTestId } = await renderAuthenticatedBrowser();

    await fireEvent.press(getByTestId('package-buy-now-p1'));

    expect(await findByTestId('payment-method-chooser')).toBeTruthy();
    expect(mockedGetMyWallets).toHaveBeenCalledWith('existing-token');
  });

  it('goes straight to the gateway, with no chooser, when the wallet cannot cover the price', async () => {
    mockedGetMyWallets.mockResolvedValue([wallet({ wallet_type: 'DEFAULT', balance: 3 })]);

    const { getByTestId, findByTestId, queryByTestId } = await renderAuthenticatedBrowser();

    await fireEvent.press(getByTestId('package-buy-now-p1'));

    expect(await findByTestId('package-going-to-gateway-p1')).toBeTruthy();
    expect(queryByTestId('payment-method-chooser')).toBeNull();
  });

  it('excludes frozen and COMMISSION wallets from the spendable balance', async () => {
    mockedGetMyWallets.mockResolvedValue([
      wallet({ wallet_type: 'DEFAULT', balance: 100, is_frozen: true }),
      wallet({ wallet_type: 'COMMISSION', balance: 100 }),
      wallet({ wallet_type: 'REWARD', balance: 3 }),
    ]);

    const { getByTestId, findByTestId, queryByTestId } = await renderAuthenticatedBrowser();

    await fireEvent.press(getByTestId('package-buy-now-p1'));

    // Only the 3 EUR REWARD wallet is spendable - well short of the 10 EUR
    // price - so this must go to the gateway, not open the chooser.
    expect(await findByTestId('package-going-to-gateway-p1')).toBeTruthy();
    expect(queryByTestId('payment-method-chooser')).toBeNull();
  });

  it('records the choice and closes the chooser when Wallet is picked', async () => {
    mockedGetMyWallets.mockResolvedValue([wallet({ wallet_type: 'DEFAULT', balance: 50 })]);

    const { getByTestId, findByTestId, queryByTestId } = await renderAuthenticatedBrowser();

    await fireEvent.press(getByTestId('package-buy-now-p1'));
    await findByTestId('payment-method-chooser');

    await fireEvent.press(getByTestId('payment-method-wallet'));

    await waitFor(() => expect(queryByTestId('payment-method-chooser')).toBeNull());
    expect(await findByTestId('package-selected-method-p1')).toBeTruthy();
  });
});
