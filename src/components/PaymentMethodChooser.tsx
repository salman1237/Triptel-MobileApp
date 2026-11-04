import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppSettings } from '../state/AppSettingsContext';

// FR-304 - shown only when the wallet (DEFAULT + REWARD) can actually cover
// the payable amount; otherwise Buy Now goes straight to the gateway and
// this never opens. RN port of the web's PaymentMethodChooser.tsx. The
// wallet/gateway actions themselves (actually charging something) are later
// FRs (FR-305 wallet checkout, FR-306 gateway checkout) - this component
// only decides and shows the choice, it doesn't execute it yet.
export type PaymentMethodChooserProps = {
  visible: boolean;
  payableAmount: number;
  walletBalance: number;
  onChooseWallet: () => void;
  onChooseGateway: () => void;
  onCancel: () => void;
};

export default function PaymentMethodChooser({
  visible,
  payableAmount,
  walletBalance,
  onChooseWallet,
  onChooseGateway,
  onCancel,
}: PaymentMethodChooserProps) {
  const { t, formatPrice } = useAppSettings();
  const walletAfter = walletBalance - payableAmount;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} testID="payment-method-chooser">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('checkout', 'payment_method_title', 'How would you like to pay?')}</Text>
          <Text style={styles.total}>
            {t('checkout', 'payment_method_total', 'Total')}: {formatPrice(payableAmount)}
          </Text>

          <Pressable
            onPress={onChooseWallet}
            accessibilityRole="button"
            accessibilityLabel={t('checkout', 'payment_method_wallet', 'Wallet balance')}
            style={styles.option}
            testID="payment-method-wallet"
          >
            <Text style={styles.optionTitle}>{t('checkout', 'payment_method_wallet', 'Wallet balance')}</Text>
            <Text style={styles.optionMeta}>
              {formatPrice(walletBalance)} {t('checkout', 'payment_method_available', 'available')} ·{' '}
              {formatPrice(walletAfter)} {t('checkout', 'payment_method_left_after', 'left after')}
            </Text>
          </Pressable>

          <Pressable
            onPress={onChooseGateway}
            accessibilityRole="button"
            accessibilityLabel={t('checkout', 'payment_method_gateway', 'Card or mobile banking')}
            style={styles.option}
            testID="payment-method-gateway"
          >
            <Text style={styles.optionTitle}>{t('checkout', 'payment_method_gateway', 'Card or mobile banking')}</Text>
            <Text style={styles.optionMeta}>
              {t('checkout', 'payment_method_gateway_note', 'bKash, Nagad, Rocket, Visa, Mastercard')}
            </Text>
          </Pressable>

          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel={t('checkout', 'payment_method_cancel', 'Cancel')}
            style={styles.cancelButton}
            testID="payment-method-cancel"
          >
            <Text style={styles.cancelText}>{t('checkout', 'payment_method_cancel', 'Cancel')}</Text>
          </Pressable>
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
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  total: { fontSize: 14, color: '#344054', marginBottom: 16 },
  option: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  optionTitle: { fontSize: 15, fontWeight: '700' },
  optionMeta: { fontSize: 12, color: '#667085', marginTop: 4 },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  cancelText: { color: '#667085', fontSize: 13, fontWeight: '600' },
});
