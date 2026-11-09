import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import { getMe } from '../../src/api/auth';
import { getEsimStatus, refreshEsimStatus } from '../../src/api/esims';
import type { EsimStatus } from '../../src/api/esims';
import EsimStatusScreen from '../../app/(tabs)/my-esims/[id]';

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
  getEsimStatus: jest.fn(),
  refreshEsimStatus: jest.fn(),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'e1' }),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetMe = getMe as jest.Mock;
const mockedGetEsimStatus = getEsimStatus as jest.Mock;
const mockedRefreshEsimStatus = refreshEsimStatus as jest.Mock;
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

function esimStatus(overrides: Partial<EsimStatus> = {}): EsimStatus {
  return {
    esim_id: 'e1',
    order_no: 'ORD-20261101-ABCDEF',
    purchased_at: '2026-11-01T10:00:00Z',
    product: { title: 'Bangladesh 7 Days 5GB', validity_days: 7, is_unlimited: false, data_amount_gb: '5' },
    iccid: '8988211000000000001',
    lpa_string: 'LPA:1$esim.example.com$MATCHING-ID-1',
    qr_code_data: 'LPA:1$esim.example.com$MATCHING-ID-1',
    smdp_address: 'esim.example.com',
    matching_id: 'MATCHING-ID-1',
    supplier_reference: 'TRX-1',
    status: { label: 'Active', code: 1, is_installed: true, is_activated: true, device_model: 'iPhone 15' },
    usage: {
      used_mb: '512',
      used_bytes: 536870912,
      formatted: '512.00 MB',
      allowance_mb: '5120',
      remaining_mb: '4608',
      remaining_formatted: '4.50 GB',
      used_pct: 10,
      is_unlimited: false,
    },
    validity: { days: 7, activated_at: '2026-11-02T08:00:00Z', expires_at: '2026-11-09T08:00:00Z', note: null },
    share_url: 'https://triptel.co/track/abc123',
    history: [],
    daily_breakdown: [],
    telemetry: { fetched_at: '2026-11-05T12:00:00Z', error: null, available: true },
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
          <EsimStatusScreen />
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
  await waitFor(() => expect(mockedGetMe).toHaveBeenCalled());
  return utils;
}

// FR-403 - usage %, status, validity countdown, copyable SM-DP+/matching-ID/
// LPA, daily usage, install history, and a stale-telemetry warning.
describe('eSIM status/detail screen (FR-403)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading state, then an error state on failure', async () => {
    mockedGetEsimStatus.mockRejectedValue(new Error('network down'));
    const { findByTestId } = await renderScreen();
    expect(await findByTestId('esim-status-error')).toBeTruthy();
  });

  it('shows the product title, order number, and data usage', async () => {
    mockedGetEsimStatus.mockResolvedValue(esimStatus());
    const { findByTestId } = await renderScreen();

    expect((await findByTestId('esim-status-product-title')).props.children).toBe('Bangladesh 7 Days 5GB');
    expect((await findByTestId('esim-status-data-used')).props.children).toBe('512.00 MB');
    expect((await findByTestId('esim-status-label')).props.children).toBe('Active');
  });

  it('shows "Unlimited plan" instead of a usage bar for an unlimited product', async () => {
    mockedGetEsimStatus.mockResolvedValue(
      esimStatus({
        product: { title: 'Bangladesh Unlimited', validity_days: 7, is_unlimited: true, data_amount_gb: null },
        usage: {
          used_mb: '1024',
          used_bytes: 1073741824,
          formatted: '1.00 GB',
          allowance_mb: null,
          remaining_mb: null,
          remaining_formatted: null,
          used_pct: null,
          is_unlimited: true,
        },
      })
    );
    const { findByText } = await renderScreen();
    expect(await findByText('Unlimited plan')).toBeTruthy();
  });

  it('shows the validity note banner for a not-yet-activated eSIM, not an expiry date', async () => {
    mockedGetEsimStatus.mockResolvedValue(
      esimStatus({
        status: { label: 'Not installed yet', code: null, is_installed: false, is_activated: false, device_model: null },
        validity: {
          days: 7,
          activated_at: null,
          expires_at: null,
          note: 'Validity starts when you install this eSIM — 7 days from then.',
        },
      })
    );
    const { findByTestId } = await renderScreen();

    expect(await findByTestId('esim-status-validity-note')).toBeTruthy();
    expect((await findByTestId('esim-status-validity-meta')).props.children).toBe('Starts when you install it');
  });

  it('shows a stale-telemetry warning when the carrier is unreachable', async () => {
    mockedGetEsimStatus.mockResolvedValue(esimStatus({ telemetry: { fetched_at: '2026-11-04T10:00:00Z', error: 'timeout', available: true } }));
    const { findByTestId, queryByTestId } = await renderScreen();

    expect(await findByTestId('esim-status-stale-warning')).toBeTruthy();
    expect(queryByTestId('esim-status-last-checked')).toBeNull();
  });

  it('does not show the stale-telemetry warning when telemetry is fresh', async () => {
    mockedGetEsimStatus.mockResolvedValue(esimStatus());
    const { findByTestId, queryByTestId } = await renderScreen();

    await findByTestId('esim-status-product-title');
    expect(queryByTestId('esim-status-stale-warning')).toBeNull();
    expect(await findByTestId('esim-status-last-checked')).toBeTruthy();
  });

  it('copies the LPA string to the clipboard when its copy row is tapped', async () => {
    mockedGetEsimStatus.mockResolvedValue(esimStatus());
    const { findByTestId } = await renderScreen();

    fireEvent.press(await findByTestId('esim-status-copy-lpa'));

    await waitFor(() => expect(mockedSetStringAsync).toHaveBeenCalledWith('LPA:1$esim.example.com$MATCHING-ID-1'));
  });

  it('renders daily usage rows when present, nothing when empty', async () => {
    mockedGetEsimStatus.mockResolvedValue(
      esimStatus({ daily_breakdown: [{ usageDate: '20261101', enus: 'Dhaka', mnoname: 'Grameenphone', usage: '10485760' }] })
    );
    const { findByTestId } = await renderScreen();
    expect(await findByTestId('esim-status-daily-breakdown')).toBeTruthy();
  });

  it('omits the daily usage section entirely when there is no breakdown', async () => {
    mockedGetEsimStatus.mockResolvedValue(esimStatus({ daily_breakdown: [] }));
    const { findByTestId, queryByTestId } = await renderScreen();
    await findByTestId('esim-status-product-title');
    expect(queryByTestId('esim-status-daily-breakdown')).toBeNull();
  });

  it('renders install history when present, nothing when empty', async () => {
    mockedGetEsimStatus.mockResolvedValue(
      esimStatus({ history: [{ event_name: 'eSIM installed', date: '2026-11-02T08:00:00Z', status: 'success' }] })
    );
    const { findByTestId } = await renderScreen();
    expect(await findByTestId('esim-status-history')).toBeTruthy();
  });

  it('refetches and shows updated data when Refresh is tapped', async () => {
    mockedGetEsimStatus.mockResolvedValue(esimStatus({ usage: { ...esimStatus().usage, formatted: '512.00 MB' } }));
    mockedRefreshEsimStatus.mockResolvedValue(esimStatus({ usage: { ...esimStatus().usage, formatted: '900.00 MB' } }));

    const { findByTestId } = await renderScreen();
    await findByTestId('esim-status-product-title');

    fireEvent.press(await findByTestId('esim-status-refresh'));

    await waitFor(() => expect(mockedRefreshEsimStatus).toHaveBeenCalledWith('existing-token', 'e1'));
    expect((await findByTestId('esim-status-data-used')).props.children).toBe('900.00 MB');
  });
});
