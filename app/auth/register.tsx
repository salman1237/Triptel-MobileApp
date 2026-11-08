import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { register, getMe } from '../../src/api/auth';
import { validateReferralCode } from '../../src/api/referrals';
import type { ReferralValidation } from '../../src/api/referrals';
import { ApiError } from '../../src/lib/apiClient';
import { useAuth } from '../../src/state/AuthContext';
import { useAppSettings } from '../../src/state/AppSettingsContext';
import { postAuthRoute } from '../../src/state/pendingPurchase';
import GoogleSignIn from '../../src/components/GoogleSignInButton';

// FR-803 - a shared referral link arrives as .../auth/register?ref=CODE
// (expo-router surfaces it as a local search param regardless of whether
// it came in via the app's own triptel:// scheme or a universal link),
// so the field fills itself and the invite is confirmed by name before
// anyone types anything. Ported from the web's src/app/auth/register/page.tsx.
export default function RegisterScreen() {
  const { t } = useAppSettings();
  const { signIn } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [referralCode, setReferralCode] = useState(() => (params.ref ? params.ref.toUpperCase() : ''));
  const [referral, setReferral] = useState<ReferralValidation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = referralCode.trim();
    const handle = setTimeout(() => {
      if (code.length < 3) {
        setReferral(null);
        return;
      }
      validateReferralCode(code)
        .then(setReferral)
        .catch(() => setReferral(null));
    }, 350);
    return () => clearTimeout(handle);
  }, [referralCode]);

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
        // FR-106 - lands back on the country page with a purchase in
        // flight, not home, if that's why they were sent here.
        router.replace(postAuthRoute());
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
        onChangeText={(v) => setReferralCode(v.toUpperCase())}
        placeholder={t('auth', 'register_referral_placeholder', 'Referral code (optional)')}
        accessibilityLabel={t('auth', 'register_referral_placeholder', 'Referral code (optional)')}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={16}
        style={styles.input}
        testID="register-referral-input"
      />

      {referral?.valid ? (
        <Text style={styles.referralValid} testID="register-referral-valid">
          {t('auth', 'register_referral_invited_by', 'Invited by')} {referral.referrer_username}
          {Number(referral.joining_reward) > 0
            ? ` — €${Number(referral.joining_reward).toFixed(2)} ${t('auth', 'register_referral_reward_suffix', 'reward credit on sign-up')}`
            : ''}
        </Text>
      ) : referralCode.trim().length >= 3 && referral && !referral.valid ? (
        <Text style={styles.referralUnknown} testID="register-referral-unknown">
          {t(
            'auth',
            'register_referral_unknown',
            "We don't recognise that code — you can still sign up without it."
          )}
        </Text>
      ) : null}

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

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('auth', 'or_divider', 'or')}</Text>
        <View style={styles.dividerLine} />
      </View>

      <GoogleSignIn />
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
  referralValid: { color: '#059669', fontSize: 11, fontWeight: '700', marginTop: -10, marginBottom: 16 },
  referralUnknown: { color: '#64748B', fontSize: 11, marginTop: -10, marginBottom: 16 },
  button: {
    minHeight: 44,
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { marginHorizontal: 12, fontSize: 12, color: '#94A3B8', textTransform: 'uppercase' },
});
