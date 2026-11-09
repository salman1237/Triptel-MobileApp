import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import EsimQr from '../EsimQr';
import { shareEsimReceipt } from '../../lib/esimReceipt';
import { useAppSettings } from '../../state/AppSettingsContext';

export type EsimReceiptButtonProps = {
  productTitle: string;
  orderNo: string;
  iccid: string | null;
  dataLabel: string;
  validityDays: number;
  expiresLabel: string;
  lpaString: string | null;
  // The exact same value the on-screen QR encodes - a second, independently
  // generated QR would risk drifting from it. null skips the QR entirely
  // (an eSIM can be revealed without qr_code_data/lpa_string yet - see
  // EsimStatusView's own guard for the same case).
  qrValue: string | null;
};

type QrSvgRef = { toDataURL: (callback: (base64: string) => void) => void };

// FR-404 - a "Share receipt" action next to Refresh on the detail screen,
// mirroring the web print sheet's "Print" button placement
// (frontend/src/app/my-esims/[id]/page.tsx). Keeps a permanently-mounted,
// off-screen EsimQr so its native SVG ref is ready the first time this is
// pressed, not re-rendered fresh on every tap.
export default function EsimReceiptButton(props: EsimReceiptButtonProps) {
  const { t, publicSettings } = useAppSettings();
  const qrRef = useRef<QrSvgRef | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function captureQrDataUri(): Promise<string | null> {
    if (!props.qrValue || !qrRef.current) return null;
    const ref = qrRef.current;
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('QR export timed out')), 5000);
      ref.toDataURL((base64) => {
        clearTimeout(timeout);
        resolve(`data:image/png;base64,${base64}`);
      });
    });
  }

  async function handlePress() {
    setGenerating(true);
    setError(null);
    try {
      const qrDataUri = await captureQrDataUri();
      await shareEsimReceipt({
        brand: publicSettings?.platform_name || 'Triptel',
        productTitle: props.productTitle,
        orderNo: props.orderNo,
        iccid: props.iccid,
        dataLabel: props.dataLabel,
        validityDays: props.validityDays,
        expiresLabel: props.expiresLabel,
        lpaString: props.lpaString,
        qrDataUri,
      });
    } catch {
      setError(t('esim_status', 'receipt_error', "Couldn't create the receipt. Try again."));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <View>
      {props.qrValue && (
        <View style={styles.hidden} pointerEvents="none" testID="esim-receipt-hidden-qr">
          <EsimQr
            value={props.qrValue}
            size={300}
            getRef={(ref) => {
              qrRef.current = ref as QrSvgRef;
            }}
          />
        </View>
      )}
      <Pressable
        onPress={handlePress}
        disabled={generating}
        accessibilityRole="button"
        accessibilityLabel={t('esim_status', 'share_receipt', 'Share receipt')}
        style={[styles.button, generating && styles.buttonDisabled]}
        testID="esim-status-share-receipt"
      >
        {generating ? (
          <ActivityIndicator size="small" color="#1D4ED8" />
        ) : (
          <Text style={styles.buttonText}>{t('esim_status', 'share_receipt', 'Share receipt')}</Text>
        )}
      </Pressable>
      {error && (
        <Text style={styles.error} testID="esim-status-receipt-error">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', opacity: 0, top: -1000 },
  button: {
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 12, fontWeight: '700', color: '#1D4ED8' },
  error: { fontSize: 11, color: '#B42318', marginTop: 6 },
});
