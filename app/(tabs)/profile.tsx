import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { updatePreferences } from '../../src/api/auth';
import { getMyWallets } from '../../src/api/wallets';
import { ApiError } from '../../src/lib/apiClient';
import { useAuth } from '../../src/state/AuthContext';
import { CURRENCIES, useAppSettings } from '../../src/state/AppSettingsContext';

export default function ProfileScreen() {
  const { t, formatPrice, currency, setCurrency } = useAppSettings();
  const { user, token, signOut, updateUser } = useAuth();
  const router = useRouter();

  // FR-1302 - switching currency applies immediately (setCurrency already
  // persists to AsyncStorage for next launch) and, for a signed-in account,
  // best-effort saves it server-side too, so it follows them to the web app
  // and other devices - same pattern as the web's AppSettingsContext
  // setCurrency. A failed save must not undo the switch or interrupt the
  // user, so it's silently swallowed, same as the web.
  function handleSelectCurrency(code: string) {
    setCurrency(code);
    if (token) updatePreferences(token, { preferred_currency: code }).catch(() => {});
  }

  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const walletsQuery = useQuery({
    queryKey: ['wallets', 'my-wallets'],
    queryFn: () => getMyWallets(token as string),
    enabled: Boolean(token),
  });

  const spendableBalance = (walletsQuery.data ?? [])
    .filter((w) => (w.wallet_type === 'DEFAULT' || w.wallet_type === 'REWARD') && !w.is_frozen)
    .reduce((sum, w) => sum + w.balance, 0);

  async function handleSavePhone() {
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const result = await updatePreferences(token, { phone: phone.trim() });
      updateUser({ phone: result.phone });
      setSaved(true);
    } catch (err) {
      setSaveError(
        err instanceof ApiError && typeof err.detail === 'string'
          ? err.detail
          : t('profile', 'phone_save_network_error', "Couldn't save your phone number. Try again.")
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/');
  }

  if (!user) {
    return (
      <View style={styles.container}>
        <Text testID="profile-not-signed-in">{t('profile', 'not_signed_in', 'Sign in to see your profile.')}</Text>
      </View>
    );
  }

  const initial = (user.full_name || user.username || '?').charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatar} accessibilityLabel={user.username} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarFallbackText}>{initial}</Text>
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.name} testID="profile-name">
            {user.full_name || user.username}
          </Text>
          <Text style={styles.username}>@{user.username}</Text>
          <View style={styles.badgeRow}>
            <Text style={styles.roleBadge} testID="profile-role">
              {user.role}
            </Text>
            {user.has_google && (
              <Text style={styles.googleBadge} testID="profile-google-badge">
                {t('profile', 'linked_google', 'Linked with Google')}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile', 'email_label', 'Email')}</Text>
        <View style={styles.emailRow}>
          <Text style={styles.emailText} testID="profile-email">
            {user.email}
          </Text>
          <Text
            style={user.email_verified ? styles.verifiedBadge : styles.unverifiedBadge}
            testID="profile-email-verified-badge"
          >
            {user.email_verified
              ? t('profile', 'email_verified', 'Verified')
              : t('profile', 'email_not_verified', 'Not verified')}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile', 'wallet_label', 'Wallet balance')}</Text>
        {walletsQuery.isLoading ? (
          <ActivityIndicator testID="profile-wallet-loading" />
        ) : walletsQuery.isError ? (
          <Text style={styles.error} testID="profile-wallet-error">
            {t('profile', 'wallet_load_error', "Couldn't load your wallet balance.")}
          </Text>
        ) : (
          <Text style={styles.walletBalance} testID="profile-wallet-balance">
            {formatPrice(spendableBalance)}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile', 'currency_label', 'Currency')}</Text>
        <View style={styles.currencyRow} testID="profile-currency-switcher">
          {CURRENCIES.map((code) => {
            const selected = code === currency;
            return (
              <Pressable
                key={code}
                onPress={() => handleSelectCurrency(code)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.currencyChip, selected && styles.currencyChipSelected]}
                testID={`profile-currency-${code}`}
              >
                <Text style={[styles.currencyChipText, selected && styles.currencyChipTextSelected]}>{code}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('profile', 'phone_label', 'Phone / WhatsApp')}</Text>
        <TextInput
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            setSaved(false);
          }}
          placeholder={t('profile', 'phone_placeholder', 'Phone number (optional)')}
          accessibilityLabel={t('profile', 'phone_placeholder', 'Phone number (optional)')}
          keyboardType="phone-pad"
          style={styles.input}
          testID="profile-phone-input"
        />
        {saveError && (
          <Text style={styles.error} testID="profile-phone-error">
            {saveError}
          </Text>
        )}
        {saved && !saveError && (
          <Text style={styles.savedLabel} testID="profile-phone-saved">
            {t('profile', 'phone_saved', 'Saved')}
          </Text>
        )}
        <Pressable
          onPress={handleSavePhone}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={t('profile', 'phone_save', 'Save')}
          style={[styles.saveButton, saving && styles.buttonDisabled]}
          testID="profile-phone-save"
        >
          {saving ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>{t('profile', 'phone_save', 'Save')}</Text>
          )}
        </Pressable>
      </View>

      <Pressable
        onPress={handleSignOut}
        accessibilityRole="button"
        accessibilityLabel={t('profile', 'sign_out', 'Sign out')}
        style={styles.signOutButton}
        testID="profile-sign-out"
      >
        <Text style={styles.signOutButtonText}>{t('profile', 'sign_out', 'Sign out')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 24, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  avatar: { width: 64, height: 64, borderRadius: 32, marginEnd: 16 },
  avatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginEnd: 16,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { fontSize: 24, fontWeight: '700', color: '#1D4ED8' },
  headerText: { flex: 1 },
  name: { fontSize: 20, fontWeight: '700' },
  username: { fontSize: 13, color: '#667085', marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  roleBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#344054',
    backgroundColor: '#F2F4F7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  googleBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#667085', marginBottom: 6 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emailText: { fontSize: 15 },
  verifiedBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#027A48',
    backgroundColor: '#ECFDF3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unverifiedBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B42318',
    backgroundColor: '#FEF3F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  walletBalance: { fontSize: 20, fontWeight: '700' },
  currencyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  currencyChip: {
    minHeight: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 18,
  },
  currencyChipSelected: { backgroundColor: '#1D4ED8', borderColor: '#1D4ED8' },
  currencyChipText: { fontSize: 13, fontWeight: '700', color: '#344054' },
  currencyChipTextSelected: { color: '#fff' },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  error: { color: '#B42318', fontSize: 12, marginBottom: 8 },
  savedLabel: { color: '#027A48', fontSize: 12, marginBottom: 8, fontWeight: '600' },
  saveButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  signOutButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B42318',
    marginTop: 8,
  },
  signOutButtonText: { color: '#B42318', fontSize: 14, fontWeight: '700' },
});
