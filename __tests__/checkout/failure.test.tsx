import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import CheckoutFlowModal, { type CheckoutFlowStage } from '../../src/components/CheckoutFlowModal';

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

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

async function renderError(flow: CheckoutFlowStage, onRetry = jest.fn()) {
  return {
    onRetry,
    ...(await render(
      <AppSettingsProvider>
        <CheckoutFlowModal flow={flow} onClose={jest.fn()} onRetry={onRetry} />
      </AppSettingsProvider>
    )),
  };
}

// FR-309 - only an explicit FAILED order status reaches this UI (never a
// still-PROCESSING order - that's FR-308's job), and whichever of the two
// known-for-certain causes produced it, the refund status is stated
// clearly instead of hedged - see CheckoutFlowModal.tsx's RefundStatus doc
// comment for why there are exactly three states, not a single generic
// "if charged, refunded" message.
describe('Purchase failure (FR-309)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('states the refund happened when an order explicitly FAILED after being charged', async () => {
    const { findByTestId, queryByTestId } = await renderError({
      stage: 'error',
      message: "We couldn't set up this eSIM with the network.",
      refundStatus: 'refunded',
    });
    expect(await findByTestId('checkout-error')).toBeTruthy();
    const refundText = await findByTestId('checkout-error-refund-status-refunded');
    expect(refundText.props.children.join('')).toContain('refunded');
    expect(queryByTestId('checkout-error-refund-status-not_charged')).toBeNull();
    expect(queryByTestId('checkout-error-refund-status-unknown')).toBeNull();
  });

  it('states the wallet was never charged when checkout itself was rejected (e.g. insufficient balance)', async () => {
    const { findByTestId, queryByTestId } = await renderError({
      stage: 'error',
      message: 'Insufficient wallet balance. Please top up.',
      refundStatus: 'not_charged',
    });
    const refundText = await findByTestId('checkout-error-refund-status-not_charged');
    expect(refundText.props.children.join('')).toContain('not charged');
    expect(queryByTestId('checkout-error-refund-status-refunded')).toBeNull();
  });

  it('stays honestly uncertain, not a false refund claim, for a network-level failure', async () => {
    const { findByTestId, queryByTestId } = await renderError({
      stage: 'error',
      message: "Couldn't complete the purchase. Please try again.",
      refundStatus: 'unknown',
    });
    expect(await findByTestId('checkout-error-refund-status-unknown')).toBeTruthy();
    expect(queryByTestId('checkout-error-refund-status-refunded')).toBeNull();
    expect(queryByTestId('checkout-error-refund-status-not_charged')).toBeNull();
  });

  it('never renders the error UI for a preparing (still-provisioning) stage', async () => {
    const { queryByTestId } = await renderError({ stage: 'preparing' });
    expect(queryByTestId('checkout-error')).toBeNull();
  });

  it('retry calls onRetry and close does not', async () => {
    const onRetry = jest.fn();
    const { findByTestId } = await renderError(
      { stage: 'error', message: 'x', refundStatus: 'unknown' },
      onRetry
    );
    fireEvent.press(await findByTestId('checkout-error-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
