import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from '../../src/state/AuthContext';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { changePassword, getMe } from '../../src/api/auth';
import { ApiError } from '../../src/lib/apiClient';
import SetPasswordScreen from '../../app/auth/set-password';

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
  changePassword: jest.fn(),
  getMe: jest.fn(),
}));

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedChangePassword = changePassword as jest.Mock;
const mockedGetMe = getMe as jest.Mock;

const meResponseBody = {
  id: 'u1',
  email: 'handedoff@example.com',
  username: 'handedoff',
  role: 'USER',
  status: 'ACTIVE',
  phone: '+8801234567890',
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

async function renderWithAuthenticatedSession() {
  mockedSecureStore.getItemAsync.mockResolvedValue('existing-token');
  mockedGetMe.mockResolvedValue(meResponseBody);

  const utils = await render(
    <AppSettingsProvider>
      <AuthProvider>
        <SetPasswordScreen />
      </AuthProvider>
    </AppSettingsProvider>
  );
  // Let AuthProvider's session-restore effect resolve so useAuth().token is
  // populated before a test interacts with the form.
  await waitFor(() => expect(mockedGetMe).toHaveBeenCalled());
  return utils;
}

describe('Forced password change (FR-105)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('changes the password and routes home', async () => {
    mockedChangePassword.mockResolvedValue({ status: 'success', message: 'Password updated.' });

    const { getByTestId } = await renderWithAuthenticatedSession();

    await fireEvent.changeText(getByTestId('set-password-current-input'), '+8801234567890');
    await fireEvent.changeText(getByTestId('set-password-new-input'), 'my-own-password-1');
    await fireEvent.changeText(getByTestId('set-password-confirm-input'), 'my-own-password-1');
    await fireEvent.press(getByTestId('set-password-submit'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockedChangePassword).toHaveBeenCalledWith('existing-token', '+8801234567890', 'my-own-password-1');
  });

  it('shows a client-side error without calling the API when passwords do not match', async () => {
    const { getByTestId, findByTestId } = await renderWithAuthenticatedSession();

    await fireEvent.changeText(getByTestId('set-password-current-input'), '+8801234567890');
    await fireEvent.changeText(getByTestId('set-password-new-input'), 'my-own-password-1');
    await fireEvent.changeText(getByTestId('set-password-confirm-input'), 'does-not-match');
    await fireEvent.press(getByTestId('set-password-submit'));

    const error = await findByTestId('set-password-error');
    expect(error.props.children).toBe('Passwords do not match.');
    expect(mockedChangePassword).not.toHaveBeenCalled();
  });

  it('shows the backend error when the current password is wrong', async () => {
    mockedChangePassword.mockRejectedValue(new ApiError(400, 'Your current password is not correct'));

    const { getByTestId, findByTestId } = await renderWithAuthenticatedSession();

    await fireEvent.changeText(getByTestId('set-password-current-input'), 'wrong-password');
    await fireEvent.changeText(getByTestId('set-password-new-input'), 'my-own-password-1');
    await fireEvent.changeText(getByTestId('set-password-confirm-input'), 'my-own-password-1');
    await fireEvent.press(getByTestId('set-password-submit'));

    const error = await findByTestId('set-password-error');
    expect(error.props.children).toBe('Your current password is not correct');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('lets the user view My eSIMs instead of changing the password first', async () => {
    const { getByTestId } = await renderWithAuthenticatedSession();

    await fireEvent.press(getByTestId('set-password-view-esims'));

    expect(mockPush).toHaveBeenCalledWith('/my-esims');
  });
});
