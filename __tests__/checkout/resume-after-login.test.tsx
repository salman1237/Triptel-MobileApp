import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import PackageBrowser from '../../src/components/PackageBrowser';
import { usePendingPurchase } from '../../src/state/pendingPurchase';
import { checkDiscountCode } from '../../src/api/discounts';
import { getMyWallets } from '../../src/api/wallets';
import { getMe } from '../../src/api/auth';
import type { Product } from '../../src/api/catalog';
import type { Wallet } from '../../src/api/wallets';

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
  getPublicSettings: jest.fn().mockResolvedValue({ bangla_qr_image: null, payment_methods: [] }),
}));

jest.mock('../../src/api/auth', () => ({
  getMe: jest.fn(),
}));

jest.mock('../../src/api/discounts', () => ({
  checkDiscountCode: jest.fn(),
  previewDiscount: jest.fn(),
}));

jest.mock('../../src/api/wallets', () => ({
  getMyWallets: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetMe = getMe as jest.Mock;
const mockedGetMyWallets = getMyWallets as jest.Mock;
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

function wallet(overrides: Partial<Wallet>): Wallet {
  return {
    id: 'w',
    wallet_type: 'DEFAULT',
    balance: 0,
    currency: 'EUR',
    is_frozen: false,
    ...overrides,
  };
}

function renderBrowser(slug = 'bangladesh') {
  return render(
    <AppSettingsProvider>
      <AuthProvider>
        <PackageBrowser products={products} countrySlug={slug} />
      </AuthProvider>
    </AppSettingsProvider>
  );
}

// FR-106 - a Buy Now tap while signed out stashes the selection and sends
// the user to log in; once they're back here signed in, PackageBrowser
// restores it and re-runs Buy Now automatically.
describe('Resume purchase after login (FR-106)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePendingPurchase.setState({ pending: null });
  });

  it('shows Buy Now even when signed out', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
    const { findByTestId } = await renderBrowser();
    expect(await findByTestId('package-buy-now-p1')).toBeTruthy();
  });

  it('stashes the product and navigates to login when Buy Now is tapped signed out', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
    const { findByTestId } = await renderBrowser();

    fireEvent.press(await findByTestId('package-buy-now-p1'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/auth/login'));
    expect(usePendingPurchase.getState().pending).toEqual({
      countrySlug: 'bangladesh',
      productId: 'p1',
      discountCode: null,
    });
  });

  it('stashes the checked discount code too, not just the product', async () => {
    mockedSecureStore.getItemAsync.mockResolvedValue(null);
    mockedCheckDiscountCode.mockResolvedValue({
      valid: true,
      code: 'SAVE20',
      description: null,
      discount_type: 'PERCENT',
      value: '20',
      max_discount_amount: null,
      scoped: true,
    });
    const { findByTestId } = await renderBrowser();

    fireEvent.changeText(await findByTestId('discount-code-input'), 'SAVE20');
    fireEvent.press(await findByTestId('discount-code-apply'));
    await findByTestId('discount-code-checked-ok');

    fireEvent.press(await findByTestId('package-buy-now-p1'));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/auth/login'));
    expect(usePendingPurchase.getState().pending).toEqual({
      countrySlug: 'bangladesh',
      productId: 'p1',
      discountCode: 'SAVE20',
    });
  });

  it('auto-resumes checkout once signed in, landing in the payment-method chooser', async () => {
    usePendingPurchase.setState({ pending: { countrySlug: 'bangladesh', productId: 'p1', discountCode: null } });
    mockedSecureStore.getItemAsync.mockResolvedValue('existing-token');
    mockedGetMe.mockResolvedValue(meResponseBody);
    mockedGetMyWallets.mockResolvedValue([wallet({ wallet_type: 'DEFAULT', balance: 50 })]);

    const { findByTestId } = await renderBrowser();

    expect(await findByTestId('payment-method-chooser')).toBeTruthy();
    expect(mockedGetMyWallets).toHaveBeenCalledWith('existing-token');
    expect(usePendingPurchase.getState().pending).toBeNull();
  });

  it('restores the discount code before resuming', async () => {
    usePendingPurchase.setState({ pending: { countrySlug: 'bangladesh', productId: 'p1', discountCode: 'SAVE20' } });
    mockedSecureStore.getItemAsync.mockResolvedValue('existing-token');
    mockedGetMe.mockResolvedValue(meResponseBody);
    mockedGetMyWallets.mockResolvedValue([wallet({ wallet_type: 'DEFAULT', balance: 50 })]);
    mockedCheckDiscountCode.mockResolvedValue({
      valid: true,
      code: 'SAVE20',
      description: null,
      discount_type: 'PERCENT',
      value: '20',
      max_discount_amount: null,
      scoped: true,
    });

    const { findByTestId } = await renderBrowser();

    expect(await findByTestId('payment-method-chooser')).toBeTruthy();
    expect(mockedCheckDiscountCode).toHaveBeenCalledWith('SAVE20');
    expect((await findByTestId('discount-code-input')).props.value).toBe('SAVE20');
  });

  it('does not resume a pending purchase saved for a different country', async () => {
    usePendingPurchase.setState({ pending: { countrySlug: 'japan', productId: 'p1', discountCode: null } });
    mockedSecureStore.getItemAsync.mockResolvedValue('existing-token');
    mockedGetMe.mockResolvedValue(meResponseBody);

    const { findByTestId, queryByTestId } = await renderBrowser('bangladesh');

    await findByTestId('package-buy-now-p1');
    await waitFor(() => expect(mockedGetMe).toHaveBeenCalled());
    expect(queryByTestId('payment-method-chooser')).toBeNull();
    // Untouched - still there for whichever screen (japan) actually matches it.
    expect(usePendingPurchase.getState().pending).toEqual({ countrySlug: 'japan', productId: 'p1', discountCode: null });
  });
});
