import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { getCountries } from '../../src/api/catalog';
import DestinationsScreen from '../../app/explore/destinations';

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

jest.mock('../../src/api/catalog', () => ({
  getCountries: jest.fn(),
}));

const mockedGetCountries = getCountries as jest.Mock;

const allCountries = [
  { id: 1, iso2: 'JP', iso3: 'JPN', name_en: 'Japan', name_bn: null, flag_url: null, region: 'Asia', is_popular: true, popular_order: 1, is_active: true, slug: 'japan' },
  { id: 2, iso2: 'TH', iso3: 'THA', name_en: 'Thailand', name_bn: null, flag_url: null, region: 'Asia', is_popular: true, popular_order: 2, is_active: true, slug: 'thailand' },
  { id: 3, iso2: 'GB', iso3: 'GBR', name_en: 'United Kingdom', name_bn: null, flag_url: null, region: 'Europe', is_popular: false, popular_order: 0, is_active: true, slug: 'united-kingdom' },
];

let queryClient: QueryClient;

function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <DestinationsScreen />
      </AppSettingsProvider>
    </QueryClientProvider>
  );
}

describe('Full destination directory (FR-202)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockedGetCountries.mockResolvedValue(allCountries);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('fetches the whole catalog once and groups it by region', async () => {
    const { findByText } = await renderScreen();

    expect(await findByText('Japan')).toBeTruthy();
    expect(await findByText('Thailand')).toBeTruthy();
    expect(await findByText('United Kingdom')).toBeTruthy();
    expect(await findByText('Asia · 2')).toBeTruthy();
    expect(await findByText('Europe · 1')).toBeTruthy();
    expect(mockedGetCountries).toHaveBeenCalledWith();
    expect(mockedGetCountries).toHaveBeenCalledTimes(1);
  });

  it('filters client-side as the user types, without another network call', async () => {
    const { findByText, getByTestId, queryByText } = await renderScreen();
    await findByText('Japan');

    await fireEvent.changeText(getByTestId('destinations-directory-search-input'), 'united');

    await waitFor(() => expect(queryByText('Japan')).toBeNull());
    expect(await findByText('United Kingdom')).toBeTruthy();
    expect(queryByText('Thailand')).toBeNull();
    expect(mockedGetCountries).toHaveBeenCalledTimes(1);
  });
});
