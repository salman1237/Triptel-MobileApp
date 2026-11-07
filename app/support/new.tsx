import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { createTicket, getCategories } from '../../src/api/support';
import type { NewTicketFile, TicketCategory } from '../../src/api/support';
import { ApiError } from '../../src/lib/apiClient';
import { useAppSettings } from '../../src/state/AppSettingsContext';
import { useAuth } from '../../src/state/AuthContext';

const MAX_ATTACHMENTS = 5;

// FR-1102 - open a support ticket with subject/category/body and up to 5
// attachments. Ported from the compose form of the web's src/app/support/
// page.tsx; the category list comes from the same public /support/categories
// endpoint so the options can't drift from the backend's enum.
export default function NewTicketScreen() {
  const { t } = useAppSettings();
  const { token } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: ['support', 'categories'],
    queryFn: getCategories,
  });
  const categories = categoriesQuery.data ?? [];

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('OTHER');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<NewTicketFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = subject.trim().length >= 3 && body.trim().length > 0 && !submitting;

  async function handleAddAttachment() {
    if (files.length >= MAX_ATTACHMENTS) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_ATTACHMENTS - files.length,
      quality: 0.8,
    });
    if (result.canceled) return;
    const picked: NewTicketFile[] = result.assets.map((asset, i) => ({
      uri: asset.uri,
      name: asset.fileName || `attachment-${Date.now()}-${i}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    }));
    setFiles((prev) => [...prev, ...picked].slice(0, MAX_ATTACHMENTS));
  }

  function removeAttachment(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!token || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createTicket(token, { subject: subject.trim(), body: body.trim(), category, files });
      await queryClient.invalidateQueries({ queryKey: ['support', 'my-tickets'] });
      // FR-1103 (the ticket thread screen) isn't built yet, so the new
      // ticket is shown via the list it now appears in rather than routing
      // to a destination that doesn't exist - same reasoning applies to
      // every existing ticket's row in app/support/index.tsx today.
      router.replace('/support');
    } catch (err) {
      setSubmitError(
        err instanceof ApiError && typeof err.detail === 'string'
          ? err.detail
          : t('support', 'new_ticket_network_error', "Couldn't open that ticket. Please try again.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} testID="new-ticket-screen">
      <Text style={styles.title}>{t('support', 'new_ticket_title', 'What can we help with?')}</Text>

      <Text style={styles.label}>{t('support', 'subject_label', 'Subject')}</Text>
      <TextInput
        value={subject}
        onChangeText={setSubject}
        placeholder={t('support', 'subject_placeholder', 'A short summary')}
        accessibilityLabel={t('support', 'subject_label', 'Subject')}
        maxLength={200}
        style={styles.input}
        testID="new-ticket-subject-input"
      />

      <Text style={styles.label}>{t('support', 'category_label', 'Topic')}</Text>
      <View style={styles.categoryRow} testID="new-ticket-category-row">
        {categories.map((c) => {
          const selected = c.value === category;
          return (
            <Pressable
              key={c.value}
              onPress={() => setCategory(c.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.categoryChip, selected && styles.categoryChipSelected]}
              testID={`new-ticket-category-${c.value}`}
            >
              <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>{t('support', 'body_label', 'Tell us what happened')}</Text>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder={t(
          'support',
          'body_placeholder',
          'The more detail the better - error messages, what phone you’re using, what you’d already tried.'
        )}
        accessibilityLabel={t('support', 'body_label', 'Tell us what happened')}
        multiline
        numberOfLines={5}
        maxLength={5000}
        style={[styles.input, styles.bodyInput]}
        testID="new-ticket-body-input"
      />

      {files.length > 0 && (
        <View style={styles.attachmentRow} testID="new-ticket-attachments">
          {files.map((file, i) => (
            <View key={`${file.uri}-${i}`} style={styles.attachmentThumb} testID={`new-ticket-attachment-${i}`}>
              <Image source={{ uri: file.uri }} style={styles.attachmentImage} />
              <Pressable
                onPress={() => removeAttachment(i)}
                accessibilityRole="button"
                accessibilityLabel={t('support', 'remove_attachment', 'Remove attachment')}
                style={styles.attachmentRemove}
                testID={`new-ticket-attachment-remove-${i}`}
              >
                <Text style={styles.attachmentRemoveText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Pressable
        onPress={handleAddAttachment}
        disabled={files.length >= MAX_ATTACHMENTS}
        accessibilityRole="button"
        accessibilityLabel={t('support', 'add_attachment', 'Attach a screenshot')}
        style={[styles.attachButton, files.length >= MAX_ATTACHMENTS && styles.buttonDisabled]}
        testID="new-ticket-add-attachment"
      >
        <Text style={styles.attachButtonText}>{t('support', 'add_attachment', 'Attach a screenshot')}</Text>
      </Pressable>
      <Text style={styles.attachmentHint}>
        {t('support', 'attachment_hint', 'Up to 5 files')} ({files.length}/{MAX_ATTACHMENTS})
      </Text>

      {submitError && (
        <Text style={styles.error} testID="new-ticket-error">
          {submitError}
        </Text>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityLabel={t('support', 'submit_ticket', 'Open ticket')}
        style={[styles.submitButton, !canSubmit && styles.buttonDisabled]}
        testID="new-ticket-submit"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.submitButtonText}>{t('support', 'submit_ticket', 'Open ticket')}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 24 },
  title: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '700', color: '#667085', marginBottom: 6, marginTop: 4 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  bodyInput: { minHeight: 110, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  categoryChip: {
    minHeight: 32,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 16,
  },
  categoryChipSelected: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  categoryChipText: { fontSize: 12, fontWeight: '700', color: '#344054' },
  categoryChipTextSelected: { color: '#fff' },
  attachmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  attachmentThumb: { width: 56, height: 56, borderRadius: 8, overflow: 'hidden' },
  attachmentImage: { width: '100%', height: '100%' },
  attachmentRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentRemoveText: { color: '#fff', fontSize: 12, lineHeight: 14 },
  attachButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
  },
  attachButtonText: { fontSize: 12, fontWeight: '700', color: '#344054' },
  attachmentHint: { fontSize: 11, color: '#94A3B8', marginTop: 6, marginBottom: 16 },
  error: { color: '#B42318', fontSize: 12, marginBottom: 12 },
  submitButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    marginBottom: 32,
  },
  buttonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
