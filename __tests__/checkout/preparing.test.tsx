import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import CheckoutFlowModal from '../../src/components/CheckoutFlowModal';

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

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

// FR-308 - a still-provisioning (PROCESSING) order must show a calm,
// non-error "setting up your eSIM" state and never a failure UI - the
// specific web-app production incident this guards against (an early
// "still processing" poll once triggered a refund path for an
// already-charged, already-provisioning order). See
// docs/Architecture.md -> "Lessons from the web app".
describe('Purchase still-processing state (FR-308)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function renderPreparing(onClose = jest.fn()) {
    return {
      onClose,
      ...(await render(
        <AppSettingsProvider>
          <CheckoutFlowModal flow={{ stage: 'preparing' }} onClose={onClose} onRetry={jest.fn()} />
        </AppSettingsProvider>
      )),
    };
  }

  it('shows the preparing state, not an error or success state', async () => {
    const { findByTestId, queryByTestId } = await renderPreparing();
    expect(await findByTestId('checkout-preparing')).toBeTruthy();
    expect(queryByTestId('checkout-error')).toBeNull();
    expect(queryByTestId('checkout-success')).toBeNull();
    expect(queryByTestId('checkout-working')).toBeNull();
  });

  it('explains the order is paid and still provisioning, not failed', async () => {
    const { getByTestId } = await renderPreparing();
    const container = getByTestId('checkout-preparing');
    const text = JSON.stringify(container);
    expect(text).toContain('Payment confirmed');
    expect(text.toLowerCase()).not.toContain('fail');
  });

  it('closes via the Close button without navigating away', async () => {
    const onClose = jest.fn();
    const { findByTestId } = await renderPreparing(onClose);
    fireEvent.press(await findByTestId('checkout-preparing-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('offers a path to My eSIMs that closes the modal and navigates', async () => {
    const onClose = jest.fn();
    const { findByTestId } = await renderPreparing(onClose);
    fireEvent.press(await findByTestId('checkout-preparing-view-my-esims'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/my-esims');
  });
});
