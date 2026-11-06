import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import { getMe } from '../../src/api/auth';
import {
  getPayoutAccounts,
  addPayoutAccount,
  setDefaultPayoutAccount,
  deletePayoutAccount,
} from '../../src/api/withdrawals';
import type { PayoutAccount } from '../../src/api/withdrawals';
import { ApiError } from '../../src/lib/apiClient';
import PayoutAccountsScreen from '../../app/withdrawals/accounts';

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

jest.mock('../../src/api/withdrawals', () => ({
  getPayoutAccounts: jest.fn(),
  addPayoutAccount: jest.fn(),
  setDefaultPayoutAccount: jest.fn(),
  deletePayoutAccount: jest.fn(),
  MAX_PAYOUT_ACCOUNTS: 5,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetMe = getMe as jest.Mock;
const mockedGetPayoutAccounts = getPayoutAccounts as jest.Mock;
const mockedAddPayoutAccount = addPayoutAccount as jest.Mock;
const mockedSetDefaultPayoutAccount = setDefaultPayoutAccount as jest.Mock;
const mockedDeletePayoutAccount = deletePayoutAccount as jest.Mock;

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

function account(overrides: Partial<PayoutAccount> = {}): PayoutAccount {
  return {
    id: 'a1',
    account_type: 'MOBILE',
    bank_name: 'bKash',
    holder_name: 'Traveler One',
    account_number: '01712345678',
    branch_name: null,
    routing_number: null,
    is_default: true,
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
          <PayoutAccountsScreen />
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
  await waitFor(() => expect(mockedGetMe).toHaveBeenCalled());
  return utils;
}

// FR-701 - add/remove/set-default up to 5 payout accounts. The withdrawal
// request form and history (FR-702/703) are separate, later FRs - not
// exercised here.
describe('Payout accounts (FR-701)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows an empty state with no saved accounts', async () => {
    mockedGetPayoutAccounts.mockResolvedValue([]);

    const { findByTestId } = await renderScreen();

    expect(await findByTestId('payout-accounts-empty')).toBeTruthy();
  });

  it('shows each saved account with the default badge on the right one', async () => {
    mockedGetPayoutAccounts.mockResolvedValue([
      account({ id: 'a1', bank_name: 'bKash', account_number: '01712345678', is_default: true }),
      account({ id: 'a2', bank_name: 'City Bank', account_number: '9988776655', is_default: false }),
    ]);

    const { findByTestId, queryByTestId } = await renderScreen();

    expect((await findByTestId('payout-account-number-a1')).props.children).toBe('01712345678');
    expect(await findByTestId('payout-account-default-a1')).toBeTruthy();
    expect(queryByTestId('payout-account-default-a2')).toBeNull();
  });

  it('adds a new account and refreshes the list', async () => {
    mockedGetPayoutAccounts.mockResolvedValue([]);
    mockedAddPayoutAccount.mockResolvedValue(account({ id: 'a1' }));

    const { findByTestId } = await renderScreen();
    await fireEvent.press(await findByTestId('payout-accounts-add-button'));
    fireEvent.changeText(await findByTestId('payout-account-bank-name-input'), 'bKash');
    fireEvent.changeText(await findByTestId('payout-account-holder-name-input'), 'Traveler One');
    fireEvent.changeText(await findByTestId('payout-account-number-input'), '01712345678');

    mockedGetPayoutAccounts.mockResolvedValue([account({ id: 'a1' })]);
    await fireEvent.press(await findByTestId('payout-account-form-save'));

    expect(mockedAddPayoutAccount).toHaveBeenCalledWith('existing-token', {
      account_type: 'MOBILE',
      bank_name: 'bKash',
      holder_name: 'Traveler One',
      account_number: '01712345678',
      branch_name: null,
      routing_number: null,
    });
    expect(await findByTestId('payout-account-a1')).toBeTruthy();
  });

  it('keeps the save button disabled until the required fields are filled', async () => {
    mockedGetPayoutAccounts.mockResolvedValue([]);

    const { findByTestId } = await renderScreen();
    await fireEvent.press(await findByTestId('payout-accounts-add-button'));

    expect((await findByTestId('payout-account-form-save')).props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(await findByTestId('payout-account-bank-name-input'), 'bKash');
    fireEvent.changeText(await findByTestId('payout-account-holder-name-input'), 'Traveler One');
    fireEvent.changeText(await findByTestId('payout-account-number-input'), '01712345678');

    expect((await findByTestId('payout-account-form-save')).props.accessibilityState.disabled).toBe(false);
  });

  it('sets a different account as default', async () => {
    mockedGetPayoutAccounts.mockResolvedValue([
      account({ id: 'a1', is_default: true }),
      account({ id: 'a2', bank_name: 'City Bank', is_default: false }),
    ]);
    mockedSetDefaultPayoutAccount.mockResolvedValue({ status: 'success' });

    const { findByTestId } = await renderScreen();
    await fireEvent.press(await findByTestId('payout-account-set-default-a2'));

    expect(mockedSetDefaultPayoutAccount).toHaveBeenCalledWith('existing-token', 'a2');
  });

  it('removes an account', async () => {
    mockedGetPayoutAccounts.mockResolvedValue([account({ id: 'a1' })]);
    mockedDeletePayoutAccount.mockResolvedValue({ status: 'success' });

    const { findByTestId } = await renderScreen();
    await fireEvent.press(await findByTestId('payout-account-remove-a1'));

    expect(mockedDeletePayoutAccount).toHaveBeenCalledWith('existing-token', 'a1');
  });

  it('shows the backend error when a duplicate account is rejected', async () => {
    mockedGetPayoutAccounts.mockResolvedValue([]);
    mockedAddPayoutAccount.mockRejectedValue(new ApiError(400, 'That account is already saved.'));

    const { findByTestId } = await renderScreen();
    await fireEvent.press(await findByTestId('payout-accounts-add-button'));
    fireEvent.changeText(await findByTestId('payout-account-bank-name-input'), 'bKash');
    fireEvent.changeText(await findByTestId('payout-account-holder-name-input'), 'Traveler One');
    fireEvent.changeText(await findByTestId('payout-account-number-input'), '01712345678');
    await fireEvent.press(await findByTestId('payout-account-form-save'));

    const error = await findByTestId('payout-account-form-error');
    expect(error.props.children).toBe('That account is already saved.');
  });

  it('hides the Add account button once 5 accounts are saved', async () => {
    mockedGetPayoutAccounts.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => account({ id: `a${i}`, is_default: i === 0 }))
    );

    const { queryByTestId, findByTestId } = await renderScreen();
    await findByTestId('payout-account-a0');

    expect(queryByTestId('payout-accounts-add-button')).toBeNull();
  });
});
