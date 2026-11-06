import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import { getMe } from '../../src/api/auth';
import { getWithdrawalConfig, getPayoutAccounts, createWithdrawal } from '../../src/api/withdrawals';
import type { WithdrawalConfig, PayoutAccount } from '../../src/api/withdrawals';
import { ApiError } from '../../src/lib/apiClient';
import WithdrawalRequestScreen from '../../app/withdrawals/request';

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
}));

jest.mock('../../src/api/withdrawals', () => ({
  getWithdrawalConfig: jest.fn(),
  getPayoutAccounts: jest.fn(),
  createWithdrawal: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetMe = getMe as jest.Mock;
const mockedGetWithdrawalConfig = getWithdrawalConfig as jest.Mock;
const mockedGetPayoutAccounts = getPayoutAccounts as jest.Mock;
const mockedCreateWithdrawal = createWithdrawal as jest.Mock;

const meResponseBody = {
  id: 'u1',
  email: 'traveler@example.com',
  username: 'traveler',
  role: 'USER',
  status: 'ACTIVE',
  phone: null,
  full_name: 'Traveler One',
  is_kyc_verified: true,
  preferred_currency: 'EUR',
  avatar_url: null,
  email_verified: true,
  has_google: false,
  wallets: [],
  merchant_profile: null,
  agent_profile: null,
};

function config(overrides: Partial<WithdrawalConfig> = {}): WithdrawalConfig {
  return {
    min_amount: 5,
    max_amount: 500,
    fee_type: 'flat',
    fee_value: 1,
    payout_currency: 'BDT',
    processing_time: '2-3 business days',
    is_enabled: true,
    base_currency: 'EUR',
    note_categories: ['withdrawal', 'other'],
    balance: 100,
    can_withdraw: true,
    blockers: [],
    kyc_verified: true,
    kyc_status: 'APPROVED',
    account_count: 1,
    ...overrides,
  };
}

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
          <WithdrawalRequestScreen />
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
  await waitFor(() => expect(mockedGetMe).toHaveBeenCalled());
  return utils;
}

// FR-702 - a live fee/min/max preview, and blocked behind KYC with the
// backend's own clear blocker text (no link to a KYC screen - FR-1002
// isn't built, see DECISIONS.md).
describe('Withdrawal request (FR-702)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows blockers and disables the amount field when the user cannot withdraw', async () => {
    mockedGetWithdrawalConfig.mockResolvedValue(
      config({ can_withdraw: false, kyc_verified: false, blockers: ['Complete KYC verification first.'] })
    );
    mockedGetPayoutAccounts.mockResolvedValue([account()]);

    const { findByTestId } = await renderScreen();

    expect((await findByTestId('withdrawal-blocker-Complete KYC verification first.')).props.children.join('')).toContain(
      'Complete KYC verification first.'
    );
    expect((await findByTestId('withdrawal-amount-input')).props.editable).toBe(false);
  });

  it('shows a live fee/net preview as the amount changes', async () => {
    mockedGetWithdrawalConfig.mockResolvedValue(config({ fee_type: 'flat', fee_value: 2 }));
    mockedGetPayoutAccounts.mockResolvedValue([account()]);

    const { findByTestId } = await renderScreen();
    fireEvent.changeText(await findByTestId('withdrawal-amount-input'), '50');

    const fee = await findByTestId('withdrawal-preview-fee');
    expect(fee.props.children.join('')).toContain('2.00');
    const net = await findByTestId('withdrawal-preview-net');
    expect(net.props.children).toBe('€48.00');
  });

  it('computes a percent fee correctly', async () => {
    mockedGetWithdrawalConfig.mockResolvedValue(config({ fee_type: 'percent', fee_value: 10 }));
    mockedGetPayoutAccounts.mockResolvedValue([account()]);

    const { findByTestId } = await renderScreen();
    fireEvent.changeText(await findByTestId('withdrawal-amount-input'), '50');

    const net = await findByTestId('withdrawal-preview-net');
    expect(net.props.children).toBe('€45.00');
  });

  it('rejects an amount above the available balance before submitting', async () => {
    mockedGetWithdrawalConfig.mockResolvedValue(config({ balance: 20, max_amount: 500 }));
    mockedGetPayoutAccounts.mockResolvedValue([account()]);

    const { findByTestId } = await renderScreen();
    fireEvent.changeText(await findByTestId('withdrawal-amount-input'), '50');

    expect((await findByTestId('withdrawal-amount-error')).props.children).toContain('available balance');
    expect((await findByTestId('withdrawal-submit')).props.accessibilityState.disabled).toBe(true);
  });

  it('submits the request and shows the reference number', async () => {
    mockedGetWithdrawalConfig.mockResolvedValue(config());
    mockedGetPayoutAccounts.mockResolvedValue([account()]);
    mockedCreateWithdrawal.mockResolvedValue({
      id: 'w1',
      reference_no: 'WD-00001',
      amount: '50',
      fee_amount: '1',
      net_amount: '49',
      status: 'PENDING',
    });

    const { findByTestId } = await renderScreen();
    fireEvent.changeText(await findByTestId('withdrawal-amount-input'), '50');
    await fireEvent.press(await findByTestId('withdrawal-submit'));

    expect(mockedCreateWithdrawal).toHaveBeenCalledWith('existing-token', {
      amount: 50,
      bankAccountId: 'a1',
      noteCategory: 'withdrawal',
      note: undefined,
    });
    const reference = await findByTestId('withdrawal-request-reference');
    expect(reference.props.children.join('')).toContain('WD-00001');
  });

  it('shows the backend error when the request is rejected', async () => {
    mockedGetWithdrawalConfig.mockResolvedValue(config());
    mockedGetPayoutAccounts.mockResolvedValue([account()]);
    mockedCreateWithdrawal.mockRejectedValue(new ApiError(400, 'Your balance is lower than the amount requested.'));

    const { findByTestId } = await renderScreen();
    fireEvent.changeText(await findByTestId('withdrawal-amount-input'), '50');
    await fireEvent.press(await findByTestId('withdrawal-submit'));

    const error = await findByTestId('withdrawal-submit-error');
    expect(error.props.children).toBe('Your balance is lower than the amount requested.');
  });
});
