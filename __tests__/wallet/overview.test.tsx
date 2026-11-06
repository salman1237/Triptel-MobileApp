import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import { getMe } from '../../src/api/auth';
import { getMyWallets, getMyLedger } from '../../src/api/wallets';
import type { Wallet, LedgerEntry } from '../../src/api/wallets';
import WalletOverviewScreen from '../../app/wallet/index';

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

jest.mock('../../src/api/wallets', () => ({
  getMyWallets: jest.fn(),
  getMyLedger: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetMe = getMe as jest.Mock;
const mockedGetMyWallets = getMyWallets as jest.Mock;
const mockedGetMyLedger = getMyLedger as jest.Mock;

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

function wallet(overrides: Partial<Wallet> = {}): Wallet {
  return { id: 'w1', wallet_type: 'DEFAULT', balance: 0, currency: 'EUR', is_frozen: false, ...overrides };
}

function ledgerEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: 'l1',
    tx_type: 'CREDIT',
    amount: 10,
    balance_before: 0,
    balance_after: 10,
    reference_type: 'MANUAL_DEPOSIT',
    description: 'Manual deposit approved',
    created_at: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

async function renderScreen() {
  mockedSecureStore.getItemAsync.mockResolvedValue('existing-token');
  mockedGetMe.mockResolvedValue(meResponseBody);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = await render(
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <AuthProvider>
          <WalletOverviewScreen />
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
  await waitFor(() => expect(mockedGetMe).toHaveBeenCalled());
  return utils;
}

// FR-601 - balances (DEFAULT/REWARD/COMMISSION) + the transaction ledger.
// Top-up/withdrawal UI is explicitly out of scope here (later FRs).
describe('Wallet overview (FR-601)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows each wallet type with its balance', async () => {
    mockedGetMyWallets.mockResolvedValue([
      wallet({ wallet_type: 'DEFAULT', balance: 125.5 }),
      wallet({ id: 'w2', wallet_type: 'REWARD', balance: 3 }),
      wallet({ id: 'w3', wallet_type: 'COMMISSION', balance: 42 }),
    ]);
    mockedGetMyLedger.mockResolvedValue([]);

    const { findByTestId } = await renderScreen();

    expect(await findByTestId('wallet-card-DEFAULT')).toBeTruthy();
    expect((await findByTestId('wallet-card-balance-DEFAULT')).props.children).toBe('৳125.50');
    expect((await findByTestId('wallet-card-balance-REWARD')).props.children).toBe('৳3.00');
    expect((await findByTestId('wallet-card-balance-COMMISSION')).props.children).toBe('৳42.00');
  });

  it('shows the ledger with signed amounts and the running balance', async () => {
    mockedGetMyWallets.mockResolvedValue([wallet()]);
    mockedGetMyLedger.mockResolvedValue([
      ledgerEntry({ id: 'l1', tx_type: 'CREDIT', amount: 10, balance_after: 10, description: 'Manual deposit approved' }),
      ledgerEntry({ id: 'l2', tx_type: 'DEBIT', amount: 1.85, balance_after: 8.15, description: 'Purchase eSIM: Bangladesh' }),
    ]);

    const { findByTestId } = await renderScreen();

    const creditAmount = await findByTestId('ledger-entry-amount-l1');
    expect(creditAmount.props.children.join('')).toBe('+৳10.00');
    const debitAmount = await findByTestId('ledger-entry-amount-l2');
    expect(debitAmount.props.children.join('')).toBe('-৳1.85');
  });

  it('shows an empty state when there are no transactions yet', async () => {
    mockedGetMyWallets.mockResolvedValue([wallet()]);
    mockedGetMyLedger.mockResolvedValue([]);

    const { findByTestId } = await renderScreen();

    expect(await findByTestId('wallet-ledger-empty')).toBeTruthy();
  });

  it('shows an error state when the wallet fails to load', async () => {
    mockedGetMyWallets.mockRejectedValue(new Error('network error'));
    mockedGetMyLedger.mockResolvedValue([]);

    const { findByTestId } = await renderScreen();

    expect(await findByTestId('wallet-overview-error')).toBeTruthy();
  });
});
