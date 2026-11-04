import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from '../../src/state/AuthContext';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { register, getMe } from '../../src/api/auth';
import { ApiError } from '../../src/lib/apiClient';
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
}));

jest.mock('../../src/api/auth', () => ({
  register: jest.fn(),
  getMe: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedRegister = register as jest.Mock;
const mockedGetMe = getMe as jest.Mock;

const meResponseBody = {
  id: 'u1',
  email: 'newcomer@example.com',
  username: 'newcomer',
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
};

function renderRegisterScreen() {
  return render(
    <AppSettingsProvider>
      <AuthProvider>
        <RegisterScreen />
      </AuthProvider>
    </AppSettingsProvider>
  );
}

describe('Register (FR-101)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
  });

  it('creates an account and routes home when must_change_password is false', async () => {
    mockedRegister.mockResolvedValue({
      access_token: 'tok-1',
      token_type: 'bearer',
      role: 'USER',
      user_id: 'u1',
      username: 'newcomer',
      must_change_password: false,
    });
    mockedGetMe.mockResolvedValue(meResponseBody);

    const { getByTestId } = await renderRegisterScreen();

    await fireEvent.changeText(getByTestId('register-email-input'), 'newcomer@example.com');
    await fireEvent.changeText(getByTestId('register-username-input'), 'newcomer');
    await fireEvent.changeText(getByTestId('register-password-input'), 'correct-password');
    await fireEvent.press(getByTestId('register-submit'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));

    expect(mockedRegister).toHaveBeenCalledWith({
      email: 'newcomer@example.com',
      username: 'newcomer',
      password: 'correct-password',
      phone: undefined,
      referral_code: undefined,
    });
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith('triptel_auth_token', 'tok-1');
  });

  it('passes through optional phone and referral code when filled in', async () => {
    mockedRegister.mockResolvedValue({
      access_token: 'tok-2',
      token_type: 'bearer',
      role: 'USER',
      user_id: 'u2',
      username: 'referred',
      must_change_password: false,
    });
    mockedGetMe.mockResolvedValue({ ...meResponseBody, id: 'u2', username: 'referred' });

    const { getByTestId } = await renderRegisterScreen();

    await fireEvent.changeText(getByTestId('register-email-input'), 'referred@example.com');
    await fireEvent.changeText(getByTestId('register-username-input'), 'referred');
    await fireEvent.changeText(getByTestId('register-password-input'), 'correct-password');
    await fireEvent.changeText(getByTestId('register-phone-input'), '+8801234567890');
    await fireEvent.changeText(getByTestId('register-referral-input'), 'FRIEND10');
    await fireEvent.press(getByTestId('register-submit'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));

    expect(mockedRegister).toHaveBeenCalledWith({
      email: 'referred@example.com',
      username: 'referred',
      password: 'correct-password',
      phone: '+8801234567890',
      referral_code: 'FRIEND10',
    });
  });

  it('shows the backend error and does not navigate when the account already exists', async () => {
    mockedRegister.mockRejectedValue(new ApiError(400, 'Email or username already exists'));

    const { getByTestId, findByTestId } = await renderRegisterScreen();

    await fireEvent.changeText(getByTestId('register-email-input'), 'traveler@example.com');
    await fireEvent.changeText(getByTestId('register-username-input'), 'traveler');
    await fireEvent.changeText(getByTestId('register-password-input'), 'correct-password');
    await fireEvent.press(getByTestId('register-submit'));

    const errorText = await findByTestId('register-error');
    expect(errorText.props.children).toBe('Email or username already exists');
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockedGetMe).not.toHaveBeenCalled();
  });
});
