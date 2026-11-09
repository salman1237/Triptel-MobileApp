import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { buildEsimReceiptHtml } from './receiptHtml';
import type { EsimReceiptData } from './receiptHtml';

// FR-404 - renders the receipt to a PDF (expo-print, saved to the app's
// cache dir) and opens the native share sheet on it (expo-sharing) - the RN
// equivalent of the web print sheet's window.print(), which has no RN
// counterpart. Throws if sharing genuinely isn't available on this device,
// rather than silently doing nothing - the caller surfaces that as an error.
export async function shareEsimReceipt(data: EsimReceiptData): Promise<void> {
  const html = buildEsimReceiptHtml(data);
  const { uri } = await Print.printToFileAsync({ html });
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
