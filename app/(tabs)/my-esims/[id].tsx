import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getEsimStatus, refreshEsimStatus } from '../../../src/api/esims';
import { useAppSettings } from '../../../src/state/AppSettingsContext';
import { useAuth } from '../../../src/state/AuthContext';
import EsimStatusView from '../../../src/components/esim/EsimStatusView';

// FR-403 - live usage/status/validity for one owned eSIM. Reached from a
// card on the My eSIMs list (FR-402); see EsimStatusView for the actual
// layout, shared later with the public tracking link (FR-501).
export default function EsimStatusScreen() {
  const { t } = useAppSettings();
  const { token } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['esims', 'status', id],
    queryFn: () => getEsimStatus(token as string, id as string),
    enabled: Boolean(token && id),
  });

  const [refreshing, setRefreshing] = React.useState(false);

  async function handleRefresh() {
    if (!token || !id) return;
    setRefreshing(true);
    try {
      const fresh = await refreshEsimStatus(token, id);
      queryClient.setQueryData(['esims', 'status', id], fresh);
    } catch {
      // The pull-to-refresh-style action failing isn't worth its own error
      // banner - the screen still shows the last good snapshot underneath.
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="esim-status-screen">
      {statusQuery.isLoading ? (
        <ActivityIndicator testID="esim-status-loading" />
      ) : statusQuery.isError ? (
        <Text style={styles.error} testID="esim-status-error">
          {t('esim_status', 'load_error', "Couldn't load this eSIM.")}
        </Text>
      ) : statusQuery.data ? (
        <EsimStatusView data={statusQuery.data} refreshing={refreshing} onRefresh={handleRefresh} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 24 },
  error: { fontSize: 13, color: '#B42318', textAlign: 'center', marginTop: 40 },
});
