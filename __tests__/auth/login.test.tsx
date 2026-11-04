import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from '../../src/state/AuthContext';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { login, getMe } from '../../src/api/auth';
import { ApiError } from '../../src/lib/apiClient';
import LoginScreen from '../../app/auth/login';

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
  login: jest.fn(),
  getMe: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedLogin = login as jest.Mock;
const mockedGetMe = getMe as jest.Mock;

const meResponseBody = {
  id: 'u1',
  email: 'traveler@example.com',
  username: 'traveler',
  role: 'USER',
  status: 'ACTIVE',
  phone: null,
  full_name: null,
  is_kyc_verified: false,
  preferred_currency: 'EUR',
  avatar_url: null,
  email_verified: true,
  has_google: false,
  wallets: [],
  merchant_profile: null,
  agent_profile: null,
};

function renderLoginScreen() {
  return render(
    <AppSettingsProvider>
      <AuthProvider>
        <LoginScreen />
      </AuthProvider>
    </AppSettingsProvider>
  );
}

describe('Login (FR-102)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
  });

  it('logs in and routes home when must_change_password is false', async () => {
    mockedLogin.mockResolvedValue({
      access_token: 'tok-1',
      token_type: 'bearer',
      role: 'USER',
      user_id: 'u1',
      username: 'traveler',
      must_change_password: false,
    });
    mockedGetMe.mockResolvedValue(meResponseBody);

    const { getByTestId } = await renderLoginScreen();

    await fireEvent.changeText(getByTestId('login-email-input'), 'traveler@example.com');
    await fireEvent.changeText(getByTestId('login-password-input'), 'correct-password');
    await fireEvent.press(getByTestId('login-submit'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));

    expect(mockedLogin).toHaveBeenCalledWith({ email: 'traveler@example.com', password: 'correct-password' });
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith('triptel_auth_token', 'tok-1');
  });

  it('routes to set-password when must_change_password is true', async () => {
    mockedLogin.mockResolvedValue({
      access_token: 'tok-2',
      token_type: 'bearer',
      role: 'USER',
      user_id: 'u2',
      username: 'handedoff',
      must_change_password: true,
    });
    mockedGetMe.mockResolvedValue({ ...meResponseBody, id: 'u2', username: 'handedoff' });

    const { getByTestId } = await renderLoginScreen();

    await fireEvent.changeText(getByTestId('login-email-input'), 'handedoff@example.com');
    await fireEvent.changeText(getByTestId('login-password-input'), 'their-phone-number');
    await fireEvent.press(getByTestId('login-submit'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/auth/set-password'));
    expect(mockReplace).not.toHaveBeenCalledWith('/');
  });

  it('shows an error and does not navigate on invalid credentials', async () => {
    mockedLogin.mockRejectedValue(new ApiError(401, 'Invalid email/username or password'));

    const { getByTestId, findByTestId } = await renderLoginScreen();

    await fireEvent.changeText(getByTestId('login-email-input'), 'traveler@example.com');
    await fireEvent.changeText(getByTestId('login-password-input'), 'wrong-password');
    await fireEvent.press(getByTestId('login-submit'));

    const errorText = await findByTestId('login-error');
    expect(errorText.props.children).toBe('Invalid email/username or password');
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockedGetMe).not.toHaveBeenCalled();
  });
});
