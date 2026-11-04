import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { login, getMe } from '../../src/api/auth';
import { ApiError } from '../../src/lib/apiClient';
import { useAuth } from '../../src/state/AuthContext';
import { useAppSettings } from '../../src/state/AppSettingsContext';

export default function LoginScreen() {
  const { t } = useAppSettings();
  const { signIn } = useAuth();
  const router = useRouter();

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!emailOrUsername.trim() || !password) {
      setError(t('auth', 'login_missing_fields', 'Enter your email or username and password.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = await login({ email: emailOrUsername.trim(), password });
      const user = await getMe(token.access_token);
      await signIn(token.access_token, user);
      // must_change_password blocks checkout/wallet, not viewing eSIMs - see
      // docs/Rules.md -> "Auth". app/auth/set-password.tsx is FR-105, not
      // built yet; this is the route it will live at.
      if (token.must_change_password) {
        router.replace('/auth/set-password');
      } else {
        router.replace('/');
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setError(
          typeof err.detail === 'string'
            ? err.detail
            : t('auth', 'login_invalid_credentials', 'Invalid email/username or password.')
        );
      } else {
        setError(t('auth', 'login_network_error', "Couldn't reach the server. Check your connection and try again."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('auth', 'login_heading', 'Log in')}</Text>

      <TextInput
        value={emailOrUsername}
        onChangeText={setEmailOrUsername}
        placeholder={t('auth', 'login_email_placeholder', 'Email or username')}
        accessibilityLabel={t('auth', 'login_email_placeholder', 'Email or username')}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        testID="login-email-input"
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth', 'login_password_placeholder', 'Password')}
        accessibilityLabel={t('auth', 'login_password_placeholder', 'Password')}
        secureTextEntry
        style={styles.input}
        testID="login-password-input"
      />

      {error && (
        <Text style={styles.error} testID="login-error">
          {error}
        </Text>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel={t('auth', 'login_submit', 'Log in')}
        style={[styles.button, submitting && styles.buttonDisabled]}
        testID="login-submit"
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('auth', 'login_submit', 'Log in')}</Text>}
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
