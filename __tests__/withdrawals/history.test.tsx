import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import { getMe } from '../../src/api/auth';
import { getMyWithdrawals, cancelWithdrawal } from '../../src/api/withdrawals';
import type { Withdrawal } from '../../src/api/withdrawals';
import { ApiError } from '../../src/lib/apiClient';
import WithdrawalHistoryScreen from '../../app/withdrawals/history';

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
  getMyWithdrawals: jest.fn(),
  cancelWithdrawal: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetMe = getMe as jest.Mock;
const mockedGetMyWithdrawals = getMyWithdrawals as jest.Mock;
const mockedCancelWithdrawal = cancelWithdrawal as jest.Mock;

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

function withdrawal(overrides: Partial<Withdrawal> = {}): Withdrawal {
  return {
    id: 'w1',
    reference_no: 'WD-00001',
    amount: 50,
    fee_amount: 1,
    net_amount: 49,
    note_category: 'withdrawal',
    note: null,
    account_line: 'bKash · 01712345678 (Traveler One)',
    status: 'PENDING',
    payout_currency: 'BDT',
    conversion_rate: null,
    payout_amount: null,
    payment_reference: null,
    has_proof: false,
    rejection_reason: null,
    reviewed_at: null,
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
          <WithdrawalHistoryScreen />
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
  await waitFor(() => expect(mockedGetMe).toHaveBeenCalled());
  return utils;
}

// FR-703 - withdrawal status history, and cancelling a still-PENDING
// request.
describe('Withdrawal history (FR-703)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows an empty state with no withdrawals yet', async () => {
    mockedGetMyWithdrawals.mockResolvedValue([]);

    const { findByTestId } = await renderScreen();

    expect(await findByTestId('withdrawal-history-empty')).toBeTruthy();
  });

  it('shows the right status label for each status', async () => {
    mockedGetMyWithdrawals.mockResolvedValue([
      withdrawal({ id: 'w1', status: 'PENDING' }),
      withdrawal({ id: 'w2', status: 'PAID', payout_amount: 5500, conversion_rate: 110 }),
      withdrawal({ id: 'w3', status: 'REJECTED', rejection_reason: 'Account details could not be verified' }),
      withdrawal({ id: 'w4', status: 'CANCELLED' }),
    ]);

    const { findByTestId } = await renderScreen();

    expect((await findByTestId('withdrawal-history-status-w1')).props.children.props.children).toBe('Awaiting review');
    expect((await findByTestId('withdrawal-history-status-w2')).props.children.props.children).toBe('Paid');
    expect((await findByTestId('withdrawal-history-status-w3')).props.children.props.children).toBe('Not approved');
    expect((await findByTestId('withdrawal-history-status-w4')).props.children.props.children).toBe('Cancelled');
  });

  it('shows the payout amount, currency, and conversion rate for a PAID withdrawal', async () => {
    mockedGetMyWithdrawals.mockResolvedValue([
      withdrawal({ id: 'w2', status: 'PAID', payout_amount: 5500, payout_currency: 'BDT', conversion_rate: 110 }),
    ]);

    const { findByTestId } = await renderScreen();
    const payoutNote = await findByTestId('withdrawal-history-payout-w2');
    const text = payoutNote.props.children.join('');
    expect(text).toContain('5,500');
    expect(text).toContain('BDT');
    expect(text).toContain('110.00');
  });

  it('shows the rejection reason for a REJECTED withdrawal', async () => {
    mockedGetMyWithdrawals.mockResolvedValue([
      withdrawal({ id: 'w3', status: 'REJECTED', rejection_reason: 'Account details could not be verified' }),
    ]);

    const { findByTestId } = await renderScreen();
    expect((await findByTestId('withdrawal-history-rejection-w3')).props.children).toBe(
      'Account details could not be verified'
    );
  });

  it('cancels a PENDING withdrawal and refreshes the list', async () => {
    mockedGetMyWithdrawals.mockResolvedValue([withdrawal({ id: 'w1', status: 'PENDING' })]);
    mockedCancelWithdrawal.mockResolvedValue(withdrawal({ id: 'w1', status: 'CANCELLED' }));

    const { findByTestId } = await renderScreen();
    await fireEvent.press(await findByTestId('withdrawal-history-cancel-w1'));

    expect(mockedCancelWithdrawal).toHaveBeenCalledWith('existing-token', 'w1');
  });

  it('does not show a Cancel action for a non-PENDING withdrawal', async () => {
    mockedGetMyWithdrawals.mockResolvedValue([withdrawal({ id: 'w2', status: 'PAID' })]);

    const { queryByTestId, findByTestId } = await renderScreen();
    await findByTestId('withdrawal-history-item-w2');

    expect(queryByTestId('withdrawal-history-cancel-w2')).toBeNull();
  });

  it('shows the backend error when cancellation fails', async () => {
    mockedGetMyWithdrawals.mockResolvedValue([withdrawal({ id: 'w1', status: 'PENDING' })]);
    mockedCancelWithdrawal.mockRejectedValue(new ApiError(400, 'This request is already paid.'));

    const { findByTestId } = await renderScreen();
    await fireEvent.press(await findByTestId('withdrawal-history-cancel-w1'));

    const error = await findByTestId('withdrawal-history-row-error');
    expect(error.props.children).toBe('This request is already paid.');
  });
});
