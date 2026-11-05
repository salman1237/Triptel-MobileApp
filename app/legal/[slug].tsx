import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getLegalDocument } from '../../src/api/settings';
import { formatDate } from '../../src/lib/datetime';
import LegalMarkdown from '../../src/components/LegalMarkdown';
import { useAppSettings } from '../../src/state/AppSettingsContext';

// Same six documents/slugs as the web's LEGAL_LINKS and the backend's
// LEGAL_TITLES (app/services/legal_content_svc.py) - stable, hardcoded on
// both ends, not fetched from GET /settings/legal (that list endpoint is
// for the admin editor).
const LEGAL_TABS = [
  { slug: 'privacy', title: 'Privacy Policy' },
  { slug: 'data-policy', title: 'Data Privacy' },
  { slug: 'terms', title: 'Terms & Conditions' },
  { slug: 'declaration', title: 'Declaration' },
  { slug: 'refund-policy', title: 'Refund Policy' },
  { slug: 'payment-policy', title: 'Payment Policy' },
];

export default function LegalDocumentScreen() {
  const { t } = useAppSettings();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const docQuery = useQuery({
    queryKey: ['settings', 'legal', slug],
    queryFn: () => getLegalDocument(slug),
    enabled: Boolean(slug),
  });

  return (
    <View style={styles.container} testID="legal-screen">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {LEGAL_TABS.map((tab) => (
          <Pressable
            key={tab.slug}
            onPress={() => router.replace(`/legal/${tab.slug}`)}
            accessibilityRole="button"
            style={[styles.tab, tab.slug === slug && styles.tabActive]}
            testID={`legal-tab-${tab.slug}`}
          >
            <Text style={[styles.tabText, tab.slug === slug && styles.tabTextActive]}>{tab.title}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}>
        {docQuery.isLoading ? (
          <ActivityIndicator testID="legal-loading" />
        ) : docQuery.isError || !docQuery.data ? (
          <Text style={styles.error} testID="legal-error">
            {t('legal', 'load_error', "This page couldn't be loaded right now. Please try again in a moment.")}
          </Text>
        ) : (
          <>
            <Text style={styles.title} testID="legal-title">
              {docQuery.data.title}
            </Text>
            {docQuery.data.updated_at && (
              <Text style={styles.updatedAt} testID="legal-updated-at">
                {t('legal', 'last_updated', 'Last updated')} {formatDate(docQuery.data.updated_at)}
              </Text>
            )}
            <View style={styles.body}>
              <LegalMarkdown body={docQuery.data.body} testID="legal-content" />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  tabBar: { flexGrow: 0, paddingHorizontal: 16, marginBottom: 12 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginEnd: 8,
    backgroundColor: '#F2F4F7',
  },
  tabActive: { backgroundColor: '#DBEAFE' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  tabTextActive: { color: '#1D4ED8' },
  content: { flex: 1, paddingHorizontal: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  updatedAt: { fontSize: 11, color: '#94A3B8', marginTop: 4, marginBottom: 12 },
  body: { marginTop: 8, paddingBottom: 32 },
  error: { fontSize: 13, color: '#64748B', marginTop: 24 },
});
