import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import { getDestination } from '../../src/api/catalog';
import CountryLandingScreen from '../../app/explore/[slug]';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
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
  getRates: jest.fn().mockResolvedValue([{ currency_code: 'BDT', rate_to_base: 130, is_manual_override: false, manual_rate: null, source: 'test' }]),
}));

jest.mock('../../src/api/catalog', () => ({
  getDestination: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ slug: 'japan' }),
}));

const mockedGetDestination = getDestination as jest.Mock;

const japan = {
  id: 1,
  iso2: 'JP',
  iso3: 'JPN',
  name_en: 'Japan',
  name_bn: null,
  flag_url: 'https://flagcdn.com/jp.png',
  region: 'Asia',
  is_popular: true,
  popular_order: 1,
  is_active: true,
  slug: 'japan',
};

// Featured (and pricier) first - matches the backend's real ordering
// (is_featured desc, then price asc), so a cheapest-price bug that reads
// products[0] instead of taking the actual minimum can't hide behind
// fixture ordering that happens to agree with it.
const products = [
  {
    id: 'p2',
    country_id: 1,
    title_en: 'Unlimited / 14 days',
    title_bn: null,
    data_amount_gb: 0,
    validity_days: 14,
    retail_price: 25,
    currency: 'EUR',
    is_unlimited: true,
    is_active: true,
    is_featured: true,
    coverage_networks: null,
  },
  {
    id: 'p1',
    country_id: 1,
    title_en: '5GB / 7 days',
    title_bn: null,
    data_amount_gb: 5,
    validity_days: 7,
    retail_price: 10,
    currency: 'EUR',
    is_unlimited: false,
    is_active: true,
    is_featured: false,
    coverage_networks: null,
  },
];

let queryClient: QueryClient;

function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <AuthProvider>
          <CountryLandingScreen />
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
}

describe('Country landing screen (FR-203)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('shows the country header, package count, cheapest price, and the package list', async () => {
    mockedGetDestination.mockResolvedValue({ country: japan, products });

    const { findByText, findByTestId } = await renderScreen();

    expect(await findByText('Japan')).toBeTruthy();
    expect((await findByTestId('country-package-count')).props.children).toBe('2 packages available');
    // Cheapest is 10 EUR -> 1300.00 BDT at the mocked rate.
    const cheapest = await findByTestId('country-cheapest-price');
    expect(cheapest.props.children.join('')).toContain('1300.00');

    expect(await findByText('5GB / 7 days')).toBeTruthy();
    expect(await findByText('Unlimited / 14 days')).toBeTruthy();
    expect(await findByTestId('package-featured-p2')).toBeTruthy();

    expect(mockedGetDestination).toHaveBeenCalledWith('japan');
  });

  it('shows an empty state when the country has no packages', async () => {
    mockedGetDestination.mockResolvedValue({ country: japan, products: [] });

    const { findByTestId } = await renderScreen();

    expect(await findByTestId('country-no-packages')).toBeTruthy();
  });

  it('shows an error state when the destination fails to load', async () => {
    mockedGetDestination.mockRejectedValue(new Error('network down'));

    const { findByTestId } = await renderScreen();

    expect(await findByTestId('country-error')).toBeTruthy();
  });
});
