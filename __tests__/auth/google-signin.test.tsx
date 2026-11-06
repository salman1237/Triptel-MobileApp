import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AuthProvider } from '../../src/state/AuthContext';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { googleLogin, getMe } from '../../src/api/auth';
import { ApiError } from '../../src/lib/apiClient';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import GoogleSignIn from '../../src/components/GoogleSignInButton';

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
  googleLogin: jest.fn(),
  getMe: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

// The jest.fn()s live directly inside the factory (not in outer closures) -
// GoogleSignInButton.tsx calls GoogleSignin.configure() as a module-load
// side effect, which runs as soon as this mock is required, before any
// outer `const mock... = jest.fn()` in this file would have been assigned.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
  },
  GoogleSigninButton: Object.assign(
    ({ onPress, disabled }: { onPress: () => void; disabled: boolean }) => {
      /* eslint-disable-next-line @typescript-eslint/no-require-imports */
      const { Pressable, Text } = require('react-native');
      return (
        <Pressable onPress={onPress} disabled={disabled} testID="google-signin-button">
          <Text>Continue with Google</Text>
        </Pressable>
      );
    },
    { Size: { Icon: 0, Standard: 1, Wide: 2 }, Color: { Dark: 'dark', Light: 'light' } }
  ),
  isErrorWithCode: (error: unknown): error is { code: string } =>
    typeof error === 'object' && error !== null && 'code' in error,
  isSuccessResponse: (response: { type: string }) => response?.type === 'success',
  statusCodes: { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED' },
}));

const mockedGoogleLogin = googleLogin as jest.Mock;
const mockedGetMe = getMe as jest.Mock;
const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockSignIn = GoogleSignin.signIn as jest.Mock;
const mockHasPlayServices = GoogleSignin.hasPlayServices as jest.Mock;

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
  has_google: true,
  wallets: [],
  merchant_profile: null,
  agent_profile: null,
};

function renderButton() {
  return render(
    <AppSettingsProvider>
      <AuthProvider>
        <GoogleSignIn />
      </AuthProvider>
    </AppSettingsProvider>
  );
}

describe('Google Sign-In (FR-103)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
    mockHasPlayServices.mockResolvedValue(true);
  });

  it('signs in with Google and routes home when must_change_password is false', async () => {
    mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token-1' } });
    mockedGoogleLogin.mockResolvedValue({
      access_token: 'tok-1',
      token_type: 'bearer',
      role: 'USER',
      user_id: 'u1',
      username: 'traveler',
      must_change_password: false,
    });
    mockedGetMe.mockResolvedValue(meResponseBody);

    const { getByTestId } = await renderButton();
    await fireEvent.press(getByTestId('google-signin-button'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(mockedGoogleLogin).toHaveBeenCalledWith('google-id-token-1');
    expect(mockedSecureStore.setItemAsync).toHaveBeenCalledWith('triptel_auth_token', 'tok-1');
  });

  it('routes to set-password when must_change_password is true', async () => {
    mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token-2' } });
    mockedGoogleLogin.mockResolvedValue({
      access_token: 'tok-2',
      token_type: 'bearer',
      role: 'USER',
      user_id: 'u2',
      username: 'handedoff',
      must_change_password: true,
    });
    mockedGetMe.mockResolvedValue({ ...meResponseBody, id: 'u2', username: 'handedoff' });

    const { getByTestId } = await renderButton();
    await fireEvent.press(getByTestId('google-signin-button'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/auth/set-password'));
    expect(mockReplace).not.toHaveBeenCalledWith('/');
  });

  it('does nothing when the user cancels the Google account picker', async () => {
    mockSignIn.mockResolvedValue({ type: 'cancelled', data: null });

    const { getByTestId, queryByTestId } = await renderButton();
    await fireEvent.press(getByTestId('google-signin-button'));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    expect(mockedGoogleLogin).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(queryByTestId('google-signin-error')).toBeNull();
  });

  it('silently ignores the native SIGN_IN_CANCELLED error code, without showing an error', async () => {
    mockSignIn.mockRejectedValue({ code: 'SIGN_IN_CANCELLED', message: 'cancelled' });

    const { getByTestId, queryByTestId } = await renderButton();
    await fireEvent.press(getByTestId('google-signin-button'));

    // Let the rejected promise settle.
    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(queryByTestId('google-signin-error')).toBeNull();
    expect(mockedGoogleLogin).not.toHaveBeenCalled();
  });

  it('shows the server error when the backend rejects the Google credential', async () => {
    mockSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token-3' } });
    mockedGoogleLogin.mockRejectedValue(new ApiError(409, 'This email is already linked to a different Google account'));

    const { getByTestId, findByTestId } = await renderButton();
    await fireEvent.press(getByTestId('google-signin-button'));

    const errorText = await findByTestId('google-signin-error');
    expect(errorText.props.children).toBe('This email is already linked to a different Google account');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
