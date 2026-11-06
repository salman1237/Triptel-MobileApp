import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import { getMe } from '../../src/api/auth';
import { getPublicSettings } from '../../src/api/settings';
import { submitManualDeposit } from '../../src/api/wallets';
import { ApiError } from '../../src/lib/apiClient';
import ManualDepositScreen from '../../app/wallet/manual-deposit';

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
  getPublicSettings: jest.fn(),
}));

jest.mock('../../src/api/auth', () => ({
  getMe: jest.fn(),
}));

jest.mock('../../src/api/wallets', () => ({
  submitManualDeposit: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetMe = getMe as jest.Mock;
const mockedGetPublicSettings = getPublicSettings as jest.Mock;
const mockedSubmitManualDeposit = submitManualDeposit as jest.Mock;

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

const bkashMethod = {
  id: 'pm1',
  name: 'bKash',
  kind: 'mobile' as const,
  account_name: 'Triptel Ltd',
  account_number: '01712345678',
  branch: null,
  instructions: 'Send Money, then submit the transaction ID below.',
  is_active: true,
};

const bankMethod = {
  id: 'pm2',
  name: 'City Bank',
  kind: 'bank' as const,
  account_name: 'Triptel Ltd',
  account_number: '1234567890',
  branch: 'Gulshan',
  instructions: null,
  is_active: true,
};

async function renderScreen() {
  mockedSecureStore.getItemAsync.mockResolvedValue('existing-token');
  mockedGetMe.mockResolvedValue(meResponseBody);

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const utils = await render(
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <AuthProvider>
          <ManualDepositScreen />
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
  await waitFor(() => expect(mockedGetMe).toHaveBeenCalled());
  return utils;
}

// FR-603 - manual deposit (bank/bKash/Nagad/Rocket/QR) with a transaction
// ID, for admin approval. Explicitly not the ShurjoPay gateway top-up
// (FR-602, separate) - this screen only ever submits a PENDING request,
// never credits anything itself.
describe('Manual deposit (FR-603)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows an empty state when no payment methods are configured', async () => {
    mockedGetPublicSettings.mockResolvedValue({ bangla_qr_image: null, payment_methods: [] });

    const { findByTestId } = await renderScreen();

    expect(await findByTestId('manual-deposit-no-methods')).toBeTruthy();
  });

  it('shows the selected method’s account details', async () => {
    mockedGetPublicSettings.mockResolvedValue({ bangla_qr_image: null, payment_methods: [bkashMethod, bankMethod] });

    const { findByTestId } = await renderScreen();

    expect((await findByTestId('manual-deposit-account-number')).props.children).toBe('01712345678');

    fireEvent.press(await findByTestId('manual-deposit-method-City Bank'));

    await waitFor(async () =>
      expect((await findByTestId('manual-deposit-account-number')).props.children).toBe('1234567890')
    );
  });

  it('disables submit until an amount and transaction ID are both entered', async () => {
    mockedGetPublicSettings.mockResolvedValue({ bangla_qr_image: null, payment_methods: [bkashMethod] });

    const { findByTestId } = await renderScreen();
    const submitButton = await findByTestId('manual-deposit-submit');
    expect(submitButton.props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(await findByTestId('manual-deposit-amount-input'), '500');
    expect((await findByTestId('manual-deposit-submit')).props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(await findByTestId('manual-deposit-txid-input'), 'TXN123');
    expect((await findByTestId('manual-deposit-submit')).props.accessibilityState.disabled).toBe(false);
  });

  it('submits the deposit and shows a confirmation screen', async () => {
    mockedGetPublicSettings.mockResolvedValue({ bangla_qr_image: null, payment_methods: [bkashMethod] });
    mockedSubmitManualDeposit.mockResolvedValue({
      id: 'd1',
      amount: 500,
      currency: 'BDT',
      bank_name: 'bKash',
      transaction_id: 'TXN123',
      status: 'PENDING',
      created_at: '2026-01-01T00:00:00Z',
    });

    const { findByTestId } = await renderScreen();
    fireEvent.changeText(await findByTestId('manual-deposit-amount-input'), '500');
    fireEvent.changeText(await findByTestId('manual-deposit-txid-input'), 'TXN123');
    await fireEvent.press(await findByTestId('manual-deposit-submit'));

    expect(await findByTestId('manual-deposit-success')).toBeTruthy();
    expect(mockedSubmitManualDeposit).toHaveBeenCalledWith('existing-token', {
      amount: 500,
      currency: 'BDT',
      bankName: 'bKash',
      transactionId: 'TXN123',
    });
  });

  it('shows the backend’s error message when submission is rejected', async () => {
    mockedGetPublicSettings.mockResolvedValue({ bangla_qr_image: null, payment_methods: [bkashMethod] });
    mockedSubmitManualDeposit.mockRejectedValue(new ApiError(400, 'Transaction ID is required'));

    const { findByTestId } = await renderScreen();
    fireEvent.changeText(await findByTestId('manual-deposit-amount-input'), '500');
    fireEvent.changeText(await findByTestId('manual-deposit-txid-input'), 'TXN123');
    await fireEvent.press(await findByTestId('manual-deposit-submit'));

    const error = await findByTestId('manual-deposit-error');
    expect(error.props.children).toBe('Transaction ID is required');
  });
});
