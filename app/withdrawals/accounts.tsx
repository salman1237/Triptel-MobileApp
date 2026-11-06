import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPayoutAccounts,
  addPayoutAccount,
  setDefaultPayoutAccount,
  deletePayoutAccount,
  MAX_PAYOUT_ACCOUNTS,
} from '../../src/api/withdrawals';
import type { PayoutAccount } from '../../src/api/withdrawals';
import { ApiError } from '../../src/lib/apiClient';
import { useAppSettings } from '../../src/state/AppSettingsContext';
import { useAuth } from '../../src/state/AuthContext';

const EMPTY_FORM = {
  account_type: 'MOBILE' as 'MOBILE' | 'BANK',
  bank_name: '',
  holder_name: '',
  account_number: '',
  branch_name: '',
  routing_number: '',
};

// FR-701 - add/remove/set-default up to 5 payout accounts. Ported from the
// "Payout accounts" panel of the web's src/app/wallet/withdraw/page.tsx -
// the withdrawal request form and history on that same page are separate,
// later FRs (FR-702/703), not built here.
export default function PayoutAccountsScreen() {
  const { t } = useAppSettings();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const accountsQuery = useQuery({
    queryKey: ['withdrawals', 'accounts'],
    queryFn: () => getPayoutAccounts(token as string),
    enabled: Boolean(token),
  });
  const accounts = accountsQuery.data ?? [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  function resetForm() {
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  async function handleAddAccount() {
    if (!token) return;
    setSaving(true);
    setFormError(null);
    try {
      await addPayoutAccount(token, {
        account_type: form.account_type,
        bank_name: form.bank_name.trim(),
        holder_name: form.holder_name.trim(),
        account_number: form.account_number.trim(),
        branch_name: form.branch_name.trim() || null,
        routing_number: form.routing_number.trim() || null,
      });
      resetForm();
      setShowForm(false);
      await queryClient.invalidateQueries({ queryKey: ['withdrawals', 'accounts'] });
    } catch (err) {
      setFormError(
        err instanceof ApiError && typeof err.detail === 'string'
          ? err.detail
          : t('withdrawals', 'account_save_error', "Couldn't save that account. Please try again.")
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(id: string) {
    if (!token) return;
    setRowError(null);
    try {
      await setDefaultPayoutAccount(token, id);
      await queryClient.invalidateQueries({ queryKey: ['withdrawals', 'accounts'] });
    } catch (err) {
      setRowError(
        err instanceof ApiError && typeof err.detail === 'string'
          ? err.detail
          : t('withdrawals', 'account_default_error', "Couldn't update the default account.")
      );
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    setRowError(null);
    try {
      await deletePayoutAccount(token, id);
      await queryClient.invalidateQueries({ queryKey: ['withdrawals', 'accounts'] });
    } catch (err) {
      setRowError(
        err instanceof ApiError && typeof err.detail === 'string'
          ? err.detail
          : t('withdrawals', 'account_delete_error', "Couldn't remove that account.")
      );
    }
  }

  function renderAccount(account: PayoutAccount) {
    return (
      <View key={account.id} style={styles.accountRow} testID={`payout-account-${account.id}`}>
        <View style={styles.accountMain}>
          <View style={styles.accountNameRow}>
            <Text style={styles.accountName}>{account.bank_name}</Text>
            {account.is_default && (
              <View style={styles.defaultBadge} testID={`payout-account-default-${account.id}`}>
                <Text style={styles.defaultBadgeText}>{t('withdrawals', 'default_badge', 'Default')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.accountNumber} testID={`payout-account-number-${account.id}`}>
            {account.account_number}
          </Text>
          <Text style={styles.accountHolder}>
            {account.holder_name}
            {account.branch_name ? ` · ${account.branch_name}` : ''}
          </Text>
        </View>
        <View style={styles.accountActions}>
          {!account.is_default && (
            <Pressable
              onPress={() => handleSetDefault(account.id)}
              accessibilityRole="button"
              testID={`payout-account-set-default-${account.id}`}
            >
              <Text style={styles.actionLink}>{t('withdrawals', 'make_default', 'Make default')}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => handleDelete(account.id)}
            accessibilityRole="button"
            accessibilityLabel={t('withdrawals', 'remove_account', 'Remove')}
            testID={`payout-account-remove-${account.id}`}
          >
            <Text style={styles.actionLinkDanger}>{t('withdrawals', 'remove_account', 'Remove')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} testID="payout-accounts-screen">
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('withdrawals', 'accounts_title', 'Payout accounts')}</Text>
        {!showForm && accounts.length < MAX_PAYOUT_ACCOUNTS && (
          <Pressable
            onPress={() => setShowForm(true)}
            accessibilityRole="button"
            testID="payout-accounts-add-button"
          >
            <Text style={styles.addLink}>{t('withdrawals', 'add_account', '+ Add account')}</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.subtitle}>
        {t('withdrawals', 'accounts_subtitle', 'Where we send the money. The name must match your verified ID.')}
      </Text>

      {accountsQuery.isLoading ? (
        <ActivityIndicator testID="payout-accounts-loading" />
      ) : accountsQuery.isError ? (
        <Text style={styles.error} testID="payout-accounts-error">
          {t('withdrawals', 'accounts_load_error', "Couldn't load your payout accounts.")}
        </Text>
      ) : (
        <>
          {rowError && (
            <Text style={styles.error} testID="payout-accounts-row-error">
              {rowError}
            </Text>
          )}

          {accounts.length === 0 && !showForm ? (
            <Text style={styles.empty} testID="payout-accounts-empty">
              {t('withdrawals', 'accounts_empty', 'No payout account saved yet.')}
            </Text>
          ) : (
            <View testID="payout-accounts-list">{accounts.map(renderAccount)}</View>
          )}

          {showForm && (
            <View style={styles.form} testID="payout-account-form">
              <View style={styles.typeRow}>
                {(['MOBILE', 'BANK'] as const).map((kind) => {
                  const isSelected = form.account_type === kind;
                  return (
                    <Pressable
                      key={kind}
                      onPress={() => setForm((f) => ({ ...f, account_type: kind }))}
                      accessibilityRole="button"
                      style={[styles.typeChip, isSelected && styles.typeChipSelected]}
                      testID={`payout-account-type-${kind}`}
                    >
                      <Text style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}>
                        {kind === 'MOBILE'
                          ? t('withdrawals', 'type_mobile', 'Mobile wallet')
                          : t('withdrawals', 'type_bank', 'Bank account')}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                value={form.bank_name}
                onChangeText={(v) => setForm((f) => ({ ...f, bank_name: v }))}
                placeholder={form.account_type === 'MOBILE' ? 'bKash' : 'City Bank'}
                style={styles.input}
                testID="payout-account-bank-name-input"
              />
              <TextInput
                value={form.holder_name}
                onChangeText={(v) => setForm((f) => ({ ...f, holder_name: v }))}
                placeholder={t('withdrawals', 'holder_name_placeholder', 'As printed on your ID')}
                style={styles.input}
                testID="payout-account-holder-name-input"
              />
              <TextInput
                value={form.account_number}
                onChangeText={(v) => setForm((f) => ({ ...f, account_number: v }))}
                placeholder={form.account_type === 'MOBILE' ? '01712345678' : '1234567890123'}
                style={styles.input}
                testID="payout-account-number-input"
              />
              {form.account_type === 'BANK' && (
                <>
                  <TextInput
                    value={form.branch_name}
                    onChangeText={(v) => setForm((f) => ({ ...f, branch_name: v }))}
                    placeholder={t('withdrawals', 'branch_placeholder', 'Branch')}
                    style={styles.input}
                    testID="payout-account-branch-input"
                  />
                  <TextInput
                    value={form.routing_number}
                    onChangeText={(v) => setForm((f) => ({ ...f, routing_number: v }))}
                    placeholder={t('withdrawals', 'routing_placeholder', 'Routing number')}
                    style={styles.input}
                    testID="payout-account-routing-input"
                  />
                </>
              )}

              {formError && (
                <Text style={styles.error} testID="payout-account-form-error">
                  {formError}
                </Text>
              )}

              <View style={styles.formActions}>
                <Pressable
                  onPress={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  accessibilityRole="button"
                  style={styles.secondaryButton}
                  testID="payout-account-form-cancel"
                >
                  <Text style={styles.secondaryButtonText}>{t('withdrawals', 'cancel', 'Cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={handleAddAccount}
                  disabled={saving || form.bank_name.trim().length < 2 || form.holder_name.trim().length < 2 || form.account_number.trim().length < 4}
                  accessibilityRole="button"
                  style={[
                    styles.primaryButton,
                    (saving || form.bank_name.trim().length < 2 || form.holder_name.trim().length < 2 || form.account_number.trim().length < 4) &&
                      styles.primaryButtonDisabled,
                  ]}
                  testID="payout-account-form-save"
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>{t('withdrawals', 'save_account', 'Save account')}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  addLink: { fontSize: 13, fontWeight: '700', color: '#1D4ED8' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 4, marginBottom: 20 },
  empty: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 24 },
  error: { fontSize: 12, color: '#B42318', marginBottom: 12 },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    marginBottom: 10,
  },
  accountMain: { flex: 1, minWidth: 0 },
  accountNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accountName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  defaultBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: '#059669' },
  accountNumber: { fontSize: 12, color: '#64748B', marginTop: 2 },
  accountHolder: { fontSize: 12, color: '#64748B', marginTop: 2 },
  accountActions: { alignItems: 'flex-end', gap: 6 },
  actionLink: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  actionLinkDanger: { fontSize: 11, fontWeight: '600', color: '#DC2626' },
  form: { marginTop: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E2E8F0', gap: 10 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  typeChipSelected: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  typeChipText: { fontSize: 12, fontWeight: '700', color: '#344054' },
  typeChipTextSelected: { color: '#fff' },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 24 },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    backgroundColor: '#1D4ED8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    backgroundColor: '#F2F4F7',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#344054', fontSize: 13, fontWeight: '700' },
});
