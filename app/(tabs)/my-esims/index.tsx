import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppSettings } from '../../../src/state/AppSettingsContext';

// Placeholder landing point for "My eSIMs" - FR-307's success screen needs
// somewhere real to link to, but the actual list (cards, tap-to-reveal QR,
// install links, copy LPA, share/print) is FR-402's own, separate,
// not-yet-built feature. Deliberately minimal until then - see
// docs/Architecture.md's FR split.
export default function MyEsimsScreen() {
  const { t } = useAppSettings();

  return (
    <View style={styles.container} testID="my-esims-placeholder">
      <Text style={styles.text}>{t('esims', 'my_esims_coming_soon', 'Your eSIMs will appear here soon.')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  text: { fontSize: 14, color: '#667085', textAlign: 'center' },
});
