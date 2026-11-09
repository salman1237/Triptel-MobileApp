import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AppSettingsProvider } from '../../src/state/AppSettingsContext';
import { buildEsimReceiptHtml } from '../../src/lib/receiptHtml';
import { shareEsimReceipt } from '../../src/lib/esimReceipt';
import EsimReceiptButton from '../../src/components/esim/EsimReceiptButton';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

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
  getPublicSettings: jest.fn().mockResolvedValue({ bangla_qr_image: null, payment_methods: [], platform_name: 'Triptel' }),
}));

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

// EsimReceiptButton renders a real EsimQr for the hidden QR capture - mock it
// so getRef fires immediately with a fake SVG ref, instead of depending on
// react-native-svg's real native toDataURL bridge call inside jest.
let lastQrProps: { value: string; getRef?: (ref: unknown) => void } | null = null;
jest.mock('../../src/components/EsimQr', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: { value: string; getRef?: (ref: unknown) => void }) => {
      lastQrProps = props;
      if (props.getRef) {
        props.getRef({ toDataURL: (cb: (base64: string) => void) => cb('FAKEBASE64') });
      }
      return <View testID="mock-esim-qr" />;
    },
  };
});

const mockedPrintToFileAsync = Print.printToFileAsync as jest.Mock;
const mockedIsAvailableAsync = Sharing.isAvailableAsync as jest.Mock;
const mockedShareAsync = Sharing.shareAsync as jest.Mock;

function renderButton(overrides: Partial<React.ComponentProps<typeof EsimReceiptButton>> = {}) {
  const props: React.ComponentProps<typeof EsimReceiptButton> = {
    productTitle: 'Bangladesh 7 Days 5GB',
    orderNo: 'ORD-20261101-ABCDEF',
    iccid: '8988211000000000001',
    dataLabel: '5 GB',
    validityDays: 7,
    expiresLabel: '09 Nov 2026, 14:00 (GMT+6)',
    lpaString: 'LPA:1$esim.example.com$MATCHING-ID-1',
    qrValue: 'LPA:1$esim.example.com$MATCHING-ID-1',
    ...overrides,
  };
  return render(
    <AppSettingsProvider>
      <EsimReceiptButton {...props} />
    </AppSettingsProvider>
  );
}

// FR-404 - render an eSIM receipt to PDF and share it.
describe('eSIM receipt (FR-404)', () => {
  describe('buildEsimReceiptHtml', () => {
    it('includes every detail row and the activation code', () => {
      const html = buildEsimReceiptHtml({
        brand: 'Triptel',
        productTitle: 'Bangladesh 7 Days 5GB',
        orderNo: 'ORD-20261101-ABCDEF',
        iccid: '8988211000000000001',
        dataLabel: '5 GB',
        validityDays: 7,
        expiresLabel: '09 Nov 2026, 14:00 (GMT+6)',
        lpaString: 'LPA:1$esim.example.com$MATCHING-ID-1',
        qrDataUri: 'data:image/png;base64,FAKE',
      });

      expect(html).toContain('ORD-20261101-ABCDEF');
      expect(html).toContain('Bangladesh 7 Days 5GB');
      expect(html).toContain('8988211000000000001');
      expect(html).toContain('5 GB');
      expect(html).toContain('7 Days');
      expect(html).toContain('09 Nov 2026, 14:00 (GMT+6)');
      expect(html).toContain('LPA:1$esim.example.com$MATCHING-ID-1');
      expect(html).toContain('data:image/png;base64,FAKE');
      expect(html).toContain('Triptel');
    });

    it('omits the QR image block when no QR data is available', () => {
      const html = buildEsimReceiptHtml({
        brand: 'Triptel',
        productTitle: 'Bangladesh 7 Days 5GB',
        orderNo: 'ORD-1',
        iccid: null,
        dataLabel: '5 GB',
        validityDays: 7,
        expiresLabel: '7 days after you install it',
        lpaString: null,
        qrDataUri: null,
      });

      expect(html).not.toContain('<img');
      expect(html).not.toContain('Activation Code');
    });

    it('escapes HTML-significant characters in free-text fields', () => {
      const html = buildEsimReceiptHtml({
        brand: 'Triptel',
        productTitle: '<script>alert(1)</script>',
        orderNo: 'ORD-1',
        iccid: null,
        dataLabel: '5 GB',
        validityDays: 7,
        expiresLabel: '-',
        lpaString: null,
        qrDataUri: null,
      });

      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('shareEsimReceipt', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('prints to a PDF file then opens the share sheet on it', async () => {
      mockedPrintToFileAsync.mockResolvedValue({ uri: 'file:///tmp/receipt.pdf' });
      mockedIsAvailableAsync.mockResolvedValue(true);
      mockedShareAsync.mockResolvedValue(undefined);

      await shareEsimReceipt({
        brand: 'Triptel',
        productTitle: 'Bangladesh 7 Days 5GB',
        orderNo: 'ORD-1',
        iccid: null,
        dataLabel: '5 GB',
        validityDays: 7,
        expiresLabel: '-',
        lpaString: null,
        qrDataUri: null,
      });

      expect(mockedPrintToFileAsync).toHaveBeenCalledWith(expect.objectContaining({ html: expect.stringContaining('ORD-1') }));
      expect(mockedShareAsync).toHaveBeenCalledWith('file:///tmp/receipt.pdf', expect.objectContaining({ mimeType: 'application/pdf' }));
    });

    it('throws instead of silently doing nothing when sharing is unavailable', async () => {
      mockedPrintToFileAsync.mockResolvedValue({ uri: 'file:///tmp/receipt.pdf' });
      mockedIsAvailableAsync.mockResolvedValue(false);

      await expect(
        shareEsimReceipt({
          brand: 'Triptel',
          productTitle: 'P',
          orderNo: 'ORD-1',
          iccid: null,
          dataLabel: '5 GB',
          validityDays: 7,
          expiresLabel: '-',
          lpaString: null,
          qrDataUri: null,
        })
      ).rejects.toThrow();
      expect(mockedShareAsync).not.toHaveBeenCalled();
    });
  });

  describe('EsimReceiptButton', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      lastQrProps = null;
    });

    it('captures the on-screen QR and shares the receipt when pressed', async () => {
      mockedPrintToFileAsync.mockResolvedValue({ uri: 'file:///tmp/receipt.pdf' });
      mockedIsAvailableAsync.mockResolvedValue(true);
      mockedShareAsync.mockResolvedValue(undefined);

      const { findByTestId } = await renderButton();
      fireEvent.press(await findByTestId('esim-status-share-receipt'));

      await waitFor(() => expect(mockedPrintToFileAsync).toHaveBeenCalled());
      const html = mockedPrintToFileAsync.mock.calls[0][0].html as string;
      expect(html).toContain('data:image/png;base64,FAKEBASE64');
      expect(mockedShareAsync).toHaveBeenCalled();
    });

    it('uses the same value the on-screen QR encodes, not a different one', async () => {
      mockedPrintToFileAsync.mockResolvedValue({ uri: 'file:///tmp/receipt.pdf' });
      mockedIsAvailableAsync.mockResolvedValue(true);

      const { findByTestId } = await renderButton({ qrValue: 'LPA:1$distinct.example.com$OTHER-ID' });
      await findByTestId('esim-status-share-receipt');

      expect(lastQrProps?.value).toBe('LPA:1$distinct.example.com$OTHER-ID');
    });

    it('skips the hidden QR entirely when there is nothing to encode', async () => {
      const { findByTestId, queryByTestId } = await renderButton({ qrValue: null });
      await findByTestId('esim-status-share-receipt');
      expect(queryByTestId('esim-receipt-hidden-qr')).toBeNull();
    });

    it('shows an error message, not a silent failure, when generating the PDF fails', async () => {
      mockedPrintToFileAsync.mockRejectedValue(new Error('disk full'));

      const { findByTestId } = await renderButton();
      fireEvent.press(await findByTestId('esim-status-share-receipt'));

      expect(await findByTestId('esim-status-receipt-error')).toBeTruthy();
    });
  });
});
