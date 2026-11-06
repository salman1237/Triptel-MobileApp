import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import CompatiblePhonesScreen from '../../app/guides/compatible-phones';

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

jest.mock('expo-video', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const React = require('react');
  const { View } = require('react-native');
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    useVideoPlayer: jest.fn(() => ({})),
    VideoView: (props: { testID?: string }) => React.createElement(View, { testID: props.testID }),
  };
});

function renderScreen() {
  return render(
    <AppSettingsProvider>
      <CompatiblePhonesScreen />
    </AppSettingsProvider>
  );
}

describe('Compatible phones / eSIM support check (FR-901)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the *#06#/EID dial-check instructions and the embedded video', async () => {
    const { findByTestId } = await renderScreen();

    const heading = await findByTestId('compatible-phones-dial-check-heading');
    expect(heading.props.children).toContain('*#06#');
    const body = await findByTestId('compatible-phones-dial-check-body');
    expect(body.props.children).toContain('dial *#06#');
    expect(body.props.children).toContain('labelled EID');
    expect(await findByTestId('compatible-phones-video')).toBeTruthy();
  });

  it('shows the manual iOS/Android settings-path fallback', async () => {
    const { findByTestId } = await renderScreen();

    const fallback = await findByTestId('compatible-phones-fallback-text');
    const fallbackBody = fallback.props.children[1];
    expect(fallbackBody).toContain('Digital SIM');
    expect(fallbackBody).toContain('Add eSIM');
  });

  it('shows the curated device list grouped by brand', async () => {
    const { findByTestId, findByText } = await renderScreen();

    expect(await findByTestId('compatible-phones-brand-Apple iPhone')).toBeTruthy();
    await findByText(/iPhone 15 series/);
    expect(await findByTestId('compatible-phones-brand-Samsung Galaxy')).toBeTruthy();
    await findByText(/Galaxy S25/);
    expect(await findByTestId('compatible-phones-brand-Google Pixel')).toBeTruthy();
    expect(await findByTestId('compatible-phones-brand-Other popular models')).toBeTruthy();
  });

  it('navigates to Support and to the eSIM setup guide', async () => {
    const { getByTestId } = await renderScreen();

    await fireEvent.press(getByTestId('compatible-phones-support-link'));
    expect(mockPush).toHaveBeenCalledWith('/support');

    await fireEvent.press(getByTestId('compatible-phones-next-link'));
    expect(mockPush).toHaveBeenCalledWith('/guides/esim-setup-guide');
  });
});
