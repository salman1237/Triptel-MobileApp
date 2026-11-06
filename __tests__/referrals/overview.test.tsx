import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import { getMe } from '../../src/api/auth';
import { getMyReferrals } from '../../src/api/referrals';
import type { ReferralSummary } from '../../src/api/referrals';
import ReferralScreen from '../../app/refer/index';

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
  getPublicSettings: jest.fn().mockResolvedValue({ bangla_qr_image: null, payment_methods: [], platform_name: 'Triptel', maintenance_mode: false }),
}));

jest.mock('../../src/api/auth', () => ({
  getMe: jest.fn(),
}));

jest.mock('../../src/api/referrals', () => ({
  getMyReferrals: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetMe = getMe as jest.Mock;
const mockedGetMyReferrals = getMyReferrals as jest.Mock;

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

function summary(overrides: Partial<ReferralSummary> = {}): ReferralSummary {
  return {
    code: 'TRAVEL10',
    is_enabled: true,
    events: {
      JOINING: { referrer: 2, referred: 1, enabled: true },
      FIRST_PURCHASE: { referrer: 5, referred: 0, enabled: true },
      NEW_MERCHANT: { referrer: 20, referred: 0, enabled: false },
    },
    promo_balance: 7,
    total_earned: 12,
    referred_count: 0,
    referred: [],
    rewards: [],
    share_url: 'https://triptel.co/auth/register?ref=TRAVEL10',
    can_claim: true,
    referred_by: null,
    currency: 'EUR',
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
          <ReferralScreen />
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
  await waitFor(() => expect(mockedGetMe).toHaveBeenCalled());
  return utils;
}

// FR-801 - code/link, stat tiles, per-event reward amounts, and a list of
// referred people with what each earned. Explicitly NOT the "claim a
// referrer's code" form (FR-802, separate FR) - only the passive
// "referred by X" display, since that's the same endpoint's data, not a
// new action.
describe('Referral screen (FR-801)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading state, then an error state on failure', async () => {
    mockedGetMyReferrals.mockRejectedValue(new Error('network error'));
    const { findByTestId } = await renderScreen();
    expect(await findByTestId('referral-error')).toBeTruthy();
  });

  it('shows the code and share link', async () => {
    mockedGetMyReferrals.mockResolvedValue(summary());
    const { findByTestId } = await renderScreen();
    expect((await findByTestId('referral-code')).props.children).toBe('TRAVEL10');
    expect(await findByTestId('referral-share-button')).toBeTruthy();
  });

  it('shows the three stat tiles with correct amounts', async () => {
    mockedGetMyReferrals.mockResolvedValue(summary({ promo_balance: 7, total_earned: 12.5, referred_count: 3 }));
    const { findByTestId } = await renderScreen();
    expect((await findByTestId('referral-promo-balance')).props.children).toBe('€7.00');
    expect((await findByTestId('referral-total-earned')).props.children).toBe('€12.50');
    expect((await findByTestId('referral-referred-count')).props.children).toBe(3);
  });

  it('shows enabled event tiles with the right amounts, and omits a disabled event', async () => {
    mockedGetMyReferrals.mockResolvedValue(summary());
    const { findByTestId, queryByTestId } = await renderScreen();

    const joiningAmount = await findByTestId('referral-event-referrer-JOINING');
    expect(joiningAmount.props.children.join('')).toContain('€2.00');
    expect(await findByTestId('referral-event-FIRST_PURCHASE')).toBeTruthy();
    expect(queryByTestId('referral-event-NEW_MERCHANT')).toBeNull();
  });

  it("shows a referred person's name, join date, and GRANTED-only earned total", async () => {
    mockedGetMyReferrals.mockResolvedValue(
      summary({
        referred_count: 1,
        referred: [{ username: 'newuser', joined_at: '2026-10-01T10:00:00Z', role: 'USER' }],
        rewards: [
          { event: 'JOINING', referred_username: 'newuser', amount: 2, status: 'GRANTED', created_at: '2026-10-01T10:00:00Z' },
          { event: 'FIRST_PURCHASE', referred_username: 'newuser', amount: 5, status: 'GRANTED', created_at: '2026-10-02T10:00:00Z' },
        ],
      })
    );
    const { findByTestId } = await renderScreen();
    expect((await findByTestId('referred-person-earned-newuser')).props.children).toBe('€7.00');
  });

  it('excludes REVERSED rewards from the earned total and shows the reversed note', async () => {
    mockedGetMyReferrals.mockResolvedValue(
      summary({
        referred_count: 1,
        referred: [{ username: 'newuser', joined_at: '2026-10-01T10:00:00Z', role: 'USER' }],
        rewards: [
          { event: 'JOINING', referred_username: 'newuser', amount: 2, status: 'GRANTED', created_at: '2026-10-01T10:00:00Z' },
          { event: 'FIRST_PURCHASE', referred_username: 'newuser', amount: 5, status: 'REVERSED', created_at: '2026-10-02T10:00:00Z' },
        ],
      })
    );
    const { findByTestId } = await renderScreen();
    expect((await findByTestId('referred-person-earned-newuser')).props.children).toBe('€2.00');
  });

  it('shows the Partner badge only for a referred MERCHANT, not a regular USER', async () => {
    mockedGetMyReferrals.mockResolvedValue(
      summary({
        referred_count: 2,
        referred: [
          { username: 'merchantuser', joined_at: '2026-10-01T10:00:00Z', role: 'MERCHANT' },
          { username: 'normaluser', joined_at: '2026-10-01T10:00:00Z', role: 'USER' },
        ],
      })
    );
    const { findByTestId, queryByTestId } = await renderScreen();
    expect(await findByTestId('referred-person-partner-merchantuser')).toBeTruthy();
    expect(queryByTestId('referred-person-partner-normaluser')).toBeNull();
  });

  it('shows "You were referred by X" when a referrer is already on file', async () => {
    mockedGetMyReferrals.mockResolvedValue(summary({ can_claim: false, referred_by: 'friendlyuser' }));
    const { findByTestId } = await renderScreen();
    const note = await findByTestId('referral-referred-by');
    expect(note.props.children.join('')).toContain('friendlyuser');
  });

  it('does not show the referred-by line while the account can still claim a code', async () => {
    mockedGetMyReferrals.mockResolvedValue(summary({ can_claim: true, referred_by: null }));
    const { queryByTestId, findByTestId } = await renderScreen();
    await findByTestId('referral-screen');
    expect(queryByTestId('referral-referred-by')).toBeNull();
  });

  it('shows an empty state when nobody has been referred yet', async () => {
    mockedGetMyReferrals.mockResolvedValue(summary({ referred_count: 0, referred: [] }));
    const { findByTestId } = await renderScreen();
    expect(await findByTestId('referral-people-empty')).toBeTruthy();
  });

  it('shows the programme-disabled notice when is_enabled is false', async () => {
    mockedGetMyReferrals.mockResolvedValue(summary({ is_enabled: false }));
    const { findByTestId } = await renderScreen();
    expect(await findByTestId('referral-disabled-notice')).toBeTruthy();
  });
});
