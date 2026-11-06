import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useAppSettings } from '../state/AppSettingsContext';
import { useAuth } from '../state/AuthContext';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);
// A customer standing in an airport with a tracking link from their
// delivery email needs their QR code whatever we are doing to the site.
// That page is read-only and its own share token is the only way in, so
// it stays up. Ported from the web's src/components/MaintenanceGate.tsx -
// FR-501 (the RN tracking screen itself) isn't built yet, but this
// exemption is kept now rather than guessed in later as an afterthought.
const ALWAYS_AVAILABLE_PREFIX = '/track/';

// FR-1203 - a maintenance-flagged backend shows a blocking screen instead
// of the app shell. Reads the `publicSettings` FR-1202's bootstrap gate
// already fetches - no separate request.
export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { publicSettings, t } = useAppSettings();
  const { user } = useAuth();
  const pathname = usePathname() || '';

  const isAdmin = Boolean(user && ADMIN_ROLES.has(user.role));
  const exempt = pathname.startsWith(ALWAYS_AVAILABLE_PREFIX);
  const maintenanceMode = Boolean(publicSettings?.maintenance_mode);

  if (maintenanceMode && !isAdmin && !exempt) {
    return (
      <View style={styles.container} testID="maintenance-gate">
        <Text style={styles.title}>
          {publicSettings?.platform_name ? `${publicSettings.platform_name} — ` : ''}
          {t('common', 'maintenance_title', 'Down for maintenance')}
        </Text>
        <Text style={styles.body}>
          {t(
            'common',
            'maintenance_body',
            "We're making some improvements and will be back shortly. Thanks for your patience."
          )}
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 10 },
  body: { fontSize: 13, color: '#64748B', textAlign: 'center' },
});
