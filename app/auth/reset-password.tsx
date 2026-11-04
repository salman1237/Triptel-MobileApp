import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { resetPassword } from '../../src/api/auth';
import { ApiError } from '../../src/lib/apiClient';
import { useAppSettings } from '../../src/state/AppSettingsContext';

export default function ResetPasswordScreen() {
  const { t } = useAppSettings();
  const router = useRouter();
  // The reset link from email opens in the system browser, not this screen
  // (no deep-link interception yet - see CLAUDE.md -> "Known Gaps"), but a
  // ?token= param is honored here if this screen is ever reached with one.
  const params = useLocalSearchParams<{ token?: string }>();

  const [token, setToken] = useState(params.token ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!token.trim() || !newPassword) {
      setError(t('auth', 'reset_password_missing_fields', 'Enter the reset token and a new password.'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('auth', 'reset_password_too_short', 'Password must be at least 8 characters.'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth', 'reset_password_mismatch', 'Passwords do not match.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(token.trim(), newPassword);
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && typeof err.detail === 'string') {
        setError(err.detail);
      } else {
        setError(t('auth', 'reset_password_network_error', "Couldn't reach the server. Check your connection and try again."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>{t('auth', 'reset_password_heading', 'Set a new password')}</Text>
        <Text testID="reset-password-done">
          {t('auth', 'reset_password_done_message', 'Password has been reset. You can now log in.')}
        </Text>
        <Pressable
          onPress={() => router.replace('/auth/login')}
          accessibilityRole="button"
          accessibilityLabel={t('auth', 'reset_password_go_to_login', 'Go to login')}
          style={styles.button}
          testID="reset-password-go-to-login"
        >
          <Text style={styles.buttonText}>{t('auth', 'reset_password_go_to_login', 'Go to login')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('auth', 'reset_password_heading', 'Set a new password')}</Text>

      <TextInput
        value={token}
        onChangeText={setToken}
        placeholder={t('auth', 'reset_password_token_placeholder', 'Reset token')}
        accessibilityLabel={t('auth', 'reset_password_token_placeholder', 'Reset token')}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        testID="reset-password-token-input"
      />

      <TextInput
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder={t('auth', 'reset_password_new_placeholder', 'New password')}
        accessibilityLabel={t('auth', 'reset_password_new_placeholder', 'New password')}
        secureTextEntry
        style={styles.input}
        testID="reset-password-new-input"
      />

      <TextInput
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder={t('auth', 'reset_password_confirm_placeholder', 'Confirm new password')}
        accessibilityLabel={t('auth', 'reset_password_confirm_placeholder', 'Confirm new password')}
        secureTextEntry
        style={styles.input}
        testID="reset-password-confirm-input"
      />

      {error && (
        <Text style={styles.error} testID="reset-password-error">
          {error}
        </Text>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel={t('auth', 'reset_password_submit', 'Reset password')}
        style={[styles.button, submitting && styles.buttonDisabled]}
        testID="reset-password-submit"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{t('auth', 'reset_password_submit', 'Reset password')}</Text>
        )}
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
});
