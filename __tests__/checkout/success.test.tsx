import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import CheckoutFlowModal from '../../src/components/CheckoutFlowModal';
import type { Order } from '../../src/api/orders';

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

function order(overrides: Partial<Order>): Order {
  return {
    id: 'o1',
    order_no: 'ORD-20260101-ABCDEF',
    buyer_id: 'u1',
    beneficiary_id: 'u1',
    product_id: 'p1',
    total_amount: 10,
    discount_amount: 0,
    currency: 'EUR',
    payment_method: 'WALLET',
    status: 'COMPLETED',
    created_at: '2026-01-01T00:00:00Z',
    esim_profile: null,
    ...overrides,
  };
}

async function renderModal(order: Order) {
  return await render(
    <AppSettingsProvider>
      <CheckoutFlowModal flow={{ stage: 'success', order }} onClose={jest.fn()} onRetry={jest.fn()} />
    </AppSettingsProvider>
  );
}

// FR-307 - the success stage reveals the branded QR, install links, and a
// path to My eSIMs once the order has an eSIM profile attached.
describe('Purchase success (FR-307)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the order number', async () => {
    const { findByTestId } = await renderModal(order({}));
    const el = await findByTestId('checkout-success-order-no');
    expect(el.props.children.join('')).toContain('ORD-20260101-ABCDEF');
  });

  it('renders the branded QR when the order has eSIM QR data', async () => {
    const { findByTestId } = await renderModal(
      order({
        esim_profile: {
          id: 'e1',
          order_id: 'o1',
          iccid: '8901',
          lpa_string: 'LPA:1$sm-dp.example.com$MATCHING-ID',
          qr_code_data: 'LPA:1$sm-dp.example.com$MATCHING-ID',
          smdp_address: 'sm-dp.example.com',
          status: 'ACTIVE',
          is_mock_fallback: false,
          created_at: '2026-01-01T00:00:00Z',
        },
      })
    );
    expect(await findByTestId('checkout-success-qr')).toBeTruthy();
  });

  it('does not render a QR or install links when the order has no eSIM profile yet', async () => {
    const { findByTestId, queryByTestId } = await renderModal(order({ esim_profile: null }));
    await findByTestId('checkout-success');
    expect(queryByTestId('checkout-success-qr')).toBeNull();
    expect(queryByTestId('checkout-success-install-links')).toBeNull();
  });

  it('renders both install-on-iPhone and install-on-Android links for a valid LPA string', async () => {
    const { findByTestId } = await renderModal(
      order({
        esim_profile: {
          id: 'e1',
          order_id: 'o1',
          iccid: '8901',
          lpa_string: 'LPA:1$sm-dp.example.com$MATCHING-ID',
          qr_code_data: 'LPA:1$sm-dp.example.com$MATCHING-ID',
          smdp_address: 'sm-dp.example.com',
          status: 'ACTIVE',
          is_mock_fallback: false,
          created_at: '2026-01-01T00:00:00Z',
        },
      })
    );
    expect(await findByTestId('checkout-success-install-ios')).toBeTruthy();
    expect(await findByTestId('checkout-success-install-android')).toBeTruthy();
  });

  it('navigates to My eSIMs and closes the modal when "View & Print" is pressed', async () => {
    const onClose = jest.fn();
    const { findByTestId } = await render(
      <AppSettingsProvider>
        <CheckoutFlowModal flow={{ stage: 'success', order: order({}) }} onClose={onClose} onRetry={jest.fn()} />
      </AppSettingsProvider>
    );

    fireEvent.press(await findByTestId('checkout-success-view-my-esims'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/my-esims');
  });
});
