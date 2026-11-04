import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { changePassword } from '../../src/api/auth';
import { ApiError } from '../../src/lib/apiClient';
import { useAuth } from '../../src/state/AuthContext';
import { useAppSettings } from '../../src/state/AppSettingsContext';

// FR-105 - an account a merchant created on a customer's behalf (their phone
// number as the password) lands here after login/register until they choose
// their own password. They can still view /my-esims in the meantime, just
// not checkout or move wallet money - see docs/Rules.md -> "Auth".
export default function SetPasswordScreen() {
  const { t } = useAppSettings();
  const { token, clearMustChangePassword } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!currentPassword || !newPassword) {
      setError(t('auth', 'set_password_missing_fields', 'Enter your current password and a new one.'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('auth', 'set_password_too_short', 'Password must be at least 8 characters.'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth', 'set_password_mismatch', 'Passwords do not match.'));
      return;
    }
    if (!token) {
      setError(t('auth', 'set_password_network_error', "Couldn't reach the server. Check your connection and try again."));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await changePassword(token, currentPassword, newPassword);
      clearMustChangePassword();
      router.replace('/');
    } catch (err) {
      if (err instanceof ApiError && typeof err.detail === 'string') {
        setError(err.detail);
      } else {
        setError(t('auth', 'set_password_network_error', "Couldn't reach the server. Check your connection and try again."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('auth', 'set_password_heading', 'Choose your own password')}</Text>

      <TextInput
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder={t('auth', 'set_password_current_placeholder', 'Current password')}
        accessibilityLabel={t('auth', 'set_password_current_placeholder', 'Current password')}
        secureTextEntry
        style={styles.input}
        testID="set-password-current-input"
      />

      <TextInput
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder={t('auth', 'set_password_new_placeholder', 'New password')}
        accessibilityLabel={t('auth', 'set_password_new_placeholder', 'New password')}
        secureTextEntry
        style={styles.input}
        testID="set-password-new-input"
      />

      <TextInput
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder={t('auth', 'set_password_confirm_placeholder', 'Confirm new password')}
        accessibilityLabel={t('auth', 'set_password_confirm_placeholder', 'Confirm new password')}
        secureTextEntry
        style={styles.input}
        testID="set-password-confirm-input"
      />

      {error && (
        <Text style={styles.error} testID="set-password-error">
          {error}
        </Text>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel={t('auth', 'set_password_submit', 'Save password')}
        style={[styles.button, submitting && styles.buttonDisabled]}
        testID="set-password-submit"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{t('auth', 'set_password_submit', 'Save password')}</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => router.push('/my-esims')}
        accessibilityRole="button"
        accessibilityLabel={t('auth', 'set_password_view_esims', 'View my eSIMs instead')}
        style={styles.linkButton}
        testID="set-password-view-esims"
      >
        <Text style={styles.linkText}>{t('auth', 'set_password_view_esims', 'View my eSIMs instead')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 24 },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 24 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  error: { color: '#B42318', marginBottom: 16 },
  button: {
    minHeight: 44,
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linkButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  linkText: { color: '#1D4ED8', fontSize: 14, fontWeight: '600' },
});
