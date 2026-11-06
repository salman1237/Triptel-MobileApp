import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { forgotPassword, resetPassword } from '../../src/api/auth';
import { ApiError } from '../../src/lib/apiClient';
import ForgotPasswordScreen from '../../app/auth/forgot-password';
import ResetPasswordScreen from '../../app/auth/reset-password';

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
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
}));

const mockReplace = jest.fn();
let mockParams: { token?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

const mockedForgotPassword = forgotPassword as jest.Mock;
const mockedResetPassword = resetPassword as jest.Mock;

function renderScreen(ui: React.ReactElement) {
  return render(<AppSettingsProvider>{ui}</AppSettingsProvider>);
}

describe('Forgot password (FR-104)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the generic sent message after requesting a reset email', async () => {
    mockedForgotPassword.mockResolvedValue({ status: 'success', message: 'ok' });

    const { getByTestId, findByTestId } = await renderScreen(<ForgotPasswordScreen />);

    await fireEvent.changeText(getByTestId('forgot-password-email-input'), 'traveler@example.com');
    await fireEvent.press(getByTestId('forgot-password-submit'));

    const sent = await findByTestId('forgot-password-sent');
    expect(sent).toBeTruthy();
    expect(mockedForgotPassword).toHaveBeenCalledWith('traveler@example.com');
  });
});

describe('Reset password (FR-104)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
  });

  it('pre-fills the token from a ?token= route param', async () => {
    mockParams = { token: 'from-the-email-link' };

    const { getByTestId } = await renderScreen(<ResetPasswordScreen />);

    expect(getByTestId('reset-password-token-input').props.value).toBe('from-the-email-link');
  });

  it('resets the password and shows a success state with a way to log in', async () => {
    mockedResetPassword.mockResolvedValue({ status: 'success', message: 'ok' });

    const { getByTestId, findByTestId } = await renderScreen(<ResetPasswordScreen />);

    await fireEvent.changeText(getByTestId('reset-password-token-input'), 'a-valid-token');
    await fireEvent.changeText(getByTestId('reset-password-new-input'), 'new-password-123');
    await fireEvent.changeText(getByTestId('reset-password-confirm-input'), 'new-password-123');
    await fireEvent.press(getByTestId('reset-password-submit'));

    const done = await findByTestId('reset-password-done');
    expect(done).toBeTruthy();
    expect(mockedResetPassword).toHaveBeenCalledWith('a-valid-token', 'new-password-123');

    await fireEvent.press(await findByTestId('reset-password-go-to-login'));
    expect(mockReplace).toHaveBeenCalledWith('/auth/login');
  });

  it('shows a client-side error without calling the API when passwords do not match', async () => {
    const { getByTestId, findByTestId } = await renderScreen(<ResetPasswordScreen />);

    await fireEvent.changeText(getByTestId('reset-password-token-input'), 'a-valid-token');
    await fireEvent.changeText(getByTestId('reset-password-new-input'), 'new-password-123');
    await fireEvent.changeText(getByTestId('reset-password-confirm-input'), 'does-not-match');
    await fireEvent.press(getByTestId('reset-password-submit'));

    const error = await findByTestId('reset-password-error');
    expect(error.props.children).toBe('Passwords do not match.');
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it('shows the backend error for an invalid or expired token', async () => {
    mockedResetPassword.mockRejectedValue(new ApiError(400, 'Invalid or already-used reset link'));

    const { getByTestId, findByTestId } = await renderScreen(<ResetPasswordScreen />);

    await fireEvent.changeText(getByTestId('reset-password-token-input'), 'expired-token');
    await fireEvent.changeText(getByTestId('reset-password-new-input'), 'new-password-123');
    await fireEvent.changeText(getByTestId('reset-password-confirm-input'), 'new-password-123');
    await fireEvent.press(getByTestId('reset-password-submit'));

    const error = await findByTestId('reset-password-error');
    expect(error.props.children).toBe('Invalid or already-used reset link');
  });
});
