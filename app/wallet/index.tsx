import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { getMyWallets, getMyLedger } from '../../src/api/wallets';
import type { Wallet, LedgerEntry } from '../../src/api/wallets';
import { formatDate } from '../../src/lib/datetime';
import { useAppSettings } from '../../src/state/AppSettingsContext';
import { useAuth } from '../../src/state/AuthContext';

// FR-601 - balances + ledger only. Top-up (gateway FR-602, manual deposit
// FR-603, result banners FR-604) and withdrawals (FR-701/702) are later,
// separate FRs - this screen doesn't grow those sections prematurely.
// Ported from the web's src/app/wallet/page.tsx's WALLET_COPY - same
// per-type title/note, since REWARD credit buys eSIMs but can never be
// withdrawn, and that distinction matters to the customer reading this.
const WALLET_COPY: Record<Wallet['wallet_type'], { title: string; note: string }> = {
  DEFAULT: { title: 'Main balance', note: 'Top up, spend on eSIMs, or withdraw' },
  REWARD: { title: 'Reward credit', note: "Spends on eSIMs first · not withdrawable" },
  COMMISSION: { title: 'Commission earned', note: 'Move it to your main balance to use or withdraw' },
};

export default function WalletOverviewScreen() {
  const { t, formatPrice } = useAppSettings();
  const { token } = useAuth();
  const router = useRouter();

  const walletsQuery = useQuery({
    queryKey: ['wallets', 'my-wallets'],
    queryFn: () => getMyWallets(token as string),
    enabled: Boolean(token),
  });
  const ledgerQuery = useQuery({
    queryKey: ['wallets', 'ledger'],
    queryFn: () => getMyLedger(token as string),
    enabled: Boolean(token),
  });

  const wallets = walletsQuery.data ?? [];
  const ledger = ledgerQuery.data ?? [];
  const isLoading = walletsQuery.isLoading || ledgerQuery.isLoading;
  const isError = walletsQuery.isError || ledgerQuery.isError;

  function renderWalletCard(wallet: Wallet) {
    const copy = WALLET_COPY[wallet.wallet_type] ?? {
      title: `${wallet.wallet_type} wallet`,
      note: `Currency: ${wallet.currency}`,
    };
    return (
      <View key={wallet.id} style={styles.card} testID={`wallet-card-${wallet.wallet_type}`}>
        <Text style={styles.cardTitle}>{t('wallet', `type_${wallet.wallet_type.toLowerCase()}_title`, copy.title)}</Text>
        <Text style={styles.cardBalance} testID={`wallet-card-balance-${wallet.wallet_type}`}>
          {formatPrice(wallet.balance)}
        </Text>
        <Text style={styles.cardNote}>{t('wallet', `type_${wallet.wallet_type.toLowerCase()}_note`, copy.note)}</Text>
      </View>
    );
  }

  function renderLedgerEntry({ item }: { item: LedgerEntry }) {
    const isCredit = item.tx_type === 'CREDIT';
    return (
      <View style={styles.ledgerRow} testID={`ledger-entry-${item.id}`}>
        <View style={styles.ledgerMain}>
          <Text style={styles.ledgerDescription} numberOfLines={1}>
            {item.description || item.reference_type}
          </Text>
          <Text style={styles.ledgerDate}>{formatDate(item.created_at)}</Text>
        </View>
        <View style={styles.ledgerEnd}>
          <Text
            style={[styles.ledgerAmount, isCredit ? styles.ledgerAmountCredit : styles.ledgerAmountDebit]}
            testID={`ledger-entry-amount-${item.id}`}
          >
            {isCredit ? '+' : '-'}
            {formatPrice(item.amount)}
          </Text>
          <Text style={styles.ledgerBalanceAfter}>{formatPrice(item.balance_after)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="wallet-overview-screen">
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('wallet', 'overview_title', 'Wallet')}</Text>
        <Pressable
          onPress={() => router.push('/wallet/manual-deposit')}
          accessibilityRole="button"
          accessibilityLabel={t('wallet', 'manual_deposit_link', 'Manual deposit')}
          style={styles.depositButton}
          testID="wallet-manual-deposit-link"
        >
          <Text style={styles.depositButtonText}>{t('wallet', 'manual_deposit_link', 'Manual deposit')}</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push('/withdrawals/accounts')}
        accessibilityRole="button"
        accessibilityLabel={t('wallet', 'payout_accounts_link', 'Payout accounts')}
        style={styles.withdrawLink}
        testID="wallet-payout-accounts-link"
      >
        <Text style={styles.withdrawLinkText}>{t('wallet', 'payout_accounts_link', 'Payout accounts →')}</Text>
      </Pressable>

      {isLoading ? (
        <ActivityIndicator testID="wallet-overview-loading" />
      ) : isError ? (
        <Text style={styles.error} testID="wallet-overview-error">
          {t('wallet', 'overview_load_error', "Couldn't load your wallet. Pull to try again.")}
        </Text>
      ) : (
        <>
          <View style={styles.cardsRow} testID="wallet-cards">
            {wallets.map(renderWalletCard)}
          </View>

          <Text style={styles.sectionTitle}>{t('wallet', 'ledger_title', 'Transaction history')}</Text>
          {ledger.length === 0 ? (
            <Text style={styles.empty} testID="wallet-ledger-empty">
              {t('wallet', 'ledger_empty', 'No transactions recorded yet.')}
            </Text>
          ) : (
            <FlatList
              data={ledger}
              keyExtractor={(item) => item.id}
              renderItem={renderLedgerEntry}
              testID="wallet-ledger-list"
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  depositButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D0D5DD',
  },
  depositButtonText: { fontSize: 12, fontWeight: '700', color: '#1D4ED8' },
  withdrawLink: { marginBottom: 20 },
  withdrawLinkText: { fontSize: 12, fontWeight: '700', color: '#1D4ED8' },
  cardsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  card: {
    flexGrow: 1,
    flexBasis: '45%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
  },
  cardTitle: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  cardBalance: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginTop: 6 },
  cardNote: { fontSize: 11, color: '#64748B', marginTop: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  empty: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 24 },
  error: { fontSize: 13, color: '#B42318', textAlign: 'center', marginTop: 40 },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  ledgerMain: { flex: 1, minWidth: 0 },
  ledgerDescription: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  ledgerDate: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  ledgerEnd: { alignItems: 'flex-end' },
  ledgerAmount: { fontSize: 13, fontWeight: '700' },
  ledgerAmountCredit: { color: '#059669' },
  ledgerAmountDebit: { color: '#DC2626' },
  ledgerBalanceAfter: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
});
