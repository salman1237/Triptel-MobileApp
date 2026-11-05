import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { getMyTickets } from '../../src/api/support';
import type { Ticket, TicketStatus } from '../../src/api/support';
import { formatDate } from '../../src/lib/datetime';
import { useAppSettings } from '../../src/state/AppSettingsContext';
import { useAuth } from '../../src/state/AuthContext';

// Ported from frontend/src/components/support/TicketThread.tsx's STATUS_STYLE -
// same labels/colors, the customer-facing view (not the staff one).
const STATUS_STYLE: Record<TicketStatus, { badge: object; label: string }> = {
  OPEN: { badge: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }, label: 'Waiting for support' },
  ANSWERED: { badge: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }, label: 'Support replied' },
  RESOLVED: { badge: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }, label: 'Resolved' },
  CLOSED: { badge: { backgroundColor: '#F2F4F7', borderColor: '#E2E8F0' }, label: 'Closed' },
};

export default function SupportTicketListScreen() {
  const { t } = useAppSettings();
  const { token } = useAuth();
  const router = useRouter();

  const ticketsQuery = useQuery({
    queryKey: ['support', 'my-tickets'],
    queryFn: () => getMyTickets(token as string),
    enabled: Boolean(token),
  });

  const tickets = ticketsQuery.data ?? [];

  function renderTicket({ item }: { item: Ticket }) {
    const style = STATUS_STYLE[item.status];
    return (
      <Pressable
        onPress={() => router.push(`/support/${item.id}`)}
        accessibilityRole="button"
        style={styles.row}
        testID={`ticket-item-${item.id}`}
      >
        <View style={styles.rowMain}>
          <Text style={styles.subject} numberOfLines={1} testID={`ticket-subject-${item.id}`}>
            {item.subject}
          </Text>
          <Text style={styles.reference} testID={`ticket-reference-${item.id}`}>
            {item.reference}
          </Text>
        </View>
        <View style={styles.rowEnd}>
          <View style={[styles.statusBadge, style.badge]} testID={`ticket-status-${item.id}`}>
            <Text style={styles.statusBadgeText}>{style.label}</Text>
          </View>
          <Text style={styles.lastMessageDate} testID={`ticket-last-message-${item.id}`}>
            {formatDate(item.last_message_at)}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container} testID="ticket-list-screen">
      <View style={styles.header}>
        <Text style={styles.title}>{t('support', 'tickets_title', 'Support')}</Text>
        <Pressable
          onPress={() => router.push('/support/new')}
          accessibilityRole="button"
          accessibilityLabel={t('support', 'new_ticket', 'New ticket')}
          style={styles.newTicketButton}
          testID="ticket-list-new-ticket"
        >
          <Text style={styles.newTicketButtonText}>{t('support', 'new_ticket', 'New ticket')}</Text>
        </Pressable>
      </View>

      {ticketsQuery.isLoading ? (
        <ActivityIndicator testID="ticket-list-loading" />
      ) : ticketsQuery.isError ? (
        <Text style={styles.error} testID="ticket-list-error">
          {t('support', 'tickets_load_error', "Couldn't load your support tickets.")}
        </Text>
      ) : tickets.length === 0 ? (
        <Text style={styles.empty} testID="ticket-list-empty">
          {t(
            'support',
            'tickets_empty',
            "No tickets yet. If something isn't working, open one and we'll pick it up."
          )}
        </Text>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicket}
          testID="ticket-list"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  newTicketButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
  },
  newTicketButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 40 },
  error: { fontSize: 13, color: '#B42318', textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowMain: { flex: 1, minWidth: 0 },
  subject: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  reference: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  rowEnd: { alignItems: 'flex-end' },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '700', color: '#344054' },
  lastMessageDate: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
});
