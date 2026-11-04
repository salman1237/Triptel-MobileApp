import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import PackageBrowser from '../../src/components/PackageBrowser';
import type { Product } from '../../src/api/catalog';

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
  getRates: jest.fn().mockResolvedValue([]),
}));

function product(overrides: Partial<Product>): Product {
  return {
    id: 'p',
    country_id: 1,
    title_en: 'Package',
    title_bn: null,
    data_amount_gb: 1,
    validity_days: 7,
    retail_price: 10,
    currency: 'EUR',
    is_unlimited: false,
    is_active: true,
    is_featured: false,
    coverage_networks: null,
    ...overrides,
  };
}

const products: Product[] = [
  product({ id: 'p1', title_en: 'Starter', data_amount_gb: 3, validity_days: 7, retail_price: 5, is_featured: false }),
  product({ id: 'p2', title_en: 'Popular', data_amount_gb: 10, validity_days: 15, retail_price: 15, is_featured: true }),
  product({
    id: 'p3',
    title_en: 'Unlimited pass',
    is_unlimited: true,
    data_amount_gb: 0,
    validity_days: 15,
    retail_price: 30,
    is_featured: false,
  }),
];

function renderBrowser(items: Product[] = products) {
  return render(
    <AppSettingsProvider>
      <AuthProvider>
        <PackageBrowser products={items} />
      </AuthProvider>
    </AppSettingsProvider>
  );
}

describe('Package list & filters (FR-301)', () => {
  it('shows a card per package with data/validity, price, and a Recommended badge for featured ones', async () => {
    const { findByText, findByTestId, queryByTestId } = await renderBrowser();

    expect(await findByText('Starter')).toBeTruthy();
    expect(await findByText('Popular')).toBeTruthy();
    expect(await findByText('Unlimited pass')).toBeTruthy();
    expect(await findByText('3 GB · 7 days')).toBeTruthy();
    expect(await findByText('Unlimited · 15 days')).toBeTruthy();

    expect(await findByTestId('package-featured-p2')).toBeTruthy();
    expect(queryByTestId('package-featured-p1')).toBeNull();
  });

  it('filters by data size when a size chip is tapped', async () => {
    const { findByTestId, queryByText } = await renderBrowser();
    await findByTestId('package-browser-list');

    await fireEvent.press(await findByTestId('filter-data-size-3 GB'));

    await waitFor(() => expect(queryByText('Popular')).toBeNull());
    expect(queryByText('Starter')).toBeTruthy();
    expect(queryByText('Unlimited pass')).toBeNull();
  });

  it('filters by validity when a validity chip is tapped', async () => {
    const { findByTestId, queryByText } = await renderBrowser();
    await findByTestId('package-browser-list');

    await fireEvent.press(await findByTestId('filter-validity-7'));

    await waitFor(() => expect(queryByText('Popular')).toBeNull());
    expect(queryByText('Starter')).toBeTruthy();
    expect(queryByText('Unlimited pass')).toBeNull();
  });

  it('combines both filters and shows an empty state when nothing matches', async () => {
    const { findByTestId, queryByTestId } = await renderBrowser();
    await findByTestId('package-browser-list');

    await fireEvent.press(await findByTestId('filter-data-size-3 GB'));
    await fireEvent.press(await findByTestId('filter-validity-15'));

    await waitFor(() => expect(queryByTestId('package-browser-empty')).toBeTruthy());
  });

  it('resets to all packages when the "All" chip is pressed again', async () => {
    const { findByTestId, queryByText } = await renderBrowser();
    await findByTestId('package-browser-list');

    await fireEvent.press(await findByTestId('filter-data-size-3 GB'));
    await waitFor(() => expect(queryByText('Popular')).toBeNull());

    await fireEvent.press(await findByTestId('filter-data-size-all'));
    await waitFor(() => expect(queryByText('Popular')).toBeTruthy());
  });
});
