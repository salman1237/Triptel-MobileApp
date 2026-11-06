import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyWithdrawals, cancelWithdrawal } from '../../src/api/withdrawals';
import type { Withdrawal, WithdrawalStatus } from '../../src/api/withdrawals';
import { formatDate } from '../../src/lib/datetime';
import { ApiError } from '../../src/lib/apiClient';
import { useAppSettings } from '../../src/state/AppSettingsContext';
import { useAuth } from '../../src/state/AuthContext';

// Ported from the web's CATEGORY_LABELS/STATUS_STYLE
// (src/app/wallet/withdraw/page.tsx).
const CATEGORY_LABELS: Record<string, string> = {
  withdrawal: 'Wallet withdrawal',
  commission: 'Commission payout',
  refund: 'Refund',
  renew: 'Renewal funds',
  business: 'Business expense',
  other: 'Other',
};

const STATUS_STYLE: Record<WithdrawalStatus, { badge: object; label: string }> = {
  PENDING: { badge: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }, label: 'Awaiting review' },
  PAID: { badge: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }, label: 'Paid' },
  REJECTED: { badge: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }, label: 'Not approved' },
  CANCELLED: { badge: { backgroundColor: '#F2F4F7', borderColor: '#E2E8F0' }, label: 'Cancelled' },
};

function eur(value: number): string {
  return `€${value.toFixed(2)}`;
}

// FR-703 - withdrawal status history, newest first, with a Cancel action
// for still-PENDING requests. Ported from the "Withdrawal history" panel
// of the web's src/app/wallet/withdraw/page.tsx - the receipt link for PAID
// rows is FR-704 (separate FR), omitted here.
export default function WithdrawalHistoryScreen() {
  const { t } = useAppSettings();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: ['withdrawals', 'history'],
    queryFn: () => getMyWithdrawals(token as string),
    enabled: Boolean(token),
  });
  const history = historyQuery.data ?? [];

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  async function handleCancel(id: string) {
    if (!token) return;
    setCancellingId(id);
    setRowError(null);
    try {
      await cancelWithdrawal(token, id);
      await queryClient.invalidateQueries({ queryKey: ['withdrawals', 'history'] });
    } catch (err) {
      setRowError(
        err instanceof ApiError && typeof err.detail === 'string'
          ? err.detail
          : t('withdrawals', 'cancel_error', "Couldn't cancel that request.")
      );
    } finally {
      setCancellingId(null);
    }
  }

  function renderItem({ item }: { item: Withdrawal }) {
    const style = STATUS_STYLE[item.status];
    return (
      <View style={styles.row} testID={`withdrawal-history-item-${item.id}`}>
        <View style={styles.rowMain}>
          <View style={styles.referenceRow}>
            <Text style={styles.reference} testID={`withdrawal-history-reference-${item.id}`}>
              {item.reference_no}
            </Text>
            <View style={[styles.statusBadge, style.badge]} testID={`withdrawal-history-status-${item.id}`}>
              <Text style={styles.statusBadgeText}>{style.label}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {formatDate(item.created_at)} · {item.account_line}
            {item.note_category ? ` · ${CATEGORY_LABELS[item.note_category] ?? item.note_category}` : ''}
          </Text>
          {item.status === 'PAID' && item.payout_amount !== null && (
            <Text style={styles.paidNote} testID={`withdrawal-history-payout-${item.id}`}>
              {t('withdrawals', 'sent', 'Sent')} {item.payout_amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
              {item.payout_currency}
              {item.conversion_rate !== null ? ` at 1 EUR = ${item.conversion_rate.toFixed(2)} ${item.payout_currency}` : ''}
            </Text>
          )}
          {item.status === 'REJECTED' && item.rejection_reason && (
            <Text style={styles.rejectedNote} testID={`withdrawal-history-rejection-${item.id}`}>
              {item.rejection_reason}
            </Text>
          )}
        </View>
        <View style={styles.rowEnd}>
          <Text style={styles.amount}>{eur(item.amount)}</Text>
          {item.fee_amount > 0 && <Text style={styles.netAmount}>net {eur(item.net_amount)}</Text>}
          {item.status === 'PENDING' && (
            <Pressable
              onPress={() => handleCancel(item.id)}
              disabled={cancellingId === item.id}
              accessibilityRole="button"
              testID={`withdrawal-history-cancel-${item.id}`}
            >
              <Text style={styles.cancelLink}>
                {cancellingId === item.id ? t('withdrawals', 'cancelling', 'Cancelling...') : t('withdrawals', 'cancel', 'Cancel')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="withdrawal-history-screen">
      <Text style={styles.title}>{t('withdrawals', 'history_title', 'Withdrawal history')}</Text>

      {rowError && (
        <Text style={styles.error} testID="withdrawal-history-row-error">
          {rowError}
        </Text>
      )}

      {historyQuery.isLoading ? (
        <ActivityIndicator testID="withdrawal-history-loading" />
      ) : historyQuery.isError ? (
        <Text style={styles.error} testID="withdrawal-history-error">
          {t('withdrawals', 'history_load_error', "Couldn't load your withdrawal history.")}
        </Text>
      ) : history.length === 0 ? (
        <Text style={styles.empty} testID="withdrawal-history-empty">
          {t('withdrawals', 'history_empty', 'No withdrawals yet.')}
        </Text>
      ) : (
        <FlatList data={history} keyExtractor={(item) => item.id} renderItem={renderItem} testID="withdrawal-history-list" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
  empty: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 24 },
  error: { fontSize: 12, color: '#B42318', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowMain: { flex: 1, minWidth: 0 },
  referenceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  reference: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  statusBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: '#344054' },
  meta: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  paidNote: { fontSize: 11, color: '#059669', fontWeight: '600', marginTop: 4 },
  rejectedNote: { fontSize: 11, color: '#DC2626', marginTop: 4 },
  rowEnd: { alignItems: 'flex-end' },
  amount: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  netAmount: { fontSize: 11, color: '#64748B', marginTop: 2 },
  cancelLink: { fontSize: 11, fontWeight: '600', color: '#DC2626', marginTop: 6 },
});
