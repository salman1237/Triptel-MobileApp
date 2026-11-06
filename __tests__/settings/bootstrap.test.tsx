import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AppSettingsProvider, useAppSettings } from '../../src/state/AppSettingsContext';
import { getLanguages, getPublicSettings, getRates, getTranslations } from '../../src/api/settings';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/api/settings', () => ({
  getLanguages: jest.fn(),
  getTranslations: jest.fn(),
  getRates: jest.fn(),
  getPublicSettings: jest.fn(),
}));

const mockedGetLanguages = getLanguages as jest.Mock;
const mockedGetTranslations = getTranslations as jest.Mock;
const mockedGetRates = getRates as jest.Mock;
const mockedGetPublicSettings = getPublicSettings as jest.Mock;

// Deferred promise - lets a test control exactly when a fetch "resolves",
// instead of racing against whatever microtask order mockResolvedValue
// would produce.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Probe() {
  const { t, formatPrice } = useAppSettings();
  return (
    <Text testID="probe-content">
      {t('checkout', 'buy_now', 'Buy Now')} {formatPrice(10)}
    </Text>
  );
}

// FR-1202 - the app shell must not render money or translated strings
// until public settings, languages, and currency rates have all settled
// at least once (success or failure) - otherwise a customer briefly sees
// raw translation keys and/or the wrong currency symbol on every cold
// start, which is exactly what this bootstrap gate in
// AppSettingsContext.tsx prevents.
describe('App settings bootstrap (FR-1202)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loading state and withholds children until every bootstrap fetch has settled', async () => {
    const languages = deferred<unknown[]>();
    const translations = deferred<{ language_code: string; namespaces: Record<string, unknown> }>();
    const rates = deferred<unknown[]>();
    const publicSettings = deferred<{ bangla_qr_image: null; payment_methods: unknown[] }>();
    mockedGetLanguages.mockReturnValue(languages.promise);
    mockedGetTranslations.mockReturnValue(translations.promise);
    mockedGetRates.mockReturnValue(rates.promise);
    mockedGetPublicSettings.mockReturnValue(publicSettings.promise);

    const { queryByTestId, findByTestId } = await render(
      <AppSettingsProvider>
        <Probe />
      </AppSettingsProvider>
    );

    expect(await findByTestId('app-settings-bootstrap-loading')).toBeTruthy();
    expect(queryByTestId('probe-content')).toBeNull();

    languages.resolve([]);
    translations.resolve({ language_code: 'en', namespaces: {} });
    rates.resolve([]);
    publicSettings.resolve({ bangla_qr_image: null, payment_methods: [] });

    expect(await findByTestId('probe-content')).toBeTruthy();
    expect(queryByTestId('app-settings-bootstrap-loading')).toBeNull();
  });

  it('renders the loaded translation and currency once all fetches resolve', async () => {
    mockedGetLanguages.mockResolvedValue([]);
    mockedGetTranslations.mockResolvedValue({
      language_code: 'en',
      namespaces: { checkout: { buy_now: 'Buy Now' } },
    });
    mockedGetRates.mockResolvedValue([]);
    mockedGetPublicSettings.mockResolvedValue({ bangla_qr_image: null, payment_methods: [] });

    const { findByTestId } = await render(
      <AppSettingsProvider>
        <Probe />
      </AppSettingsProvider>
    );

    const content = await findByTestId('probe-content');
    expect(content.props.children.join('')).toContain('Buy Now');
    expect(content.props.children.join('')).toContain('৳10.00');
  });

  it('still becomes ready even when one bootstrap fetch fails, instead of hanging forever', async () => {
    mockedGetLanguages.mockResolvedValue([]);
    mockedGetTranslations.mockResolvedValue({ language_code: 'en', namespaces: {} });
    mockedGetRates.mockRejectedValue(new Error('network error'));
    mockedGetPublicSettings.mockResolvedValue({ bangla_qr_image: null, payment_methods: [] });

    const { findByTestId, queryByTestId } = await render(
      <AppSettingsProvider>
        <Probe />
      </AppSettingsProvider>
    );

    await waitFor(() => expect(queryByTestId('app-settings-bootstrap-loading')).toBeNull());
    expect(await findByTestId('probe-content')).toBeTruthy();
  });
});
