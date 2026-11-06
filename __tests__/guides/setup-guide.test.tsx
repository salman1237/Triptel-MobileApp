import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import EsimSetupGuideScreen from '../../app/guides/esim-setup-guide';

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

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

function renderScreen() {
  return render(
    <AppSettingsProvider>
      <EsimSetupGuideScreen />
    </AppSettingsProvider>
  );
}

describe('eSIM setup guide (FR-902)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows all 6 iOS install steps in order', async () => {
    const { findByTestId } = await renderScreen();

    for (let i = 0; i < 6; i++) {
      expect(await findByTestId(`esim-setup-ios-step-${i}`)).toBeTruthy();
    }
    const firstStep = await findByTestId('esim-setup-ios-step-0');
    expect(firstStep).toHaveTextContent('Connect your iPhone to Wi-Fi', { exact: false });
  });

  it('shows all 5 Android install steps in order', async () => {
    const { findByTestId } = await renderScreen();

    for (let i = 0; i < 5; i++) {
      expect(await findByTestId(`esim-setup-android-step-${i}`)).toBeTruthy();
    }
    const firstStep = await findByTestId('esim-setup-android-step-0');
    expect(firstStep).toHaveTextContent('Connect your Android phone to Wi-Fi', { exact: false });
  });

  it('shows the troubleshooting checklist', async () => {
    const { findByTestId } = await renderScreen();

    expect(await findByTestId('esim-setup-troubleshooting-item-0')).toHaveTextContent('Airplane Mode', {
      exact: false,
    });
    expect(await findByTestId('esim-setup-troubleshooting-item-1')).toHaveTextContent('Data Roaming', {
      exact: false,
    });
    expect(await findByTestId('esim-setup-troubleshooting-item-2')).toHaveTextContent(
      'eSIM line (not your home SIM)',
      { exact: false }
    );
  });

  it('navigates to My eSIMs, Support (x2), and back to device compatibility', async () => {
    const { getByTestId } = await renderScreen();

    await fireEvent.press(getByTestId('esim-setup-my-esims-link'));
    expect(mockPush).toHaveBeenNthCalledWith(1, '/my-esims');

    await fireEvent.press(getByTestId('esim-setup-warning-support-link'));
    expect(mockPush).toHaveBeenNthCalledWith(2, '/support');

    await fireEvent.press(getByTestId('esim-setup-troubleshooting-support-link'));
    expect(mockPush).toHaveBeenNthCalledWith(3, '/support');

    await fireEvent.press(getByTestId('esim-setup-back-link'));
    expect(mockPush).toHaveBeenNthCalledWith(4, '/guides/compatible-phones');
    expect(mockPush).toHaveBeenCalledTimes(4);
  });

  it('warns the eSIM can only be installed once', async () => {
    const { findByTestId } = await renderScreen();

    expect(await findByTestId('esim-setup-warning-text')).toHaveTextContent('can only be installed once', {
      exact: false,
    });
  });
});
