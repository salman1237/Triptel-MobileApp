import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAppSettings } from '../../src/state/AppSettingsContext';

// Reference list, not pulled from a device database - ported verbatim from
// frontend/src/app/guides/compatible-phones/page.tsx. New models are added
// by editing this array, same as the web app.
const DEVICES: { brand: string; models: string[] }[] = [
  {
    brand: 'Apple iPhone',
    models: [
      'iPhone 17, 17 Pro, 17 Pro Max, Air',
      'iPhone 16 series (including 16e)',
      'iPhone 15 series',
      'iPhone 14 series',
      'iPhone 13 series',
      'iPhone 12 series',
      'iPhone 11 series',
      'iPhone XS, XS Max, XR',
      'iPhone SE (2020 and later)',
    ],
  },
  {
    brand: 'Samsung Galaxy',
    models: [
      'Galaxy S25 / S24 / S23 / S22 / S21 / S20 series',
      'Galaxy Z Fold 3 and later, Z Flip 3 and later',
      'Galaxy Note 20 series',
    ],
  },
  {
    brand: 'Google Pixel',
    models: ['Pixel 9 series', 'Pixel 8 series', 'Pixel 7 series', 'Pixel 6 series', 'Pixel 5', 'Pixel 4 / 4a', 'Pixel 3 / 3a'],
  },
  {
    brand: 'Other popular models',
    models: [
      'Huawei P40, Mate 40 series and later',
      'Oppo Find X3, X5, X7 series',
      'Sony Xperia 10 IV and later, Xperia 1 IV and later',
      'Motorola Razr (2019 and later), Edge 40/50 series',
      'Honor Magic series, Honor 90 and later',
    ],
  },
];

// Same public static asset the web app serves from its own domain - this is
// marketing/guide content, not an API call, so it isn't affected by the
// EXPO_PUBLIC_API_URL beta/production split (see docs/Rules.md -> "real backend").
const VIDEO_SOURCE = 'https://triptel.co/guides/check-esim-support.mp4';

export default function CompatiblePhonesScreen() {
  const { t } = useAppSettings();
  const router = useRouter();
  const player = useVideoPlayer(VIDEO_SOURCE);

  return (
    <ScrollView style={styles.container} testID="compatible-phones-screen">
      <Text style={styles.title}>{t('guides', 'compatible_phones_title', 'eSIM Compatible Phones')}</Text>
      <Text style={styles.intro} testID="compatible-phones-intro">
        {t(
          'guides',
          'compatible_phones_intro',
          "Before you buy, make sure your phone supports eSIM and is not carrier-locked - a locked phone usually can't add a second carrier's eSIM even on a supported model."
        )}
      </Text>

      <View style={styles.dialCheckBox} testID="compatible-phones-dial-check">
        <Text style={styles.dialCheckHeading} testID="compatible-phones-dial-check-heading">
          {t('guides', 'dial_check_heading', 'The fastest way to check: dial *#06#')}
        </Text>
        <Text style={styles.dialCheckBody} testID="compatible-phones-dial-check-body">
          {t(
            'guides',
            'dial_check_body',
            "Open your phone's dialer and dial *#06# - no need to press call. A screen with your device's ID numbers will pop up. If you see a line labelled EID, your phone supports eSIM. If there's no EID shown, only an IMEI, your phone can't use an eSIM."
          )}
        </Text>
        <VideoView player={player} style={styles.video} nativeControls testID="compatible-phones-video" />
        <Text style={styles.videoCaption}>
          {t('guides', 'dial_check_video_caption', 'Watch: how to dial *#06# and spot the EID line.')}
        </Text>
      </View>

      <View style={styles.fallbackBox} testID="compatible-phones-fallback">
        <Text style={styles.fallbackText} testID="compatible-phones-fallback-text">
          <Text style={styles.fallbackBold}>{t('guides', 'fallback_heading', 'Still not sure?')} </Text>
          {t(
            'guides',
            'fallback_body',
            'On iPhone: Settings > General > About > look for "Digital SIM" or check your carrier. On Android: Settings > Network & internet > SIMs > look for an "Add eSIM" or "Download a SIM" option. If it\'s missing, your device or region variant likely doesn\'t support eSIM.'
          )}
        </Text>
      </View>

      <View style={styles.devicesGrid}>
        {DEVICES.map((group) => (
          <View key={group.brand} style={styles.deviceCard} testID={`compatible-phones-brand-${group.brand}`}>
            <Text style={styles.brandTitle}>{group.brand}</Text>
            {group.models.map((model) => (
              <Text key={model} style={styles.modelText}>
                {'• '}
                {model}
              </Text>
            ))}
          </View>
        ))}
      </View>

      <Text style={styles.closingNote} testID="compatible-phones-closing-note">
        {t(
          'guides',
          'closing_note',
          "This list covers the devices we see most often - it isn't exhaustive. If your model isn't listed, check the manufacturer's own eSIM support page, or ask us before buying via Support."
        )}
      </Text>

      <Pressable
        onPress={() => router.push('/support')}
        accessibilityRole="button"
        accessibilityLabel={t('guides', 'support_link', 'Contact Support')}
        style={styles.supportLink}
        testID="compatible-phones-support-link"
      >
        <Text style={styles.supportLinkText}>{t('guides', 'support_link', 'Contact Support')}</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push('/guides/esim-setup-guide')}
        accessibilityRole="button"
        accessibilityLabel={t('guides', 'next_link', 'Next: how to install your eSIM')}
        style={styles.nextLink}
        testID="compatible-phones-next-link"
      >
        <Text style={styles.nextLinkText}>{t('guides', 'next_link', 'Next: how to install your eSIM ->')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  intro: { fontSize: 13, color: '#64748B', marginBottom: 20 },
  dialCheckBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    padding: 16,
    marginBottom: 16,
  },
  dialCheckHeading: { fontSize: 13, fontWeight: '700', color: '#064E3B', marginBottom: 8 },
  dialCheckBody: { fontSize: 12, color: '#065F46', lineHeight: 18 },
  video: { width: '100%', height: 200, borderRadius: 12, marginTop: 12, backgroundColor: '#000' },
  videoCaption: { fontSize: 11, color: '#047857', marginTop: 8 },
  fallbackBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    padding: 14,
    marginBottom: 20,
  },
  fallbackText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  fallbackBold: { fontWeight: '700' },
  devicesGrid: { gap: 12 },
  deviceCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  brandTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  modelText: { fontSize: 12, color: '#475569', marginBottom: 4 },
  closingNote: { fontSize: 12, color: '#64748B', marginTop: 20, lineHeight: 18 },
  supportLink: { marginTop: 8 },
  supportLinkText: { fontSize: 13, fontWeight: '600', color: '#1D4ED8' },
  nextLink: { marginTop: 16, marginBottom: 32 },
  nextLinkText: { fontSize: 14, fontWeight: '700', color: '#1D4ED8' },
});
