import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppSettings } from '../../src/state/AppSettingsContext';

// Ported verbatim from frontend/src/app/guides/esim-setup-guide/page.tsx.
const STEPS_IOS = [
  'Connect your iPhone to Wi-Fi (installing an eSIM needs an internet connection).',
  'Open the QR code from your order email, or open My eSIMs on this app and tap "Install on iPhone".',
  'Go to Settings > Cellular (or Mobile Service) > Add eSIM > Use QR Code, and scan it - or tap the install link directly from the email.',
  'Choose labels for your lines (e.g. keep your home line as default for calls/SMS, and use the new eSIM for data) under Settings > Cellular.',
  'Turn on Data Roaming for the new eSIM: Settings > Cellular > [your eSIM] > Network Selection / Data Roaming > On.',
  "That's it - your validity period starts counting once the eSIM connects to a network in your destination, not at install.",
];

const STEPS_ANDROID = [
  'Connect your Android phone to Wi-Fi.',
  'Open the QR code from your order email, or open My eSIMs on this app and tap "Install on Android" (on supported devices this installs directly, no scanning needed).',
  'Otherwise go to Settings > Network & internet > SIMs (or "Connections" > "SIM card manager" on Samsung) > Add eSIM / Download a SIM > scan the QR code.',
  'Make sure the new eSIM is enabled, and that mobile data + data roaming are turned on for it under its SIM settings.',
  'Set your preferred SIM for mobile data to the new eSIM so your phone actually uses it abroad.',
];

const TROUBLESHOOTING = [
  'Toggle Airplane Mode on and off, or restart your phone.',
  'Check the eSIM line has Data Roaming turned on - most data-only eSIMs need this explicitly enabled.',
  'Make sure the eSIM line (not your home SIM) is selected for mobile data.',
];

export default function EsimSetupGuideScreen() {
  const { t } = useAppSettings();
  const router = useRouter();

  return (
    <ScrollView style={styles.container} testID="esim-setup-screen">
      <Text style={styles.title}>{t('guides', 'esim_setup_title', 'eSIM Setup Guide')}</Text>
      <Text style={styles.intro} testID="esim-setup-intro">
        {t(
          'guides',
          'esim_setup_intro',
          "Takes about two minutes. Install it a day or two before you travel if you can - it won't start using up your validity until it actually connects to a network."
        )}
      </Text>

      <View style={styles.warningBox} testID="esim-setup-warning">
        <Text style={styles.warningText} testID="esim-setup-warning-text">
          {t(
            'guides',
            'esim_setup_warning',
            "An eSIM can only be installed once. If you delete it from your phone, it usually can't be reinstalled - check your plan details, and ask Support before removing it."
          )}
        </Text>
        <Pressable
          onPress={() => router.push('/support')}
          accessibilityRole="button"
          accessibilityLabel={t('guides', 'support_link', 'Contact Support')}
          testID="esim-setup-warning-support-link"
        >
          <Text style={styles.linkText}>{t('guides', 'support_link', 'Contact Support')}</Text>
        </Pressable>
      </View>

      <View style={styles.stepsCard} testID="esim-setup-ios-steps">
        <Text style={styles.stepsHeading}>{t('guides', 'esim_setup_ios_heading', 'iPhone')}</Text>
        {STEPS_IOS.map((step, i) => (
          <View key={step} style={styles.stepRow} testID={`esim-setup-ios-step-${i}`}>
            <Text style={styles.stepNumber}>{i + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      <View style={styles.stepsCard} testID="esim-setup-android-steps">
        <Text style={styles.stepsHeading}>{t('guides', 'esim_setup_android_heading', 'Android')}</Text>
        {STEPS_ANDROID.map((step, i) => (
          <View key={step} style={styles.stepRow} testID={`esim-setup-android-step-${i}`}>
            <Text style={styles.stepNumber}>{i + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
        <Text style={styles.stepsNote} testID="esim-setup-android-note">
          {t(
            'guides',
            'esim_setup_android_note',
            'Menu names vary slightly by brand (Samsung, Xiaomi, Oppo, etc.) - look for "eSIM" or "Add SIM" under your SIM/network settings.'
          )}
        </Text>
      </View>

      <View style={styles.stepsCard} testID="esim-setup-troubleshooting">
        <Text style={styles.stepsHeading}>{t('guides', 'esim_setup_troubleshooting_heading', "If it's not connecting")}</Text>
        {TROUBLESHOOTING.map((item, i) => (
          <Text key={item} style={styles.troubleshootingItem} testID={`esim-setup-troubleshooting-item-${i}`}>
            {'• '}
            {item}
          </Text>
        ))}
        <Pressable
          onPress={() => router.push('/my-esims')}
          accessibilityRole="button"
          accessibilityLabel={t('guides', 'my_esims_link', 'Check your eSIM in My eSIMs')}
          testID="esim-setup-my-esims-link"
        >
          <Text style={styles.troubleshootingItem}>
            {'• '}
            {t(
              'guides',
              'esim_setup_check_usage',
              "Check your eSIM's usage and expiry any time from the tracking link in your order email, or from My eSIMs."
            )}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/support')}
          accessibilityRole="button"
          accessibilityLabel={t('guides', 'support_link', 'Contact Support')}
          testID="esim-setup-troubleshooting-support-link"
        >
          <Text style={styles.troubleshootingItem}>
            {'• '}
            {t('guides', 'esim_setup_still_stuck', 'Still stuck? Contact Support with your order number.')}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => router.push('/guides/compatible-phones')}
        accessibilityRole="button"
        accessibilityLabel={t('guides', 'back_link', 'Check device compatibility')}
        style={styles.backLink}
        testID="esim-setup-back-link"
      >
        <Text style={styles.backLinkText}>{t('guides', 'back_link', '<- Check device compatibility')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  intro: { fontSize: 13, color: '#64748B', marginBottom: 20 },
  warningBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
    padding: 14,
    marginBottom: 20,
  },
  warningText: { fontSize: 12, color: '#92400E', lineHeight: 18, marginBottom: 6 },
  linkText: { fontSize: 12, fontWeight: '700', color: '#1D4ED8', textDecorationLine: 'underline' },
  stepsCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  stepsHeading: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  stepRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-start' },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
  },
  stepText: { flex: 1, fontSize: 12, color: '#475569', lineHeight: 18 },
  stepsNote: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  troubleshootingItem: { fontSize: 12, color: '#475569', marginBottom: 8, lineHeight: 18 },
  backLink: { marginTop: 8, marginBottom: 32 },
  backLinkText: { fontSize: 14, fontWeight: '700', color: '#1D4ED8' },
});
