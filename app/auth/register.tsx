import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { register, getMe } from '../../src/api/auth';
import { ApiError } from '../../src/lib/apiClient';
import { useAuth } from '../../src/state/AuthContext';
import { useAppSettings } from '../../src/state/AppSettingsContext';

export default function RegisterScreen() {
  const { t } = useAppSettings();
  const { signIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email.trim() || !username.trim() || !password) {
      setError(t('auth', 'register_missing_fields', 'Email, username, and password are required.'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const token = await register({
        email: email.trim(),
        username: username.trim(),
        password,
        phone: phone.trim() || undefined,
        referral_code: referralCode.trim() || undefined,
      });
      const user = await getMe(token.access_token);
      await signIn(token.access_token, user, token.must_change_password);
      if (token.must_change_password) {
        router.replace('/auth/set-password');
      } else {
        router.replace('/');
      }
    } catch (err) {
      if (err instanceof ApiError && typeof err.detail === 'string') {
        setError(err.detail);
      } else {
        setError(t('auth', 'register_network_error', "Couldn't reach the server. Check your connection and try again."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('auth', 'register_heading', 'Create account')}</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={t('auth', 'register_email_placeholder', 'Email')}
        accessibilityLabel={t('auth', 'register_email_placeholder', 'Email')}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        style={styles.input}
        testID="register-email-input"
      />

      <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder={t('auth', 'register_username_placeholder', 'Username')}
        accessibilityLabel={t('auth', 'register_username_placeholder', 'Username')}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        testID="register-username-input"
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder={t('auth', 'register_password_placeholder', 'Password')}
        accessibilityLabel={t('auth', 'register_password_placeholder', 'Password')}
        secureTextEntry
        style={styles.input}
        testID="register-password-input"
      />

      <TextInput
        value={phone}
        onChangeText={setPhone}
        placeholder={t('auth', 'register_phone_placeholder', 'Phone (optional)')}
        accessibilityLabel={t('auth', 'register_phone_placeholder', 'Phone (optional)')}
        keyboardType="phone-pad"
        style={styles.input}
        testID="register-phone-input"
      />

      <TextInput
        value={referralCode}
        onChangeText={setReferralCode}
        placeholder={t('auth', 'register_referral_placeholder', 'Referral code (optional)')}
        accessibilityLabel={t('auth', 'register_referral_placeholder', 'Referral code (optional)')}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        testID="register-referral-input"
      />

      {error && (
        <Text style={styles.error} testID="register-error">
          {error}
        </Text>
      )}

      <Pressable
        onPress={handleSubmit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel={t('auth', 'register_submit', 'Create account')}
        style={[styles.button, submitting && styles.buttonDisabled]}
        testID="register-submit"
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{t('auth', 'register_submit', 'Create account')}</Text>
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
