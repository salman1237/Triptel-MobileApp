import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppSettings } from '../state/AppSettingsContext';

// FR-302 - mirrors the web's DiscountCodeBox.tsx. Lives next to the package
// list, not inside a payment popup, for the same reason the web does: Buy
// Now can go straight to the gateway, so a field that only existed in a
// payment modal would be unreachable for exactly the shoppers most likely to
// want a discount.
export type DiscountCodeBoxProps = {
  value: string;
  onChangeValue: (code: string) => void;
  checking: boolean;
  checkedOk: { code: string; note: string } | null;
  error: string | null;
  onApply: () => void;
  onClear: () => void;
};

export default function DiscountCodeBox({
  value,
  onChangeValue,
  checking,
  checkedOk,
  error,
  onApply,
  onClear,
}: DiscountCodeBoxProps) {
  const { t } = useAppSettings();

  return (
    <View style={styles.container} testID="discount-code-box">
      <Text style={styles.label}>{t('checkout', 'discount_code_label', 'Discount code')}</Text>

      <View style={styles.row}>
        <TextInput
          value={value}
          onChangeText={(text) => onChangeValue(text.toUpperCase())}
          placeholder={t('checkout', 'discount_code_placeholder', 'Enter a code')}
          accessibilityLabel={t('checkout', 'discount_code_placeholder', 'Enter a code')}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
          testID="discount-code-input"
        />
        {value.trim() !== '' && !checkedOk && (
          <Pressable
            onPress={onApply}
            disabled={checking}
            accessibilityRole="button"
            accessibilityLabel={t('checkout', 'discount_code_apply', 'Apply')}
            style={[styles.applyButton, checking && styles.buttonDisabled]}
            testID="discount-code-apply"
          >
            {checking ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.applyButtonText}>{t('checkout', 'discount_code_apply', 'Apply')}</Text>
            )}
          </Pressable>
        )}
        {value.trim() !== '' && (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={t('checkout', 'discount_code_clear', 'Clear')}
            style={styles.clearButton}
            testID="discount-code-clear"
          >
            <Text style={styles.clearButtonText}>{t('checkout', 'discount_code_clear', 'Clear')}</Text>
          </Pressable>
        )}
      </View>

      {checkedOk && (
        <Text style={styles.checkedOk} testID="discount-code-checked-ok">
          {checkedOk.code} {t('checkout', 'discount_code_looks_valid', 'looks valid')} — {checkedOk.note}
        </Text>
      )}

      {error && (
        <Text style={styles.error} testID="discount-code-error">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  applyButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  applyButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  clearButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F4F7',
    borderRadius: 8,
  },
  clearButtonText: { color: '#344054', fontSize: 13, fontWeight: '700' },
  checkedOk: { marginTop: 6, fontSize: 12, color: '#027A48', fontWeight: '600' },
  error: { marginTop: 6, fontSize: 12, color: '#B42318' },
});
