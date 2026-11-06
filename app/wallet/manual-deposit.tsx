import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getPublicSettings } from '../../src/api/settings';
import type { PaymentMethod } from '../../src/api/settings';
import { submitManualDeposit } from '../../src/api/wallets';
import { ApiError } from '../../src/lib/apiClient';
import { useAppSettings } from '../../src/state/AppSettingsContext';
import { useAuth } from '../../src/state/AuthContext';

// FR-603 - submit a manual deposit (bank/bKash/Nagad/Rocket/QR) with a
// transaction ID for admin approval. Ported from the manual-deposit half
// of the web's src/app/wallet/page.tsx - the ShurjoPay instant top-up half
// is FR-602 (gateway, not built yet), kept deliberately separate here.
export default function ManualDepositScreen() {
  const { t, currency } = useAppSettings();
  const { token } = useAuth();

  const settingsQuery = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: () => getPublicSettings(),
  });
  const methods = settingsQuery.data?.payment_methods ?? [];

  const [selectedMethodName, setSelectedMethodName] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const effectiveMethodName = selectedMethodName ?? methods[0]?.name ?? null;
  const selectedMethod = methods.find((m) => m.name === effectiveMethodName) ?? null;

  const amountNumber = parseFloat(amount);
  const amountValid = Number.isFinite(amountNumber) && amountNumber > 0;
  const canSubmit = amountValid && transactionId.trim() !== '' && Boolean(selectedMethod) && !submitting;

  async function handleSubmit() {
    if (!token || !selectedMethod || !amountValid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitManualDeposit(token, {
        amount: amountNumber,
        currency,
        bankName: selectedMethod.name,
        transactionId: transactionId.trim(),
      });
      setSubmitted(true);
      setTransactionId('');
    } catch (err) {
      setSubmitError(
        err instanceof ApiError && typeof err.detail === 'string'
          ? err.detail
          : t('wallet', 'manual_deposit_network_error', "Couldn't submit your deposit. Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  function renderMethodDetails(method: PaymentMethod) {
    return (
      <View style={styles.methodDetails} testID="manual-deposit-method-details">
        {method.kind === 'qr' && settingsQuery.data?.bangla_qr_image && (
          <Image
            source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${settingsQuery.data.bangla_qr_image}` }}
            style={styles.qrImage}
            testID="manual-deposit-qr-image"
          />
        )}
        {method.account_name && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('wallet', 'deposit_account_name', 'Account name')}</Text>
            <Text style={styles.detailValue}>{method.account_name}</Text>
          </View>
        )}
        {method.account_number && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              {method.kind === 'bank'
                ? t('wallet', 'deposit_account_number', 'Account number')
                : t('wallet', 'deposit_number', 'Number')}
            </Text>
            <Text style={styles.detailValue} testID="manual-deposit-account-number">
              {method.account_number}
            </Text>
          </View>
        )}
        {method.branch && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('wallet', 'deposit_branch', 'Branch')}</Text>
            <Text style={styles.detailValue}>{method.branch}</Text>
          </View>
        )}
        {method.instructions && <Text style={styles.instructions}>{method.instructions}</Text>}
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={styles.container} testID="manual-deposit-success">
        <Text style={styles.title}>{t('wallet', 'deposit_submitted_title', 'Deposit slip submitted')}</Text>
        <Text style={styles.body}>
          {t(
            'wallet',
            'deposit_submitted_body',
            'An admin will verify your transaction and credit your balance shortly.'
          )}
        </Text>
        <Pressable
          onPress={() => setSubmitted(false)}
          accessibilityRole="button"
          style={styles.primaryButton}
          testID="manual-deposit-submit-another"
        >
          <Text style={styles.primaryButtonText}>{t('wallet', 'deposit_submit_another', 'Submit another')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} testID="manual-deposit-screen">
      <Text style={styles.title}>{t('wallet', 'deposit_title', 'Manual deposit')}</Text>
      <Text style={styles.subtitle}>
        {t('wallet', 'deposit_subtitle', 'Submit your transaction ID for admin approval.')}
      </Text>

      {settingsQuery.isLoading ? (
        <ActivityIndicator testID="manual-deposit-loading" />
      ) : methods.length === 0 ? (
        <Text style={styles.empty} testID="manual-deposit-no-methods">
          {t('wallet', 'deposit_no_methods', "Manual deposit isn't available right now.")}
        </Text>
      ) : (
        <>
          <Text style={styles.sectionLabel}>{t('wallet', 'deposit_method_label', 'Payment method')}</Text>
          <View style={styles.methodRow} testID="manual-deposit-methods">
            {methods.map((m) => {
              const isSelected = m.name === effectiveMethodName;
              return (
                <Pressable
                  key={m.id ?? m.name}
                  onPress={() => setSelectedMethodName(m.name)}
                  accessibilityRole="button"
                  style={[styles.methodChip, isSelected && styles.methodChipSelected]}
                  testID={`manual-deposit-method-${m.name}`}
                >
                  <Text style={[styles.methodChipText, isSelected && styles.methodChipTextSelected]}>{m.name}</Text>
                </Pressable>
              );
            })}
          </View>

          {selectedMethod && renderMethodDetails(selectedMethod)}

          <Text style={styles.sectionLabel}>{t('wallet', 'deposit_amount_label', 'Amount')}</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={t('wallet', 'deposit_amount_placeholder', 'Amount you sent')}
            style={styles.input}
            testID="manual-deposit-amount-input"
          />

          <Text style={styles.sectionLabel}>{t('wallet', 'deposit_txid_label', 'Transaction ID (TxID)')}</Text>
          <TextInput
            value={transactionId}
            onChangeText={setTransactionId}
            placeholder={t('wallet', 'deposit_txid_placeholder', 'e.g. 9J28XK19Z')}
            style={styles.input}
            testID="manual-deposit-txid-input"
          />

          {submitError && (
            <Text style={styles.error} testID="manual-deposit-error">
              {submitError}
            </Text>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
            testID="manual-deposit-submit"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {t('wallet', 'deposit_submit', 'Submit receipt for approval')}
              </Text>
            )}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 4, marginBottom: 20 },
  body: { fontSize: 13, color: '#344054', marginTop: 8, marginBottom: 20 },
  empty: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 24 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#344054', marginBottom: 6, marginTop: 12 },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  methodChipSelected: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  methodChipText: { fontSize: 12, color: '#344054' },
  methodChipTextSelected: { color: '#fff', fontWeight: '700' },
  methodDetails: {
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    gap: 6,
  },
  qrImage: { width: 160, height: 160, alignSelf: 'center', marginBottom: 8, borderRadius: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  detailLabel: { fontSize: 12, color: '#64748B' },
  detailValue: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  instructions: { fontSize: 11, color: '#64748B', marginTop: 4 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  error: { fontSize: 12, color: '#B42318', marginTop: 12 },
  primaryButton: {
    minHeight: 44,
    marginTop: 20,
    marginBottom: 32,
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
