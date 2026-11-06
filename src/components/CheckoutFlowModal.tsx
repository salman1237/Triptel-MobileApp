import React from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppSettings } from '../state/AppSettingsContext';
import type { Order } from '../api/orders';
import EsimQr from './EsimQr';
import { esimInstallLinks } from '../lib/esimInstall';

// The working/preparing/success/error stages of the wallet-checkout state
// machine (FR-305) - see docs/Architecture.md -> "The checkout state
// machine". The richer "setting up" copy (FR-308) and the refund-status
// wording (FR-309) are later FRs that build on the still-minimal preparing/
// error stages. The one rule already in force here, straight from a real
// web-app incident (docs/Architecture.md -> "Lessons from the web app"):
// a PROCESSING/still-polling order is never shown as a failure.
export type CheckoutFlowStage =
  | { stage: 'working' }
  | { stage: 'preparing' }
  | { stage: 'success'; order: Order }
  | { stage: 'error'; message: string };

export type CheckoutFlowModalProps = {
  flow: CheckoutFlowStage | null;
  onClose: () => void;
  onRetry: () => void;
};

export default function CheckoutFlowModal({ flow, onClose, onRetry }: CheckoutFlowModalProps) {
  const { t } = useAppSettings();
  const router = useRouter();
  if (!flow) return null;

  function handleViewMyEsims() {
    onClose();
    router.push('/my-esims');
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} testID="checkout-flow-modal">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {flow.stage === 'working' && (
            <View testID="checkout-working">
              <ActivityIndicator size="large" style={styles.spinner} />
              <Text style={styles.title}>{t('checkout', 'working_title', 'Setting up your eSIM')}</Text>
              <Text style={styles.body}>
                {t('checkout', 'working_body', 'This usually takes 10-20 seconds. Please keep this open.')}
              </Text>
            </View>
          )}

          {flow.stage === 'preparing' && (
            <View testID="checkout-preparing">
              <Text style={styles.title}>{t('checkout', 'preparing_title', 'Payment confirmed')}</Text>
              <Text style={styles.body}>
                {t(
                  'checkout',
                  'preparing_body',
                  "Your eSIM is being issued by the network. This usually takes a minute or two - it will appear in My eSIMs. Please don't buy again, you have already paid for this one."
                )}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t('checkout', 'close', 'Close')}
                style={styles.primaryButton}
                testID="checkout-preparing-close"
              >
                <Text style={styles.primaryButtonText}>{t('checkout', 'close', 'Close')}</Text>
              </Pressable>
            </View>
          )}

          {flow.stage === 'success' && (() => {
            const qrValue = flow.order.esim_profile?.qr_code_data;
            const install = esimInstallLinks(flow.order.esim_profile?.lpa_string);
            return (
              <View testID="checkout-success">
                <Text style={styles.title}>{t('checkout', 'success_title', 'Your eSIM is ready')}</Text>
                <Text style={styles.body} testID="checkout-success-order-no">
                  {t('checkout', 'success_order', 'Order')} #{flow.order.order_no}
                </Text>
                {qrValue && (
                  <View style={styles.qrWrap} testID="checkout-success-qr">
                    <EsimQr value={qrValue} size={150} />
                  </View>
                )}
                {(install.ios || install.android) && (
                  <View style={styles.row} testID="checkout-success-install-links">
                    {install.ios && (
                      <Pressable
                        onPress={() => Linking.openURL(install.ios as string)}
                        accessibilityRole="button"
                        accessibilityLabel={t('checkout', 'install_ios', 'Install on iPhone')}
                        style={styles.secondaryButton}
                        testID="checkout-success-install-ios"
                      >
                        <Text style={styles.secondaryButtonText}>{t('checkout', 'install_ios', 'Install on iPhone')}</Text>
                      </Pressable>
                    )}
                    {install.android && (
                      <Pressable
                        onPress={() => Linking.openURL(install.android as string)}
                        accessibilityRole="button"
                        accessibilityLabel={t('checkout', 'install_android', 'Install on Android')}
                        style={styles.secondaryButton}
                        testID="checkout-success-install-android"
                      >
                        <Text style={styles.secondaryButtonText}>{t('checkout', 'install_android', 'Install on Android')}</Text>
                      </Pressable>
                    )}
                  </View>
                )}
                <View style={styles.row}>
                  <Pressable
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel={t('checkout', 'close', 'Close')}
                    style={styles.secondaryButton}
                    testID="checkout-success-close"
                  >
                    <Text style={styles.secondaryButtonText}>{t('checkout', 'close', 'Close')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleViewMyEsims}
                    accessibilityRole="button"
                    accessibilityLabel={t('checkout', 'view_my_esims', 'View & Print')}
                    style={styles.primaryButton}
                    testID="checkout-success-view-my-esims"
                  >
                    <Text style={styles.primaryButtonText}>{t('checkout', 'view_my_esims', 'View & Print')}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })()}

          {flow.stage === 'error' && (
            <View testID="checkout-error">
              <Text style={styles.title}>{t('checkout', 'error_title', "Purchase didn't go through")}</Text>
              <Text style={styles.body} testID="checkout-error-message">
                {flow.message}
              </Text>
              <View style={styles.row}>
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel={t('checkout', 'close', 'Close')}
                  style={styles.secondaryButton}
                  testID="checkout-error-close"
                >
                  <Text style={styles.secondaryButtonText}>{t('checkout', 'close', 'Close')}</Text>
                </Pressable>
                <Pressable
                  onPress={onRetry}
                  accessibilityRole="button"
                  accessibilityLabel={t('checkout', 'retry', 'Try again')}
                  style={styles.primaryButton}
                  testID="checkout-error-retry"
                >
                  <Text style={styles.primaryButtonText}>{t('checkout', 'retry', 'Try again')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  spinner: { marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  body: { fontSize: 13, color: '#344054', textAlign: 'center', marginBottom: 16 },
  qrWrap: { alignItems: 'center', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  primaryButton: {
    minHeight: 44,
    flex: 1,
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  secondaryButton: {
    minHeight: 44,
    flex: 1,
    backgroundColor: '#F2F4F7',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#344054', fontSize: 14, fontWeight: '700' },
});
