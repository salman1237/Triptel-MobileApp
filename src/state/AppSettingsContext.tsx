import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLanguages, getTranslations } from '../api/settings';
import type { LanguageMeta, TranslationNamespaces } from '../api/settings';

// A UI preference, not a credential - AsyncStorage, not SecureStore.
// See docs/Architecture.md -> "Secure storage".
const LANG_STORAGE_KEY = 'triptel_lang';
const DEFAULT_LANG = 'en';

type AppSettingsContextValue = {
  lang: string;
  setLang: (lang: string) => void;
  languages: LanguageMeta[];
  isRTL: boolean;
  // Same (namespace, key, fallback) shape as the web's AppSettingsContext -
  // see docs/Architecture.md -> "Currency & i18n". Currency conversion
  // (convert/convertTo/formatPrice) isn't ported yet - add it with the first
  // screen that shows money, see DECISIONS.md.
  t: (namespace: string, key: string, fallback?: string) => string;
};

const AppSettingsContext = createContext<AppSettingsContextValue | undefined>(undefined);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);
  const [languages, setLanguages] = useState<LanguageMeta[]>([]);
  const [translations, setTranslations] = useState<TranslationNamespaces>({});

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(LANG_STORAGE_KEY).then((saved) => {
      if (!cancelled && saved) setLangState(saved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getLanguages()
      .then((data) => {
        if (!cancelled) setLanguages(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getTranslations(lang)
      .then((data) => {
        if (!cancelled) setTranslations(data.namespaces || {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const setLang = useCallback((code: string) => {
    setLangState(code);
    AsyncStorage.setItem(LANG_STORAGE_KEY, code).catch(() => {});
  }, []);

  const t = useCallback(
    (namespace: string, key: string, fallback?: string) => translations[namespace]?.[key] ?? fallback ?? key,
    [translations]
  );

  const activeLanguage = languages.find((l) => l.code === lang);
  const isRTL = activeLanguage ? activeLanguage.is_rtl : false;

  const value = useMemo<AppSettingsContextValue>(
    () => ({ lang, setLang, languages, isRTL, t }),
    [lang, setLang, languages, isRTL, t]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within an AppSettingsProvider');
  return ctx;
}
