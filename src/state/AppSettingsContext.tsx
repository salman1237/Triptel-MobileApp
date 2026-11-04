import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLanguages, getRates, getTranslations } from '../api/settings';
import type { CurrencyRate, LanguageMeta, TranslationNamespaces } from '../api/settings';

// A UI preference, not a credential - AsyncStorage, not SecureStore.
// See docs/Architecture.md -> "Secure storage".
const LANG_STORAGE_KEY = 'triptel_lang';
const CURRENCY_STORAGE_KEY = 'triptel_currency';
const DEFAULT_LANG = 'en';
// The platform's books are kept in EUR, but the home market doesn't think in
// euros - same reasoning as the web's AppSettingsContext
// (D:\eSim\frontend\src\lib\AppSettingsContext.tsx). A signed-in account's
// preferred_currency overrides this - see app/_layout.tsx's currency sync.
const DEFAULT_CURRENCY = 'BDT';

// Matches the web's AppSettingsContext exactly - see docs/Rules.md -> "Money":
// a user switching between the web app and this app must never see a
// different number for the same wallet balance.
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  BDT: '৳',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  SAR: '﷼',
  THB: '฿',
  SGD: 'S$',
  JPY: '¥',
  MYR: 'RM',
  INR: '₹',
};
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY']);

type AppSettingsContextValue = {
  lang: string;
  setLang: (lang: string) => void;
  languages: LanguageMeta[];
  isRTL: boolean;
  // Same (namespace, key, fallback) shape as the web's AppSettingsContext -
  // see docs/Architecture.md -> "Currency & i18n".
  t: (namespace: string, key: string, fallback?: string) => string;
  currency: string;
  setCurrency: (currency: string) => void;
  // Every amount at the API boundary is EUR - see docs/Rules.md -> "Money".
  // These convert for display only; a converted amount is never sent back
  // to the API or persisted as authoritative.
  convert: (amountEur: number) => number;
  convertTo: (amountEur: number, targetCurrency: string) => number;
  formatPrice: (amountEur: number) => string;
};

const AppSettingsContext = createContext<AppSettingsContextValue | undefined>(undefined);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);
  const [languages, setLanguages] = useState<LanguageMeta[]>([]);
  const [translations, setTranslations] = useState<TranslationNamespaces>({});
  const [currency, setCurrencyState] = useState(DEFAULT_CURRENCY);
  const [rates, setRates] = useState<Record<string, number>>({ EUR: 1 });

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
    AsyncStorage.getItem(CURRENCY_STORAGE_KEY).then((saved) => {
      if (!cancelled && saved) setCurrencyState(saved);
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

  useEffect(() => {
    let cancelled = false;
    getRates()
      .then((rows: CurrencyRate[]) => {
        if (cancelled) return;
        const map: Record<string, number> = { EUR: 1 };
        for (const r of rows) {
          const rate = r.is_manual_override && r.manual_rate != null ? r.manual_rate : r.rate_to_base;
          if (!Number.isNaN(rate)) map[r.currency_code] = rate;
        }
        setRates(map);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setLang = useCallback((code: string) => {
    setLangState(code);
    AsyncStorage.setItem(LANG_STORAGE_KEY, code).catch(() => {});
  }, []);

  const setCurrency = useCallback((code: string) => {
    setCurrencyState(code);
    AsyncStorage.setItem(CURRENCY_STORAGE_KEY, code).catch(() => {});
  }, []);

  const t = useCallback(
    (namespace: string, key: string, fallback?: string) => translations[namespace]?.[key] ?? fallback ?? key,
    [translations]
  );

  const convertTo = useCallback(
    (amountEur: number, targetCurrency: string) => amountEur * (rates[targetCurrency] ?? 1),
    [rates]
  );
  const convert = useCallback((amountEur: number) => convertTo(amountEur, currency), [convertTo, currency]);

  const formatPrice = useCallback(
    (amountEur: number) => {
      const converted = convert(amountEur);
      const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
      const decimals = ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2;
      return `${symbol}${converted.toFixed(decimals)}`;
    },
    [convert, currency]
  );

  const activeLanguage = languages.find((l) => l.code === lang);
  const isRTL = activeLanguage ? activeLanguage.is_rtl : false;

  const value = useMemo<AppSettingsContextValue>(
    () => ({ lang, setLang, languages, isRTL, t, currency, setCurrency, convert, convertTo, formatPrice }),
    [lang, setLang, languages, isRTL, t, currency, setCurrency, convert, convertTo, formatPrice]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within an AppSettingsProvider');
  return ctx;
}
