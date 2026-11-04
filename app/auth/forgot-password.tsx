import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { forgotPassword } from '../../src/api/auth';
import { useAppSettings } from '../../src/state/AppSettingsContext';

export default function ForgotPasswordScreen() {
  const { t } = useAppSettings();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Always the same message on success, whether or not the email is
  // registered - see src/api/auth.ts's forgotPassword(). Not user error.
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) {
      setError(t('auth', 'forgot_password_missing_email', 'Enter your email address.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch {
      setError(t('auth', 'forgot_password_network_error', "Couldn't reach the server. Check your connection and try again."));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>{t('auth', 'forgot_password_heading', 'Reset your password')}</Text>
        <Text testID="forgot-password-sent">
          {t(
            'auth',
            'forgot_password_sent_message',
            'If that email is registered, a reset link has been sent.'
          )}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('auth', 'forgot_password_heading', 'Reset your password')}</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth', 'forgot_password_email_placeholder', 'Email')}
        accessibilityLabel={t('auth', 'forgot_password_email_placeholder', 'Email')}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        style={styles.input}
        testID="forgot-password-email-input"
      />

      {error && (
        <Text style={styles.error} testID="forgot-password-error">
          {error}
        </Text>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel={t('auth', 'forgot_password_submit', 'Send reset link')}
        style={[styles.button, submitting && styles.buttonDisabled]}
        testID="forgot-password-submit"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{t('auth', 'forgot_password_submit', 'Send reset link')}</Text>
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
