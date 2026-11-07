import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import { getMe } from '../../src/api/auth';
import { getMyReferrals, claimReferralCode } from '../../src/api/referrals';
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
  claimReferralCode: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetMe = getMe as jest.Mock;
const mockedGetMyReferrals = getMyReferrals as jest.Mock;
const mockedClaimReferralCode = claimReferralCode as jest.Mock;

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

// FR-802 - the "Were you referred by someone?" claim form: visible only
// while the server reports can_claim, hidden (replaced by the passive
// "referred by X" line) once a referrer is already on file.
describe('Referral claim form (FR-802)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the claim form while the account can still claim a code', async () => {
    mockedGetMyReferrals.mockResolvedValue(summary({ can_claim: true, referred_by: null }));
    const { findByTestId, queryByTestId } = await renderScreen();
    expect(await findByTestId('referral-claim-form')).toBeTruthy();
    expect(queryByTestId('referral-referred-by')).toBeNull();
  });

  it('hides the claim form once a referrer is already on file', async () => {
    mockedGetMyReferrals.mockResolvedValue(summary({ can_claim: false, referred_by: 'friendlyuser' }));
    const { findByTestId, queryByTestId } = await renderScreen();
    expect(await findByTestId('referral-referred-by')).toBeTruthy();
    expect(queryByTestId('referral-claim-form')).toBeNull();
  });

  it('disables the apply button until at least 3 characters are entered', async () => {
    mockedGetMyReferrals.mockResolvedValue(summary({ can_claim: true, referred_by: null }));
    const { findByTestId } = await renderScreen();
    const input = await findByTestId('referral-claim-input');
    const button = await findByTestId('referral-claim-submit');
    expect(button.props.accessibilityState?.disabled ?? button.props.disabled).toBe(true);

    await fireEvent.changeText(input, 'AB');
    expect(button.props.accessibilityState?.disabled ?? button.props.disabled).toBe(true);

    await fireEvent.changeText(input, 'FRIEND1');
    expect(button.props.accessibilityState?.disabled ?? button.props.disabled).toBe(false);
  });

  it('submits the entered code, clears the input, and refreshes the summary on success', async () => {
    mockedGetMyReferrals.mockResolvedValueOnce(summary({ can_claim: true, referred_by: null }));
    mockedClaimReferralCode.mockResolvedValue(summary({ can_claim: false, referred_by: 'friendlyuser' }));
    mockedGetMyReferrals.mockResolvedValueOnce(summary({ can_claim: false, referred_by: 'friendlyuser' }));

    const { findByTestId, queryByTestId } = await renderScreen();
    const input = await findByTestId('referral-claim-input');
    await fireEvent.changeText(input, 'friend1');
    const button = await findByTestId('referral-claim-submit');
    await fireEvent.press(button);

    await waitFor(() => expect(mockedClaimReferralCode).toHaveBeenCalledWith('existing-token', 'FRIEND1'));
    await waitFor(() => expect(queryByTestId('referral-claim-form')).toBeNull());
    expect(await findByTestId('referral-referred-by')).toBeTruthy();
  });

  it('shows an error message and keeps the form visible when the claim is rejected', async () => {
    mockedGetMyReferrals.mockResolvedValue(summary({ can_claim: true, referred_by: null }));
    mockedClaimReferralCode.mockRejectedValue(new Error('That code does not exist'));

    const { findByTestId } = await renderScreen();
    const input = await findByTestId('referral-claim-input');
    await fireEvent.changeText(input, 'BADCODE');
    const button = await findByTestId('referral-claim-submit');
    await fireEvent.press(button);

    expect((await findByTestId('referral-claim-error')).props.children).toBe('That code does not exist');
    expect(await findByTestId('referral-claim-form')).toBeTruthy();
  });
});
