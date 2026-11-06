import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { getCountries } from '../../src/api/catalog';
import HomeScreen from '../../app/(tabs)/index';

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

const popularCountries = [
  { id: 1, iso2: 'TH', iso3: 'THA', name_en: 'Thailand', name_bn: null, flag_url: null, region: 'Asia', is_popular: true, popular_order: 1, is_active: true, slug: 'thailand' },
  { id: 2, iso2: 'JP', iso3: 'JPN', name_en: 'Japan', name_bn: null, flag_url: null, region: 'Asia', is_popular: true, popular_order: 2, is_active: true, slug: 'japan' },
];

const searchResults = [
  { id: 3, iso2: 'TR', iso3: 'TUR', name_en: 'Turkey', name_bn: null, flag_url: null, region: 'Europe', is_popular: false, popular_order: 0, is_active: true, slug: 'turkey' },
];

let queryClient: QueryClient;

function renderHomeScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <HomeScreen />
      </AppSettingsProvider>
    </QueryClientProvider>
  );
}

describe('Home / destination search (FR-201)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // A fresh client per test, torn down in afterEach - otherwise its gcTime
    // timers outlive the test and the Jest worker has to be force-exited.
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockedGetCountries.mockImplementation(({ popularOnly }: { popularOnly?: boolean; search?: string }) =>
      popularOnly ? Promise.resolve(popularCountries) : Promise.resolve(searchResults)
    );
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('shows the Popular Destinations grid on load', async () => {
    const { findByText } = await renderHomeScreen();

    expect(await findByText('Thailand')).toBeTruthy();
    expect(await findByText('Japan')).toBeTruthy();
    expect(await findByText('Popular Destinations')).toBeTruthy();
    expect(mockedGetCountries).toHaveBeenCalledWith({ popularOnly: true });
  });

  it('searches live as the user types, debounced, and replaces the grid with results', async () => {
    const { findByText, getByTestId, queryByText } = await renderHomeScreen();
    await findByText('Thailand');

    await fireEvent.changeText(getByTestId('destination-search-input'), 'tur');

    await waitFor(
      () => expect(mockedGetCountries).toHaveBeenCalledWith({ search: 'tur' }),
      { timeout: 2000 }
    );
    expect(await findByText('Turkey')).toBeTruthy();
    expect(await findByText('Search results')).toBeTruthy();
    expect(queryByText('Thailand')).toBeNull();
  });
});
