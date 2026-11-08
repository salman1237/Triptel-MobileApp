import React from 'react';
import { fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import { getMe } from '../../src/api/auth';
import { getMyEsims } from '../../src/api/esims';
import type { MyEsim } from '../../src/api/esims';
import MyEsimsScreen from '../../app/(tabs)/my-esims/index';

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

jest.mock('../../src/api/esims', () => ({
  getMyEsims: jest.fn(),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetMe = getMe as jest.Mock;
const mockedGetMyEsims = getMyEsims as jest.Mock;
const mockedSetStringAsync = Clipboard.setStringAsync as jest.Mock;

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

function esim(overrides: Partial<MyEsim> = {}): MyEsim {
  return {
    id: 'e1',
    order_no: 'ORD-20261101-ABCDEF',
    product_title: 'Bangladesh 7 Days 5GB',
    data_amount_gb: 5,
    is_unlimited: false,
    validity_days: 7,
    iccid: '8988211000000000001',
    lpa_string: 'LPA:1$esim.example.com$MATCHING-ID-1',
    qr_code_data: 'LPA:1$esim.example.com$MATCHING-ID-1',
    smdp_address: 'esim.example.com',
    status: 'ACTIVE',
    is_mock_fallback: false,
    created_at: '2026-11-01T10:00:00Z',
    activated_at: null,
    expires_at: null,
    is_beneficiary: true,
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
          <MyEsimsScreen />
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
  await waitFor(() => expect(mockedGetMe).toHaveBeenCalled());
  return utils;
}

// FR-402 - owned eSIMs as cards with tap-to-reveal QR, ICCID, order
// number, install links, copy LPA, and share.
describe('My eSIMs list (FR-402)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading state, then an error state on failure', async () => {
    mockedGetMyEsims.mockRejectedValue(new Error('network down'));
    const { findByTestId } = await renderScreen();
    expect(await findByTestId('my-esims-error')).toBeTruthy();
  });

  it('shows an empty state when there are no eSIMs yet', async () => {
    mockedGetMyEsims.mockResolvedValue([]);
    const { findByTestId } = await renderScreen();
    expect(await findByTestId('my-esims-empty')).toBeTruthy();
  });

  it('shows each eSIM card with its product title and status, QR hidden until revealed', async () => {
    mockedGetMyEsims.mockResolvedValue([esim({ id: 'e1', product_title: 'Bangladesh 7 Days 5GB', status: 'ACTIVE' })]);
    const { findByTestId, queryByTestId } = await renderScreen();

    expect((await findByTestId('esim-title-e1')).props.children).toBe('Bangladesh 7 Days 5GB');
    expect((await findByTestId('esim-status-e1')).props.children).toBe('ACTIVE');
    expect(queryByTestId('esim-qr-e1')).toBeNull();
    expect(await findByTestId('esim-reveal-e1')).toBeTruthy();
  });

  it('shows an Activation Pending badge instead of status for a mock-fallback eSIM', async () => {
    mockedGetMyEsims.mockResolvedValue([esim({ id: 'e1', status: 'ACTIVE', is_mock_fallback: true })]);
    const { findByTestId } = await renderScreen();
    expect((await findByTestId('esim-status-e1')).props.children).toBe('Activation pending');
  });

  it('reveals the QR, ICCID, order number, and install links on tap', async () => {
    mockedGetMyEsims.mockResolvedValue([esim({ id: 'e1', iccid: '8988211000000000001', order_no: 'ORD-20261101-ABCDEF' })]);
    const { findByTestId } = await renderScreen();

    await fireEvent.press(await findByTestId('esim-reveal-e1'));

    expect(await findByTestId('esim-qr-e1')).toBeTruthy();
    expect((await findByTestId('esim-iccid-e1')).props.children).toBe('8988211000000000001');
    expect((await findByTestId('esim-order-no-e1')).props.children).toBe('ORD-20261101-ABCDEF');
    expect(await findByTestId('esim-install-ios-e1')).toBeTruthy();
    expect(await findByTestId('esim-install-android-e1')).toBeTruthy();
  });

  it('does not show install links when the LPA string has no install-link payload', async () => {
    mockedGetMyEsims.mockResolvedValue([esim({ id: 'e1', lpa_string: null, qr_code_data: null })]);
    const { findByTestId, queryByTestId } = await renderScreen();

    await fireEvent.press(await findByTestId('esim-reveal-e1'));

    expect(queryByTestId(`esim-install-ios-e1`)).toBeNull();
    expect(queryByTestId(`esim-install-android-e1`)).toBeNull();
  });

  it('copies the LPA string to the clipboard and shows a confirmation', async () => {
    mockedGetMyEsims.mockResolvedValue([esim({ id: 'e1', lpa_string: 'LPA:1$esim.example.com$MATCHING-ID-1' })]);
    const { findByTestId } = await renderScreen();

    await fireEvent.press(await findByTestId('esim-reveal-e1'));
    await fireEvent.press(await findByTestId('esim-copy-lpa-e1'));

    expect(mockedSetStringAsync).toHaveBeenCalledWith('LPA:1$esim.example.com$MATCHING-ID-1');
    const copyButton = await findByTestId('esim-copy-lpa-e1');
    expect(within(copyButton).getByText('Copied to clipboard!')).toBeTruthy();
  });
});
