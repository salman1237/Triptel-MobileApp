import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from '../../src/state/AuthContext';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { register, getMe } from '../../src/api/auth';
import { validateReferralCode } from '../../src/api/referrals';
import RegisterScreen from '../../app/auth/register';

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
  register: jest.fn(),
  getMe: jest.fn(),
  googleLogin: jest.fn(),
}));

jest.mock('../../src/api/referrals', () => ({
  validateReferralCode: jest.fn(),
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
  GoogleSigninButton: Object.assign(() => null, {
    Size: { Icon: 0, Standard: 1, Wide: 2 },
    Color: { Dark: 'dark', Light: 'light' },
  }),
  isErrorWithCode: jest.fn().mockReturnValue(false),
  isSuccessResponse: jest.fn(),
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}));

const mockReplace = jest.fn();
let mockParams: { ref?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedRegister = register as jest.Mock;
const mockedGetMe = getMe as jest.Mock;
const mockedValidateReferralCode = validateReferralCode as jest.Mock;

function renderRegisterScreen() {
  return render(
    <AppSettingsProvider>
      <AuthProvider>
        <RegisterScreen />
      </AuthProvider>
    </AppSettingsProvider>
  );
}

// FR-803 - opening the register screen via a referral link (.../auth/register
// ?ref=CODE, surfaced by expo-router as a local search param) pre-fills the
// referral code field, and the field is live-validated against the public
// GET /referrals/validate endpoint either way (typed in or pre-filled).
describe('Referral-link pre-fill (FR-803)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
    mockParams = {};
    mockedValidateReferralCode.mockResolvedValue({ valid: false });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('pre-fills the referral code field from the ref search param, uppercased', async () => {
    mockParams = { ref: 'friend10' };
    const { getByTestId } = await renderRegisterScreen();
    expect(getByTestId('register-referral-input').props.value).toBe('FRIEND10');
  });

  it('leaves the referral code field empty when there is no ref param', async () => {
    mockParams = {};
    const { getByTestId } = await renderRegisterScreen();
    expect(getByTestId('register-referral-input').props.value).toBe('');
  });

  it('shows "Invited by X" once the pre-filled code validates', async () => {
    mockParams = { ref: 'FRIEND10' };
    mockedValidateReferralCode.mockResolvedValue({
      valid: true,
      referrer_username: 'traveler',
      joining_reward: '2',
      currency: 'EUR',
    });
    const { findByTestId } = await renderRegisterScreen();

    jest.advanceTimersByTime(400);
    const note = await findByTestId('register-referral-valid');
    expect(note.props.children.join('')).toContain('traveler');
    expect(mockedValidateReferralCode).toHaveBeenCalledWith('FRIEND10');
  });

  it('shows an unrecognised-code note for a code that does not validate', async () => {
    mockedValidateReferralCode.mockResolvedValue({ valid: false });
    const { getByTestId, findByTestId } = await renderRegisterScreen();

    await fireEvent.changeText(getByTestId('register-referral-input'), 'BADCODE');
    jest.advanceTimersByTime(400);

    expect(await findByTestId('register-referral-unknown')).toBeTruthy();
  });

  it('does not validate while the code is under 3 characters', async () => {
    const { getByTestId, queryByTestId } = await renderRegisterScreen();

    await fireEvent.changeText(getByTestId('register-referral-input'), 'AB');
    jest.advanceTimersByTime(400);

    expect(mockedValidateReferralCode).not.toHaveBeenCalled();
    expect(queryByTestId('register-referral-valid')).toBeNull();
    expect(queryByTestId('register-referral-unknown')).toBeNull();
  });

  it('still submits registration with the pre-filled code', async () => {
    mockParams = { ref: 'FRIEND10' };
    mockedRegister.mockResolvedValue({
      access_token: 'tok-3',
      token_type: 'bearer',
      role: 'USER',
      user_id: 'u3',
      username: 'referred2',
      must_change_password: false,
    });
    mockedGetMe.mockResolvedValue({
      id: 'u3',
      email: 'referred2@example.com',
      username: 'referred2',
      role: 'USER',
      status: 'ACTIVE',
      phone: null,
      full_name: null,
      is_kyc_verified: false,
      preferred_currency: 'EUR',
      avatar_url: null,
      email_verified: false,
      has_google: false,
      wallets: [],
      merchant_profile: null,
      agent_profile: null,
    });

    const { getByTestId } = await renderRegisterScreen();
    await fireEvent.changeText(getByTestId('register-email-input'), 'referred2@example.com');
    await fireEvent.changeText(getByTestId('register-username-input'), 'referred2');
    await fireEvent.changeText(getByTestId('register-password-input'), 'correct-password');
    await fireEvent.press(getByTestId('register-submit'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockedRegister).toHaveBeenCalledWith(
      expect.objectContaining({ referral_code: 'FRIEND10' })
    );
  });
});
