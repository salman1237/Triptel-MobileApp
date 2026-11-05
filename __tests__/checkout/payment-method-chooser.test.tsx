import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { AuthProvider } from '../../src/state/AuthContext';
import PackageBrowser from '../../src/components/PackageBrowser';
import { getMyWallets } from '../../src/api/wallets';
import { checkoutWithWallet } from '../../src/api/orders';
import { waitForOrder } from '../../src/lib/waitForOrder';
import { getMe } from '../../src/api/auth';
import { ApiError } from '../../src/lib/apiClient';
import type { Product } from '../../src/api/catalog';
import type { Wallet } from '../../src/api/wallets';
import type { Order } from '../../src/api/orders';

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

jest.mock('../../src/api/wallets', () => ({
  getMyWallets: jest.fn(),
}));

jest.mock('../../src/api/orders', () => ({
  checkoutWithWallet: jest.fn(),
}));

jest.mock('../../src/lib/waitForOrder', () => ({
  waitForOrder: jest.fn(),
}));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedGetMe = getMe as jest.Mock;
const mockedGetMyWallets = getMyWallets as jest.Mock;
const mockedCheckoutWithWallet = checkoutWithWallet as jest.Mock;
const mockedWaitForOrder = waitForOrder as jest.Mock;

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

async function renderAuthenticatedBrowser() {
  mockedSecureStore.getItemAsync.mockResolvedValue('existing-token');
  mockedGetMe.mockResolvedValue(meResponseBody);

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

describe('Payment method choice (FR-304)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the Wallet-vs-Gateway chooser when the wallet covers the price', async () => {
    mockedGetMyWallets.mockResolvedValue([
      wallet({ wallet_type: 'DEFAULT', balance: 7 }),
      wallet({ wallet_type: 'REWARD', balance: 5 }),
    ]);

    const { getByTestId, findByTestId } = await renderAuthenticatedBrowser();

    await fireEvent.press(getByTestId('package-buy-now-p1'));

    expect(await findByTestId('payment-method-chooser')).toBeTruthy();
    expect(mockedGetMyWallets).toHaveBeenCalledWith('existing-token');
  });

  it('goes straight to the gateway, with no chooser, when the wallet cannot cover the price', async () => {
    mockedGetMyWallets.mockResolvedValue([wallet({ wallet_type: 'DEFAULT', balance: 3 })]);

    const { getByTestId, findByTestId, queryByTestId } = await renderAuthenticatedBrowser();

    await fireEvent.press(getByTestId('package-buy-now-p1'));

    expect(await findByTestId('package-going-to-gateway-p1')).toBeTruthy();
    expect(queryByTestId('payment-method-chooser')).toBeNull();
  });

  it('excludes frozen and COMMISSION wallets from the spendable balance', async () => {
    mockedGetMyWallets.mockResolvedValue([
      wallet({ wallet_type: 'DEFAULT', balance: 100, is_frozen: true }),
      wallet({ wallet_type: 'COMMISSION', balance: 100 }),
      wallet({ wallet_type: 'REWARD', balance: 3 }),
    ]);

    const { getByTestId, findByTestId, queryByTestId } = await renderAuthenticatedBrowser();

    await fireEvent.press(getByTestId('package-buy-now-p1'));

    // Only the 3 EUR REWARD wallet is spendable - well short of the 10 EUR
    // price - so this must go to the gateway, not open the chooser.
    expect(await findByTestId('package-going-to-gateway-p1')).toBeTruthy();
    expect(queryByTestId('payment-method-chooser')).toBeNull();
  });

  it('records the choice and closes the chooser when Gateway is picked', async () => {
    mockedGetMyWallets.mockResolvedValue([wallet({ wallet_type: 'DEFAULT', balance: 50 })]);

    const { getByTestId, findByTestId, queryByTestId } = await renderAuthenticatedBrowser();

    await fireEvent.press(getByTestId('package-buy-now-p1'));
    await findByTestId('payment-method-chooser');

    await fireEvent.press(getByTestId('payment-method-gateway'));

    await waitFor(() => expect(queryByTestId('payment-method-chooser')).toBeNull());
    expect(await findByTestId('package-selected-method-p1')).toBeTruthy();
  });
});

function order(overrides: Partial<Order>): Order {
  return {
    id: 'o1',
    order_no: 'ORD-1',
    buyer_id: 'u1',
    beneficiary_id: 'u1',
    product_id: 'p1',
    total_amount: 10,
    discount_amount: 0,
    currency: 'EUR',
    payment_method: 'WALLET',
    status: 'PROCESSING',
    created_at: '2026-01-01T00:00:00Z',
    esim_profile: null,
    ...overrides,
  };
}

// FR-305 - choosing Wallet now actually charges it (POST /orders/checkout)
// and reaches one of success/preparing/error - see
// docs/Architecture.md -> "The checkout state machine". `waitForOrder` is
// mocked directly rather than its own getOrder dependency, so these tests
// don't depend on its internal real-timer polling loop.
describe('Wallet checkout (FR-305)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function chooseWallet() {
    mockedGetMyWallets.mockResolvedValue([wallet({ wallet_type: 'DEFAULT', balance: 50 })]);
    const utils = await renderAuthenticatedBrowser();
    await fireEvent.press(utils.getByTestId('package-buy-now-p1'));
    await utils.findByTestId('payment-method-chooser');
    await fireEvent.press(utils.getByTestId('payment-method-wallet'));
    return utils;
  }

  it('shows success with the order number once the order completes within the short poll window', async () => {
    mockedCheckoutWithWallet.mockResolvedValue(order({ status: 'PROCESSING' }));
    mockedWaitForOrder.mockResolvedValueOnce(order({ status: 'COMPLETED' }));

    const { findByTestId, queryByTestId } = await chooseWallet();

    expect(await findByTestId('checkout-success')).toBeTruthy();
    expect((await findByTestId('checkout-success-order-no')).props.children.join('')).toContain('ORD-1');
    expect(queryByTestId('checkout-error')).toBeNull();
    expect(mockedCheckoutWithWallet).toHaveBeenCalledWith('existing-token', 'p1', undefined);
  });

  it('shows "preparing", never a failure, when the order is still provisioning past the short poll window', async () => {
    mockedCheckoutWithWallet.mockResolvedValue(order({ status: 'PROCESSING' }));
    // Short window times out (web's waitForOrder throws on timeout); the
    // background long-poll is left pending so it can't resolve yet.
    mockedWaitForOrder.mockRejectedValueOnce(new Error('still_processing')).mockReturnValueOnce(new Promise(() => {}));

    const { findByTestId, queryByTestId } = await chooseWallet();

    expect(await findByTestId('checkout-preparing')).toBeTruthy();
    expect(queryByTestId('checkout-error')).toBeNull();
    expect(queryByTestId('checkout-success')).toBeNull();
  });

  it('upgrades "preparing" to "success" if the background long-poll completes while the screen is still open', async () => {
    mockedCheckoutWithWallet.mockResolvedValue(order({ status: 'PROCESSING' }));
    let resolveLongPoll: (o: Order) => void = () => {};
    mockedWaitForOrder
      .mockRejectedValueOnce(new Error('still_processing'))
      .mockReturnValueOnce(new Promise<Order>((resolve) => (resolveLongPoll = resolve)));

    const { findByTestId } = await chooseWallet();
    await findByTestId('checkout-preparing');

    resolveLongPoll(order({ status: 'COMPLETED' }));

    expect(await findByTestId('checkout-success')).toBeTruthy();
  });

  it('shows an error with a retry action when the checkout call itself fails', async () => {
    mockedCheckoutWithWallet.mockRejectedValue(new ApiError(400, 'Insufficient wallet balance. Please top up.'));

    const { findByTestId } = await chooseWallet();

    expect(await findByTestId('checkout-error')).toBeTruthy();
    expect((await findByTestId('checkout-error-message')).props.children).toBe('Insufficient wallet balance. Please top up.');
    expect(await findByTestId('checkout-error-retry')).toBeTruthy();
  });

  it('shows an explicit failure, not a silent/preparing state, when the order settles as FAILED', async () => {
    mockedCheckoutWithWallet.mockResolvedValue(order({ status: 'PROCESSING' }));
    mockedWaitForOrder.mockResolvedValueOnce(order({ status: 'FAILED' }));

    const { findByTestId, queryByTestId } = await chooseWallet();

    expect(await findByTestId('checkout-error')).toBeTruthy();
    expect(queryByTestId('checkout-preparing')).toBeNull();
    expect(queryByTestId('checkout-success')).toBeNull();
  });
});
