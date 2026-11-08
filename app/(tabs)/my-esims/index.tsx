import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { getMyEsims } from '../../../src/api/esims';
import type { MyEsim } from '../../../src/api/esims';
import { esimInstallLinks } from '../../../src/lib/esimInstall';
import { formatDate } from '../../../src/lib/datetime';
import { useAppSettings } from '../../../src/state/AppSettingsContext';
import { useAuth } from '../../../src/state/AuthContext';
import EsimQr from '../../../src/components/EsimQr';

function EsimCard({ item, t }: { item: MyEsim; t: ReturnType<typeof useAppSettings>['t'] }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const install = esimInstallLinks(item.lpa_string);

  async function handleCopyLpa() {
    if (!item.lpa_string) return;
    await Clipboard.setStringAsync(item.lpa_string);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `${item.product_title} - ${t('esims', 'order_label', 'Order')} ${item.order_no}\n${item.lpa_string ?? ''}`,
      });
    } catch {
      // User dismissed the share sheet - nothing to do.
    }
  }

  return (
    <View style={styles.card} testID={`esim-card-${item.id}`}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderMain}>
          <Text style={styles.productTitle} testID={`esim-title-${item.id}`}>
            {item.product_title}
          </Text>
          <Text style={styles.productMeta}>
            {item.is_unlimited ? t('esims', 'unlimited', 'Unlimited') : `${item.data_amount_gb} GB`} &bull;{' '}
            {item.validity_days} {t('esims', 'days', 'Days')}
          </Text>
          <Text style={styles.validityNote}>
            {item.expires_at
              ? `${t('esims', 'expires', 'Expires')} ${formatDate(item.expires_at)}`
              : t('esims', 'validity_starts_on_install', 'Validity starts when you install it')}
          </Text>
        </View>
        <Text
          style={[styles.statusBadge, item.is_mock_fallback && styles.statusBadgePending]}
          testID={`esim-status-${item.id}`}
        >
          {item.is_mock_fallback ? t('esims', 'activation_pending', 'Activation pending') : item.status}
        </Text>
      </View>

      {!revealed ? (
        <Pressable
          onPress={() => setRevealed(true)}
          accessibilityRole="button"
          style={styles.revealButton}
          testID={`esim-reveal-${item.id}`}
        >
          <Text style={styles.revealButtonText}>{t('esims', 'reveal_qr', 'Tap to reveal your QR code')}</Text>
        </Pressable>
      ) : (
        <View testID={`esim-revealed-${item.id}`}>
          <View style={styles.qrWrap}>
            {item.qr_code_data || item.lpa_string ? (
              <EsimQr value={item.qr_code_data || item.lpa_string || ''} size={160} testID={`esim-qr-${item.id}`} />
            ) : (
              <Text style={styles.noQrText} testID={`esim-no-qr-${item.id}`}>
                {t('esims', 'no_qr_yet', "This eSIM's QR code isn't ready yet.")}
              </Text>
            )}
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailBox}>
              <Text style={styles.detailLabel}>{t('esims', 'iccid', 'ICCID')}</Text>
              <Text style={styles.detailValue} testID={`esim-iccid-${item.id}`}>
                {item.iccid || 'N/A'}
              </Text>
            </View>
            <View style={styles.detailBox}>
              <Text style={styles.detailLabel}>{t('esims', 'order_label', 'Order')}</Text>
              <Text style={styles.detailValue} testID={`esim-order-no-${item.id}`}>
                {item.order_no}
              </Text>
            </View>
          </View>

          {(install.ios || install.android) && (
            <View style={styles.installRow} testID={`esim-install-links-${item.id}`}>
              {install.ios && (
                <Pressable
                  onPress={() => Linking.openURL(install.ios as string)}
                  accessibilityRole="link"
                  style={styles.installButton}
                  testID={`esim-install-ios-${item.id}`}
                >
                  <Text style={styles.installButtonText}>{t('esims', 'install_ios', 'Install on iPhone')}</Text>
                </Pressable>
              )}
              {install.android && (
                <Pressable
                  onPress={() => Linking.openURL(install.android as string)}
                  accessibilityRole="link"
                  style={[styles.installButton, styles.installButtonAndroid]}
                  testID={`esim-install-android-${item.id}`}
                >
                  <Text style={styles.installButtonText}>{t('esims', 'install_android', 'Install on Android')}</Text>
                </Pressable>
              )}
            </View>
          )}

          {item.lpa_string && (
            <Pressable
              onPress={handleCopyLpa}
              accessibilityRole="button"
              style={styles.secondaryButton}
              testID={`esim-copy-lpa-${item.id}`}
            >
              <Text style={styles.secondaryButtonText}>
                {copied
                  ? t('esims', 'copied', 'Copied to clipboard!')
                  : t('esims', 'copy_lpa', 'Copy LPA code')}
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleShare}
            accessibilityRole="button"
            style={styles.secondaryButton}
            testID={`esim-share-${item.id}`}
          >
            <Text style={styles.secondaryButtonText}>{t('esims', 'share', 'Share')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// FR-402 - every eSIM the account owns, as cards with tap-to-reveal QR,
// ICCID, order number, install links, copy LPA, and share. Ported from
// the web's src/app/my-esims/page.tsx, minus the ShurjoPay-return payment
// banner (that's tied to FR-306's gateway checkout, not built here yet)
// and the "Live status" / print links (FR-403/404, separate, unbuilt FRs).
export default function MyEsimsScreen() {
  const { t } = useAppSettings();
  const { token } = useAuth();

  const esimsQuery = useQuery({
    queryKey: ['esims', 'my-esims'],
    queryFn: () => getMyEsims(token as string),
    enabled: Boolean(token),
  });

  const esims = esimsQuery.data ?? [];

  return (
    <View style={styles.container} testID="my-esims-screen">
      <Text style={styles.title}>{t('esims', 'title', 'My eSIMs')}</Text>

      {esimsQuery.isLoading ? (
        <ActivityIndicator testID="my-esims-loading" />
      ) : esimsQuery.isError ? (
        <Text style={styles.error} testID="my-esims-error">
          {t('esims', 'load_error', "Couldn't load your eSIMs.")}
        </Text>
      ) : esims.length === 0 ? (
        <Text style={styles.empty} testID="my-esims-empty">
          {t('esims', 'empty', 'No active eSIMs found. Browse our destinations to buy your first one.')}
        </Text>
      ) : (
        <FlatList
          data={esims}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <EsimCard item={item} t={t} />}
          testID="my-esims-list"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 20 },
  error: { fontSize: 13, color: '#B42318', textAlign: 'center', marginTop: 40 },
  empty: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 40 },
  card: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  cardHeaderMain: { flex: 1, minWidth: 0 },
  productTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  productMeta: { fontSize: 11, color: '#64748B', marginTop: 2 },
  validityNote: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  statusBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#027A48',
    backgroundColor: '#ECFDF3',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  statusBadgePending: { color: '#92400E', backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  revealButton: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
  },
  revealButtonText: { fontSize: 13, fontWeight: '700', color: '#1D4ED8' },
  qrWrap: { alignItems: 'center', marginBottom: 14 },
  noQrText: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
  detailRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  detailBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10 },
  detailLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  detailValue: { fontSize: 12, color: '#0F172A', fontFamily: 'monospace', marginTop: 2 },
  installRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  installButton: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
  },
  installButtonAndroid: { backgroundColor: '#059669' },
  installButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  secondaryButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    marginBottom: 8,
  },
  secondaryButtonText: { fontSize: 12, fontWeight: '700', color: '#344054' },
});
