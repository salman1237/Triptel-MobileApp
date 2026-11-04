import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import PackageBrowser from '../../src/components/PackageBrowser';
import { checkDiscountCode } from '../../src/api/discounts';
import type { Product } from '../../src/api/catalog';

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

jest.mock('../../src/api/discounts', () => ({
  checkDiscountCode: jest.fn(),
}));

const mockedCheckDiscountCode = checkDiscountCode as jest.Mock;

const products: Product[] = [
  {
    id: 'p1',
    country_id: 1,
    title_en: 'Starter',
    title_bn: null,
    data_amount_gb: 3,
    validity_days: 7,
    retail_price: 10,
    currency: 'EUR',
    is_unlimited: false,
    is_active: true,
    is_featured: false,
    coverage_networks: null,
  },
];

function renderBrowser() {
  return render(
    <AppSettingsProvider>
      <PackageBrowser products={products} />
    </AppSettingsProvider>
  );
}

describe('Discount code entry, pre-login (FR-302)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the estimated saving on every visible package for a valid PERCENT code', async () => {
    mockedCheckDiscountCode.mockResolvedValue({
      valid: true,
      code: 'SAVE20',
      description: null,
      discount_type: 'PERCENT',
      value: '20',
      max_discount_amount: null,
      scoped: false,
    });

    const { getByTestId, findByTestId } = await renderBrowser();

    await fireEvent.changeText(getByTestId('discount-code-input'), 'save20');
    await fireEvent.press(getByTestId('discount-code-apply'));

    expect(mockedCheckDiscountCode).toHaveBeenCalledWith('SAVE20');
    const checkedOk = await findByTestId('discount-code-checked-ok');
    expect(checkedOk).toBeTruthy();

    // 10 EUR - 20% = 8 EUR, formatted (no rates mocked -> 1:1 EUR fallback).
    const discounted = await findByTestId('package-discounted-price-p1');
    expect(discounted.props.children).toContain('8.00');
  });

  it('caps a PERCENT discount at max_discount_amount', async () => {
    mockedCheckDiscountCode.mockResolvedValue({
      valid: true,
      code: 'BIGSAVE',
      description: null,
      discount_type: 'PERCENT',
      value: '50',
      max_discount_amount: '2',
      scoped: false,
    });

    const { getByTestId, findByTestId } = await renderBrowser();

    await fireEvent.changeText(getByTestId('discount-code-input'), 'bigsave');
    await fireEvent.press(getByTestId('discount-code-apply'));

    // 50% of 10 EUR would be 5 EUR, but capped at 2 EUR -> 8 EUR, not 5.
    const discounted = await findByTestId('package-discounted-price-p1');
    expect(discounted.props.children).toContain('8.00');
  });

  it('shows the backend reason and no estimate for an invalid code', async () => {
    mockedCheckDiscountCode.mockResolvedValue({ valid: false, reason: "That discount code isn't valid." });

    const { getByTestId, findByTestId, queryByTestId } = await renderBrowser();

    await fireEvent.changeText(getByTestId('discount-code-input'), 'nope');
    await fireEvent.press(getByTestId('discount-code-apply'));

    const error = await findByTestId('discount-code-error');
    expect(error.props.children).toBe("That discount code isn't valid.");
    expect(queryByTestId('package-discounted-price-p1')).toBeNull();
  });

  it('clears the applied estimate when the code is cleared', async () => {
    mockedCheckDiscountCode.mockResolvedValue({
      valid: true,
      code: 'SAVE20',
      description: null,
      discount_type: 'PERCENT',
      value: '20',
      max_discount_amount: null,
      scoped: false,
    });

    const { getByTestId, findByTestId, queryByTestId } = await renderBrowser();

    await fireEvent.changeText(getByTestId('discount-code-input'), 'save20');
    await fireEvent.press(getByTestId('discount-code-apply'));
    await findByTestId('package-discounted-price-p1');

    await fireEvent.press(getByTestId('discount-code-clear'));

    await waitFor(() => expect(queryByTestId('package-discounted-price-p1')).toBeNull());
  });
});
