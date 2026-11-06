import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getWithdrawalConfig, getPayoutAccounts, createWithdrawal } from '../../src/api/withdrawals';
import type { WithdrawalRequestResult } from '../../src/api/withdrawals';
import { ApiError } from '../../src/lib/apiClient';
import { useAppSettings } from '../../src/state/AppSettingsContext';
import { useAuth } from '../../src/state/AuthContext';

// Ported from the web's CATEGORY_LABELS (src/app/wallet/withdraw/page.tsx).
const CATEGORY_LABELS: Record<string, string> = {
  withdrawal: 'Wallet withdrawal',
  commission: 'Commission payout',
  refund: 'Refund',
  renew: 'Renewal funds',
  business: 'Business expense',
  other: 'Other',
};

// Amounts here are always the base currency (EUR) - this is money leaving
// a EUR-denominated wallet, not a display conversion. See docs/Rules.md ->
// "Payment & checkout" and the web's own eur() helper on the same page.
function eur(value: number): string {
  return `€${value.toFixed(2)}`;
}

// FR-702 - submit a withdrawal with a live fee/min/max preview; blocked
// behind KYC with a clear path to verify. Ported from the "Request a
// withdrawal" panel of the web's src/app/wallet/withdraw/page.tsx - the
// payout accounts list (FR-701) and withdrawal history (FR-703) on that
// same web page are separate FRs. "Clear path to verify" is the backend's
// own blocker text (GET /withdrawals/config) rather than a link to a KYC
// submission screen - FR-1002 isn't built yet, so there's nowhere real to
// send the user; see DECISIONS.md.
export default function WithdrawalRequestScreen() {
  const { t } = useAppSettings();
  const { token } = useAuth();

  const configQuery = useQuery({
    queryKey: ['withdrawals', 'config'],
    queryFn: () => getWithdrawalConfig(token as string),
    enabled: Boolean(token),
  });
  const accountsQuery = useQuery({
    queryKey: ['withdrawals', 'accounts'],
    queryFn: () => getPayoutAccounts(token as string),
    enabled: Boolean(token),
  });
  const config = configQuery.data;
  const accounts = accountsQuery.data ?? [];

  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [category, setCategory] = useState('withdrawal');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<WithdrawalRequestResult | null>(null);

  const effectiveAccountId = accountId ?? accounts.find((a) => a.is_default)?.id ?? accounts[0]?.id ?? null;

  const amountNumber = parseFloat(amount);
  const amountValid =
    Boolean(config) &&
    Number.isFinite(amountNumber) &&
    amountNumber >= (config?.min_amount ?? 0) &&
    amountNumber <= (config?.max_amount ?? 0) &&
    amountNumber <= (config?.balance ?? 0);

  const fee = useMemo(() => {
    if (!config || !Number.isFinite(amountNumber)) return 0;
    const raw = config.fee_type === 'percent' ? (amountNumber * config.fee_value) / 100 : config.fee_value;
    return Math.min(raw, amountNumber);
  }, [config, amountNumber]);
  const net = Number.isFinite(amountNumber) ? Math.max(amountNumber - fee, 0) : 0;

  const canSubmit = amountValid && Boolean(effectiveAccountId) && Boolean(config?.can_withdraw) && !submitting;

  async function handleSubmit() {
    if (!token || !effectiveAccountId || !amountValid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createWithdrawal(token, {
        amount: amountNumber,
        bankAccountId: effectiveAccountId,
        noteCategory: category,
        note: note.trim() || undefined,
      });
      setResult(created);
      setAmount('');
      setNote('');
    } catch (err) {
      setSubmitError(
        err instanceof ApiError && typeof err.detail === 'string'
          ? err.detail
          : t('withdrawals', 'request_network_error', "Couldn't submit the request. Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (configQuery.isLoading || accountsQuery.isLoading) {
    return <ActivityIndicator testID="withdrawal-request-loading" style={styles.loading} />;
  }

  if (configQuery.isError || !config) {
    return (
      <Text style={styles.error} testID="withdrawal-request-error">
        {t('withdrawals', 'config_load_error', "Couldn't load withdrawal details.")}
      </Text>
    );
  }

  if (result) {
    return (
      <View style={styles.container} testID="withdrawal-request-success">
        <Text style={styles.title}>{t('withdrawals', 'request_submitted_title', 'Request submitted')}</Text>
        <Text style={styles.body} testID="withdrawal-request-reference">
          {t('withdrawals', 'request_submitted_body', 'Reference')} {result.reference_no}
        </Text>
        <Pressable
          onPress={() => setResult(null)}
          accessibilityRole="button"
          style={styles.primaryButton}
          testID="withdrawal-request-another"
        >
          <Text style={styles.primaryButtonText}>{t('withdrawals', 'request_another', 'Submit another')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} testID="withdrawal-request-screen">
      <Text style={styles.title}>{t('withdrawals', 'request_title', 'Request a withdrawal')}</Text>
      <Text style={styles.subtitle}>
        {t('withdrawals', 'request_subtitle', 'Between')} {eur(config.min_amount)} {t('withdrawals', 'and', 'and')}{' '}
        {eur(config.max_amount)}
      </Text>

      {!config.can_withdraw && (
        <View style={styles.blockers} testID="withdrawal-blockers">
          <Text style={styles.blockersTitle}>{t('withdrawals', 'blockers_title', 'Before you can withdraw')}</Text>
          {config.blockers.map((blocker) => (
            <Text key={blocker} style={styles.blockerItem} testID={`withdrawal-blocker-${blocker}`}>
              {'•'} {blocker}
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.sectionLabel}>
        {t('withdrawals', 'amount_label', 'Amount')} ({config.base_currency})
      </Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder={config.min_amount.toFixed(2)}
        style={styles.input}
        testID="withdrawal-amount-input"
        editable={config.can_withdraw}
      />
      {amount.trim() !== '' && !amountValid && (
        <Text style={styles.fieldError} testID="withdrawal-amount-error">
          {amountNumber > config.balance
            ? t('withdrawals', 'amount_over_balance', 'That is more than your available balance.')
            : t('withdrawals', 'amount_out_of_range', `Enter an amount between ${eur(config.min_amount)} and ${eur(config.max_amount)}.`)}
        </Text>
      )}

      {amountValid && (
        <View style={styles.preview} testID="withdrawal-preview">
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>{t('withdrawals', 'preview_withdrawn', 'Withdrawn from wallet')}</Text>
            <Text style={styles.previewValue}>{eur(amountNumber)}</Text>
          </View>
          {fee > 0 && (
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>{t('withdrawals', 'preview_fee', 'Processing fee')}</Text>
              <Text style={styles.previewValueNegative} testID="withdrawal-preview-fee">
                - {eur(fee)}
              </Text>
            </View>
          )}
          <View style={[styles.previewRow, styles.previewNetRow]}>
            <Text style={styles.previewLabelBold}>{t('withdrawals', 'preview_net', 'You receive')}</Text>
            <Text style={styles.previewValueBold} testID="withdrawal-preview-net">
              {eur(net)}
            </Text>
          </View>
        </View>
      )}

      <Text style={styles.sectionLabel}>{t('withdrawals', 'send_to_label', 'Send to')}</Text>
      {accounts.length === 0 ? (
        <Text style={styles.body} testID="withdrawal-no-accounts">
          {t('withdrawals', 'no_accounts', 'Add a payout account first.')}
        </Text>
      ) : (
        <View style={styles.accountRow} testID="withdrawal-account-list">
          {accounts.map((a) => {
            const isSelected = a.id === effectiveAccountId;
            return (
              <Pressable
                key={a.id}
                onPress={() => setAccountId(a.id)}
                accessibilityRole="button"
                style={[styles.accountChip, isSelected && styles.accountChipSelected]}
                testID={`withdrawal-account-${a.id}`}
              >
                <Text style={[styles.accountChipText, isSelected && styles.accountChipTextSelected]}>
                  {a.bank_name} · {a.account_number}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={styles.sectionLabel}>{t('withdrawals', 'reason_label', 'Reason')}</Text>
      <View style={styles.accountRow} testID="withdrawal-category-list">
        {config.note_categories.map((key) => {
          const isSelected = category === key;
          return (
            <Pressable
              key={key}
              onPress={() => setCategory(key)}
              accessibilityRole="button"
              style={[styles.accountChip, isSelected && styles.accountChipSelected]}
              testID={`withdrawal-category-${key}`}
            >
              <Text style={[styles.accountChipText, isSelected && styles.accountChipTextSelected]}>
                {CATEGORY_LABELS[key] ?? key}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>{t('withdrawals', 'note_label', 'Note (optional)')}</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={t('withdrawals', 'note_placeholder', 'Anything our team should know')}
        style={styles.input}
        testID="withdrawal-note-input"
      />

      {submitError && (
        <Text style={styles.error} testID="withdrawal-submit-error">
          {submitError}
        </Text>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
        style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
        testID="withdrawal-submit"
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>{t('withdrawals', 'submit', 'Request withdrawal')}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
  loading: { marginTop: 40 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 4, marginBottom: 16 },
  body: { fontSize: 13, color: '#344054', marginTop: 8, marginBottom: 16 },
  error: { fontSize: 12, color: '#B42318', marginTop: 12, marginBottom: 12 },
  fieldError: { fontSize: 11, color: '#B42318', marginTop: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#344054', marginBottom: 6, marginTop: 14 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  blockers: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  blockersTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 6 },
  blockerItem: { fontSize: 12, color: '#92400E', marginTop: 2 },
  preview: {
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    gap: 4,
  },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
  previewNetRow: { marginTop: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  previewLabel: { fontSize: 12, color: '#64748B' },
  previewLabelBold: { fontSize: 12, fontWeight: '700', color: '#344054' },
  previewValue: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  previewValueNegative: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  previewValueBold: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  accountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  accountChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  accountChipSelected: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  accountChipText: { fontSize: 12, color: '#344054' },
  accountChipTextSelected: { color: '#fff', fontWeight: '700' },
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
