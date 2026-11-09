import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { EsimStatus } from '../../api/esims';
import { esimInstallLinks } from '../../lib/esimInstall';
import { formatDateTimeZoned } from '../../lib/datetime';
import { useAppSettings } from '../../state/AppSettingsContext';
import EsimQr from '../EsimQr';
import EsimReceiptButton from './EsimReceiptButton';

function CopyRow({ label, value, testID }: { label: string; value: string; testID: string }) {
  const { t } = useAppSettings();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <View style={styles.copyRow}>
      <Text style={styles.copyLabel}>{label}</Text>
      <Pressable onPress={handleCopy} accessibilityRole="button" style={styles.copyButton} testID={testID}>
        <Text style={styles.copyValue} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.copyAction}>{copied ? t('esim_status', 'copied', 'Copied!') : t('esim_status', 'copy', 'Copy')}</Text>
      </Pressable>
    </View>
  );
}

function dayLabel(yyyymmdd?: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd || '—';
  const iso = `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
  return formatDateTimeZoned(iso).split(',')[0];
}

// FR-403 - shared by the signed-in owner's detail screen
// (app/(tabs)/my-esims/[id].tsx) and, later, the public tracking link
// (FR-501), so a customer forwarding their link sees exactly what they were
// looking at. Ported from the web's src/components/esim/EsimStatusView.tsx,
// same data shape (backend/app/services/esim_telemetry_svc.py's serialize()).
export default function EsimStatusView({
  data,
  refreshing,
  onRefresh,
}: {
  data: EsimStatus;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { t } = useAppSettings();
  const install = esimInstallLinks(data.lpa_string);
  const active = data.status.is_activated;
  const pct = data.usage.used_pct;

  return (
    <View testID="esim-status-view">
      <View style={styles.header}>
        <View style={styles.headerMain}>
          <Text style={styles.title} testID="esim-status-product-title">
            {data.product.title}
          </Text>
          <Text style={styles.headerMeta}>
            {data.order_no}
            {data.iccid ? ` · ${t('esim_status', 'iccid_short', 'ICCID')} ${data.iccid}` : ''}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {onRefresh && (
            <Pressable
              onPress={onRefresh}
              disabled={refreshing}
              accessibilityRole="button"
              accessibilityLabel={t('esim_status', 'refresh', 'Refresh')}
              style={[styles.refreshButton, refreshing && styles.buttonDisabled]}
              testID="esim-status-refresh"
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#1D4ED8" />
              ) : (
                <Text style={styles.refreshButtonText}>{t('esim_status', 'refresh', 'Refresh')}</Text>
              )}
            </Pressable>
          )}
          {/* FR-404 */}
          <EsimReceiptButton
            productTitle={data.product.title}
            orderNo={data.order_no}
            iccid={data.iccid}
            dataLabel={data.product.is_unlimited ? t('esim_status', 'unlimited', 'Unlimited') : `${data.product.data_amount_gb} GB`}
            validityDays={data.validity.days}
            expiresLabel={
              data.validity.expires_at
                ? formatDateTimeZoned(data.validity.expires_at)
                : `${data.validity.days} ${t('esim_status', 'days_after_install', 'days after you install it')}`
            }
            lpaString={data.lpa_string}
            qrValue={data.qr_code_data || data.lpa_string || null}
          />
        </View>
      </View>

      {/* Stale-telemetry warning: the carrier couldn't be reached, so we say
          so rather than showing the last-known numbers as though current. */}
      {data.telemetry.error && (
        <View style={styles.warningBanner} testID="esim-status-stale-warning">
          <Text style={styles.warningText}>
            {t(
              'esim_status',
              'telemetry_stale',
              'Live data from the carrier is temporarily unavailable'
            )}
            {data.telemetry.fetched_at
              ? ` — ${t('esim_status', 'telemetry_stale_last_seen', 'showing what we last saw at')} ${formatDateTimeZoned(data.telemetry.fetched_at)}`
              : ''}
            . {t('esim_status', 'telemetry_stale_install_ok', 'Your install details below are always available.')}
          </Text>
        </View>
      )}

      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('esim_status', 'data_used', 'Data used')}</Text>
          <Text style={styles.statValue} testID="esim-status-data-used">
            {data.usage.formatted || '0 MB'}
          </Text>
          {data.usage.is_unlimited ? (
            <Text style={styles.statMeta}>{t('esim_status', 'unlimited_plan', 'Unlimited plan')}</Text>
          ) : (
            <>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, pct ?? 0)}%` },
                    pct !== null && pct !== undefined && pct >= 90
                      ? styles.progressDanger
                      : pct !== null && pct !== undefined && pct >= 70
                        ? styles.progressWarning
                        : styles.progressOk,
                  ]}
                />
              </View>
              <Text style={styles.statMeta}>
                {data.usage.remaining_formatted} {t('esim_status', 'left_of', 'left of')} {data.usage.allowance_mb ? `${Number(data.usage.allowance_mb).toFixed(0)} MB` : '—'}
              </Text>
            </>
          )}
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('esim_status', 'sim_status', 'SIM status')}</Text>
          <Text style={[styles.statValue, active && styles.statValueActive]} testID="esim-status-label">
            {data.status.label}
          </Text>
          <Text style={styles.statMeta}>
            {data.status.is_installed
              ? data.status.device_model && data.status.device_model !== 'Not Yet Installed'
                ? data.status.device_model
                : t('esim_status', 'installed_on_device', 'Installed on a device')
              : t('esim_status', 'not_installed', 'Not installed on a phone yet')}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('esim_status', 'validity', 'Validity')}</Text>
          <Text style={styles.statValue}>
            {data.validity.days} {t('esim_status', 'days', 'days')}
          </Text>
          <Text style={styles.statMeta} testID="esim-status-validity-meta">
            {data.validity.expires_at
              ? `${t('esim_status', 'expires', 'Expires')} ${formatDateTimeZoned(data.validity.expires_at)}`
              : t('esim_status', 'starts_on_install', 'Starts when you install it')}
          </Text>
        </View>
      </View>

      {data.validity.note && (
        <View style={styles.noteBanner} testID="esim-status-validity-note">
          <Text style={styles.noteText}>{data.validity.note}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {data.status.is_installed
            ? t('esim_status', 'install_another', 'Install on another device')
            : t('esim_status', 'install_this', 'Install this eSIM')}
        </Text>

        <View style={styles.installRow}>
          {install.ios && (
            <Pressable
              onPress={() => Linking.openURL(install.ios as string)}
              accessibilityRole="link"
              style={styles.installButton}
              testID="esim-status-install-ios"
            >
              <Text style={styles.installButtonText}>{t('esim_status', 'install_ios', 'Set up on iPhone')}</Text>
            </Pressable>
          )}
          {install.android && (
            <Pressable
              onPress={() => Linking.openURL(install.android as string)}
              accessibilityRole="link"
              style={[styles.installButton, styles.installButtonAndroid]}
              testID="esim-status-install-android"
            >
              <Text style={styles.installButtonText}>{t('esim_status', 'install_android', 'Set up on Android')}</Text>
            </Pressable>
          )}
        </View>

        {data.qr_code_data && (
          <View style={styles.qrWrap}>
            <EsimQr value={data.qr_code_data} size={160} testID="esim-status-qr" />
          </View>
        )}

        {data.smdp_address && <CopyRow label={t('esim_status', 'smdp', 'SM-DP+ address')} value={data.smdp_address} testID="esim-status-copy-smdp" />}
        {data.matching_id && (
          <CopyRow label={t('esim_status', 'matching_id', 'Activation code (matching ID)')} value={data.matching_id} testID="esim-status-copy-matching-id" />
        )}
        {data.lpa_string && <CopyRow label={t('esim_status', 'lpa', 'Full LPA activation string')} value={data.lpa_string} testID="esim-status-copy-lpa" />}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('esim_status', 'details', 'eSIM details')}</Text>
        {[
          [t('esim_status', 'detail_plan', 'Plan'), data.product.title],
          [
            t('esim_status', 'detail_data', 'Data'),
            data.product.is_unlimited ? t('esim_status', 'unlimited', 'Unlimited') : `${data.product.data_amount_gb} GB`,
          ],
          [t('esim_status', 'detail_validity', 'Validity'), `${data.validity.days} ${t('esim_status', 'days', 'days')}`],
          [t('esim_status', 'detail_order_ref', 'Order reference'), data.order_no],
          [t('esim_status', 'detail_iccid', 'ICCID'), data.iccid || '—'],
          [t('esim_status', 'detail_purchased', 'Purchased'), formatDateTimeZoned(data.purchased_at)],
          [
            t('esim_status', 'detail_first_activated', 'First activated'),
            data.validity.activated_at ? formatDateTimeZoned(data.validity.activated_at) : t('esim_status', 'not_yet', 'Not yet'),
          ],
          [
            t('esim_status', 'detail_expires', 'Expires'),
            data.validity.expires_at
              ? formatDateTimeZoned(data.validity.expires_at)
              : `${t('esim_status', 'detail_expires_on_install', 'On install +')} ${data.validity.days} ${t('esim_status', 'days', 'days')}`,
          ],
        ].map(([label, value]) => (
          <View key={label} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={styles.detailValue}>{value}</Text>
          </View>
        ))}
      </View>

      {data.daily_breakdown.length > 0 && (
        <View style={styles.section} testID="esim-status-daily-breakdown">
          <Text style={styles.sectionTitle}>{t('esim_status', 'daily_usage', 'Daily usage')}</Text>
          {data.daily_breakdown.map((d, i) => (
            <View key={i} style={styles.dailyRow}>
              <Text style={styles.dailyDay}>{dayLabel(d.usageDate)}</Text>
              <Text style={styles.dailyNetwork}>{d.mnoname || '—'}</Text>
              <Text style={styles.dailyUsage}>{d.usage ? `${(Number(d.usage) / 1024 / 1024).toFixed(2)} MB` : '—'}</Text>
            </View>
          ))}
        </View>
      )}

      {data.history.length > 0 && (
        <View style={styles.section} testID="esim-status-history">
          <Text style={styles.sectionTitle}>{t('esim_status', 'install_history', 'Installation history')}</Text>
          {data.history.map((h, i) => (
            <View key={i} style={styles.historyRow}>
              <Text style={styles.historyEvent}>{h.event_name || t('esim_status', 'carrier_event', 'Carrier event')}</Text>
              <Text style={styles.historyMeta}>
                {formatDateTimeZoned(h.date)} · {h.status}
              </Text>
            </View>
          ))}
        </View>
      )}

      {data.telemetry.fetched_at && !data.telemetry.error && (
        <Text style={styles.footerNote} testID="esim-status-last-checked">
          {t('esim_status', 'last_checked', 'Live figures from the carrier, last checked')} {formatDateTimeZoned(data.telemetry.fetched_at)}.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerMain: { flex: 1, minWidth: 0 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  headerMeta: { fontSize: 11, color: '#64748B', marginTop: 4 },
  refreshButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  refreshButtonText: { fontSize: 12, fontWeight: '700', color: '#1D4ED8' },
  warningBanner: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  warningText: { fontSize: 12, color: '#92400E' },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, padding: 12 },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  statValue: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  statValueActive: { color: '#027A48' },
  statMeta: { fontSize: 10, color: '#64748B', marginTop: 4 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#F1F5F9', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressOk: { backgroundColor: '#10B981' },
  progressWarning: { backgroundColor: '#F59E0B' },
  progressDanger: { backgroundColor: '#EF4444' },
  noteBanner: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  noteText: { fontSize: 12, color: '#1E3A8A' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  installRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  installButton: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A', borderRadius: 10 },
  installButtonAndroid: { backgroundColor: '#059669' },
  installButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  qrWrap: { alignItems: 'center', marginBottom: 14 },
  copyRow: { marginBottom: 10 },
  copyLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: 4 },
  copyButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  copyValue: { flex: 1, fontSize: 11, fontFamily: 'monospace', color: '#0F172A' },
  copyAction: { fontSize: 11, fontWeight: '700', color: '#1D4ED8' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailLabel: { fontSize: 12, color: '#64748B' },
  detailValue: { fontSize: 12, color: '#0F172A', fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  dailyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dailyDay: { fontSize: 11, color: '#334155', flex: 1 },
  dailyNetwork: { fontSize: 11, color: '#64748B', flex: 1, textAlign: 'center' },
  dailyUsage: { fontSize: 11, color: '#0F172A', fontFamily: 'monospace', flex: 1, textAlign: 'right' },
  historyRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  historyEvent: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  historyMeta: { fontSize: 10, color: '#64748B', marginTop: 2 },
  footerNote: { fontSize: 10, color: '#94A3B8', marginTop: 4, marginBottom: 24 },
});
