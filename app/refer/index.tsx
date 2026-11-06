import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getMyReferrals } from '../../src/api/referrals';
import type { ReferredPerson } from '../../src/api/referrals';
import { formatDate } from '../../src/lib/datetime';
import { useAppSettings } from '../../src/state/AppSettingsContext';
import { useAuth } from '../../src/state/AuthContext';

// Ported from the web's EVENT_COPY (src/app/refer/page.tsx).
const EVENT_COPY: Record<string, { label: string; detail: string }> = {
  JOINING: { label: 'They sign up', detail: 'Credited as soon as they create their account' },
  FIRST_PURCHASE: { label: 'They buy their first eSIM', detail: 'Credited when that eSIM is delivered' },
  NEW_MERCHANT: { label: 'They become a partner', detail: "Credited when their partner application is approved" },
};

// Reward amounts are the REWARD wallet's own EUR figures, not a display
// conversion - same reasoning as the withdrawal screens' `eur()` helper:
// this is what was actually earned/credited, not a converted estimate.
function eur(value: number): string {
  return `€${value.toFixed(2)}`;
}

// FR-801 - code/link, stat tiles, per-event reward amounts, and a list of
// referred people with what each earned. Ported from the "Refer & earn"
// sections of the web's src/app/refer/page.tsx, minus the "Were you
// referred by someone?" claim form (FR-802, separate FR) - this screen
// only shows the passive "you were referred by X" line when a referrer is
// already on file, since that's just rendering data this same endpoint
// already returns, not the claim action itself.
export default function ReferralScreen() {
  const { t } = useAppSettings();
  const { token } = useAuth();

  const summaryQuery = useQuery({
    queryKey: ['referrals', 'me'],
    queryFn: () => getMyReferrals(token as string),
    enabled: Boolean(token),
  });
  const summary = summaryQuery.data;

  async function handleShare() {
    if (!summary?.share_url) return;
    try {
      await Share.share({
        message: `Get mobile data abroad with Triptel. Use my code ${summary.code} when you sign up. ${summary.share_url}`,
        url: summary.share_url,
      });
    } catch {
      // User dismissed the share sheet - nothing to do.
    }
  }

  function rewardsFor(username: string) {
    return (summary?.rewards ?? []).filter((r) => r.referred_username === username);
  }

  function renderReferredPerson(person: ReferredPerson) {
    const theirs = rewardsFor(person.username);
    const earned = theirs.filter((r) => r.status === 'GRANTED').reduce((sum, r) => sum + r.amount, 0);
    const hasReversed = theirs.some((r) => r.status === 'REVERSED');
    return (
      <View key={person.username} style={styles.personRow} testID={`referred-person-${person.username}`}>
        <View style={styles.personMain}>
          <View style={styles.personNameRow}>
            <Text style={styles.personName}>{person.username}</Text>
            {person.role === 'MERCHANT' && (
              <View style={styles.partnerBadge} testID={`referred-person-partner-${person.username}`}>
                <Text style={styles.partnerBadgeText}>{t('referrals', 'partner_badge', 'Partner')}</Text>
              </View>
            )}
          </View>
          <Text style={styles.personJoined}>{formatDate(person.joined_at)}</Text>
        </View>
        <View style={styles.personEnd}>
          <Text style={styles.personEarned} testID={`referred-person-earned-${person.username}`}>
            {earned > 0 ? eur(earned) : '—'}
          </Text>
          {hasReversed && (
            <Text style={styles.reversedNote}>{t('referrals', 'reward_reversed', 'a reward was reversed')}</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} testID="referral-screen">
      <Text style={styles.title}>{t('referrals', 'title', 'Refer & earn')}</Text>
      <Text style={styles.subtitle}>
        {t('referrals', 'subtitle', 'Share your code. You both get reward credit you can spend on eSIMs.')}
      </Text>

      {summaryQuery.isLoading ? (
        <ActivityIndicator testID="referral-loading" />
      ) : summaryQuery.isError || !summary ? (
        <Text style={styles.error} testID="referral-error">
          {t('referrals', 'load_error', "Couldn't load your referral details.")}
        </Text>
      ) : (
        <>
          {!summary.is_enabled && (
            <Text style={styles.noticeBox} testID="referral-disabled-notice">
              {t(
                'referrals',
                'program_disabled',
                "The referral programme isn't running at the moment. Your code still works for sharing, but no reward is credited yet."
              )}
            </Text>
          )}

          {summary.code && (
            <View style={styles.codeCard}>
              <Text style={styles.codeLabel}>{t('referrals', 'your_code', 'Your code')}</Text>
              <Text style={styles.codeValue} testID="referral-code">
                {summary.code}
              </Text>
              {summary.share_url && (
                <Pressable
                  onPress={handleShare}
                  accessibilityRole="button"
                  style={styles.shareButton}
                  testID="referral-share-button"
                >
                  <Text style={styles.shareButtonText}>{t('referrals', 'share_link', 'Share my link')}</Text>
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.tilesRow} testID="referral-stat-tiles">
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>{t('referrals', 'tile_reward_credit', 'Reward credit')}</Text>
              <Text style={styles.tileValueEmerald} testID="referral-promo-balance">
                {eur(summary.promo_balance)}
              </Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>{t('referrals', 'tile_total_earned', 'Earned from referrals')}</Text>
              <Text style={styles.tileValue} testID="referral-total-earned">
                {eur(summary.total_earned)}
              </Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>{t('referrals', 'tile_referred_count', 'People joined')}</Text>
              <Text style={styles.tileValue} testID="referral-referred-count">
                {summary.referred_count}
              </Text>
            </View>
          </View>

          {Object.entries(summary.events).filter(([, a]) => a.enabled).length > 0 && (
            <View style={styles.eventsSection} testID="referral-events">
              <Text style={styles.sectionTitle}>{t('referrals', 'what_you_earn', 'What you earn')}</Text>
              {Object.entries(summary.events)
                .filter(([, a]) => a.enabled)
                .map(([event, amounts]) => {
                  const copy = EVENT_COPY[event] ?? { label: event, detail: '' };
                  return (
                    <View key={event} style={styles.eventRow} testID={`referral-event-${event}`}>
                      <View style={styles.eventMain}>
                        <Text style={styles.eventLabel}>{copy.label}</Text>
                        {copy.detail ? <Text style={styles.eventDetail}>{copy.detail}</Text> : null}
                      </View>
                      <View style={styles.eventEnd}>
                        {amounts.referrer > 0 && (
                          <Text style={styles.eventReferrerAmount} testID={`referral-event-referrer-${event}`}>
                            {t('referrals', 'you_get', 'You get')} {eur(amounts.referrer)}
                          </Text>
                        )}
                        {amounts.referred > 0 && (
                          <Text style={styles.eventReferredAmount}>
                            {t('referrals', 'they_get', 'They get')} {eur(amounts.referred)}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
            </View>
          )}

          {!summary.can_claim && summary.referred_by && (
            <Text style={styles.referredByNote} testID="referral-referred-by">
              {t('referrals', 'referred_by_prefix', 'You were referred by')} {summary.referred_by}.
            </Text>
          )}

          <Text style={styles.sectionTitle}>{t('referrals', 'people_referred', 'People you referred')}</Text>
          {summary.referred.length === 0 ? (
            <Text style={styles.empty} testID="referral-people-empty">
              {t(
                'referrals',
                'people_empty',
                'Nobody yet. Share your link and your first reward lands as soon as someone signs up.'
              )}
            </Text>
          ) : (
            <View testID="referral-people-list">{summary.referred.map(renderReferredPerson)}</View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 4, marginBottom: 16 },
  error: { fontSize: 13, color: '#B42318', textAlign: 'center', marginTop: 40 },
  noticeBox: {
    fontSize: 12,
    color: '#92400E',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  codeCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  codeLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  codeValue: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 4, fontFamily: 'monospace' },
  shareButton: {
    minHeight: 40,
    marginTop: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
  },
  shareButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tilesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  tile: { flexGrow: 1, flexBasis: '30%', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12 },
  tileLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' },
  tileValue: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  tileValueEmerald: { fontSize: 18, fontWeight: '800', color: '#059669', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  eventsSection: { marginBottom: 20 },
  eventRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  eventMain: { flex: 1, minWidth: 0 },
  eventLabel: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  eventDetail: { fontSize: 11, color: '#64748B', marginTop: 2 },
  eventEnd: { alignItems: 'flex-end' },
  eventReferrerAmount: { fontSize: 11, fontWeight: '700', color: '#059669' },
  eventReferredAmount: { fontSize: 11, color: '#475569' },
  referredByNote: { fontSize: 12, color: '#64748B', marginBottom: 16 },
  empty: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 16, marginBottom: 24 },
  personRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  personMain: { flex: 1, minWidth: 0 },
  personNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  personName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  partnerBadge: {
    backgroundColor: '#FDF4FF',
    borderWidth: 1,
    borderColor: '#F5D0FE',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  partnerBadgeText: { fontSize: 9, fontWeight: '700', color: '#A21CAF' },
  personJoined: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  personEnd: { alignItems: 'flex-end' },
  personEarned: { fontSize: 13, fontWeight: '700', color: '#059669', fontFamily: 'monospace' },
  reversedNote: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
});
