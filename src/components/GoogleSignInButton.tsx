import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  GoogleSignin,
  GoogleSigninButton,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useRouter } from 'expo-router';
import { getMe, googleLogin } from '../api/auth';
import { ApiError } from '../lib/apiClient';
import { useAuth } from '../state/AuthContext';
import { useAppSettings } from '../state/AppSettingsContext';

// Same Google Cloud project/OAuth client as the web app's Google Sign-In -
// the backend verifies every platform's ID token against this one
// GOOGLE_CLIENT_ID (app/core/config.py). Android resolves automatically via
// the app's package name + signing cert fingerprint registered against this
// client in Google Cloud Console - see DECISIONS.md.
const WEB_CLIENT_ID = '1095507553767-hkuh44db04q1lvrnptill6frtckcb42t.apps.googleusercontent.com';

GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });

export default function GoogleSignIn() {
  const { t } = useAppSettings();
  const { signIn } = useAuth();
  const router = useRouter();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePress() {
    setBusy(true);
    setError(null);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response) || !response.data.idToken) {
        return;
      }
      const token = await googleLogin(response.data.idToken);
      const user = await getMe(token.access_token);
      await signIn(token.access_token, user, token.must_change_password);
      // must_change_password blocks checkout/wallet, not viewing eSIMs -
      // see docs/Rules.md -> "Auth". Google accounts get a random unusable
      // password server-side, so this only applies to an existing
      // email/password account that later links Google.
      if (token.must_change_password) {
        router.replace('/auth/set-password');
      } else {
        router.replace('/');
      }
    } catch (err) {
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }
      if (err instanceof ApiError && typeof err.detail === 'string') {
        setError(err.detail);
      } else {
        setError(t('auth', 'google_signin_failed', "Google sign-in failed. Please try again."));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container} testID="google-signin">
      <GoogleSigninButton
        size={GoogleSigninButton.Size.Wide}
        color={GoogleSigninButton.Color.Light}
        onPress={handlePress}
        disabled={busy}
        testID="google-signin-button"
      />
      {busy && <ActivityIndicator testID="google-signin-loading" style={styles.spinner} />}
      {error && (
        <Text style={styles.error} testID="google-signin-error">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginBottom: 16 },
  spinner: { marginTop: 8 },
  error: { color: '#B42318', fontSize: 12, marginTop: 8, textAlign: 'center' },
});
