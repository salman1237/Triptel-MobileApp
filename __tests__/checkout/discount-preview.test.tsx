import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import PackageBrowser from '../../src/components/PackageBrowser';
import { checkDiscountCode, previewDiscount } from '../../src/api/discounts';
import { getMe } from '../../src/api/auth';
import { ApiError } from '../../src/lib/apiClient';
import type { Product } from '../../src/api/catalog';

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
}));

jest.mock('../../src/api/auth', () => ({
  getMe: jest.fn(),
}));

jest.mock('../../src/api/discounts', () => ({
  checkDiscountCode: jest.fn(),
  previewDiscount: jest.fn(),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedCheckDiscountCode = checkDiscountCode as jest.Mock;
const mockedPreviewDiscount = previewDiscount as jest.Mock;
const mockedGetMe = getMe as jest.Mock;

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

const meResponseBody = {
  id: 'u1',
  email: 'traveler@example.com',
  username: 'traveler',
  role: 'USER',
  status: 'ACTIVE',
  phone: null,
  full_name: null,
  is_kyc_verified: false,
  preferred_currency: 'EUR',
  avatar_url: null,
  email_verified: true,
  has_google: false,
  wallets: [],
  merchant_profile: null,
  agent_profile: null,
};

async function renderAuthenticatedBrowser() {
  mockedSecureStore.getItemAsync.mockResolvedValue('existing-token');
  mockedGetMe.mockResolvedValue(meResponseBody);
  mockedCheckDiscountCode.mockResolvedValue({
    valid: true,
    code: 'SAVE20',
    description: null,
    discount_type: 'PERCENT',
    value: '20',
    max_discount_amount: null,
    scoped: true,
  });

  const utils = await render(
    <AppSettingsProvider>
      <AuthProvider>
        <PackageBrowser products={products} />
      </AuthProvider>
    </AppSettingsProvider>
  );
  await waitFor(() => expect(mockedGetMe).toHaveBeenCalled());
  return utils;
}

describe('Discount code entry, post-login (FR-303)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lets a signed-in user confirm the exact server-verified amount for a package', async () => {
    mockedPreviewDiscount.mockResolvedValue({
      valid: true,
      code: 'SAVE20',
      description: null,
      discount_type: 'PERCENT',
      value: '20',
      discount_amount: '2.00',
      list_price: '10.00',
      total: '8.00',
      currency: 'EUR',
    });

    const { getByTestId, findByTestId } = await renderAuthenticatedBrowser();

    await fireEvent.changeText(getByTestId('discount-code-input'), 'save20');
    await fireEvent.press(getByTestId('discount-code-apply'));
    await findByTestId('package-confirm-exact-p1');

    await fireEvent.press(getByTestId('package-confirm-exact-p1'));

    expect(mockedPreviewDiscount).toHaveBeenCalledWith('existing-token', 'SAVE20', 'p1');
    const exactPrice = await findByTestId('package-exact-price-p1');
    expect(exactPrice.props.children).toContain('8.00');
    expect(await findByTestId('package-exact-confirmed-p1')).toBeTruthy();
  });

  it('shows the backend reason when the code does not apply to this specific product', async () => {
    mockedPreviewDiscount.mockResolvedValue({ valid: false, reason: 'This code does not apply to this package.' });

    const { getByTestId, findByTestId, queryByTestId } = await renderAuthenticatedBrowser();

    await fireEvent.changeText(getByTestId('discount-code-input'), 'save20');
    await fireEvent.press(getByTestId('discount-code-apply'));
    await findByTestId('package-confirm-exact-p1');

    await fireEvent.press(getByTestId('package-confirm-exact-p1'));

    const error = await findByTestId('discount-preview-error');
    expect(error.props.children).toBe('This code does not apply to this package.');
    expect(queryByTestId('package-exact-price-p1')).toBeNull();
  });

  it('shows a server error (e.g. a since-expired code) without crashing', async () => {
    mockedPreviewDiscount.mockRejectedValue(new ApiError(400, "That code isn't valid."));

    const { getByTestId, findByTestId } = await renderAuthenticatedBrowser();

    await fireEvent.changeText(getByTestId('discount-code-input'), 'save20');
    await fireEvent.press(getByTestId('discount-code-apply'));
    await findByTestId('package-confirm-exact-p1');

    await fireEvent.press(getByTestId('package-confirm-exact-p1'));

    const error = await findByTestId('discount-preview-error');
    expect(error.props.children).toBe("That code isn't valid.");
  });
});
