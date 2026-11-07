import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLanguages, getPublicSettings, getRates, getTranslations } from '../api/settings';
import type { CurrencyRate, LanguageMeta, PublicSettings, TranslationNamespaces } from '../api/settings';

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

// FR-1302 - the currency switcher's option list. Matches the web's
// hardcoded CURRENCIES in src/components/Header.tsx exactly, not every
// key CURRENCY_SYMBOLS happens to know a symbol for - same reasoning as
// docs/Rules.md's "Money" section: parity with the web app.
export const CURRENCIES = ['EUR', 'USD', 'BDT', 'GBP', 'AED', 'SAR'];

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
  publicSettings: PublicSettings | null;
};

const AppSettingsContext = createContext<AppSettingsContextValue | undefined>(undefined);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);
  const [languages, setLanguages] = useState<LanguageMeta[]>([]);
  const [translations, setTranslations] = useState<TranslationNamespaces>({});
  const [currency, setCurrencyState] = useState(DEFAULT_CURRENCY);
  const [rates, setRates] = useState<Record<string, number>>({ EUR: 1 });
  const [publicSettings, setPublicSettings] = useState<PublicSettings | null>(null);

  // FR-1202 - the app shell (money, translated strings) must not render
  // until these have at least been attempted once, so a customer never
  // sees a flash of raw translation keys or the wrong currency symbol
  // before the real settings arrive. Each flag flips on success *or*
  // failure (via .catch below) - a single slow/failed endpoint must not
  // block the app forever, only until it has actually responded.
  const [languagesLoaded, setLanguagesLoaded] = useState(false);
  const [translationsLoaded, setTranslationsLoaded] = useState(false);
  const [ratesLoaded, setRatesLoaded] = useState(false);
  const [publicSettingsLoaded, setPublicSettingsLoaded] = useState(false);
  const isReady = languagesLoaded && translationsLoaded && ratesLoaded && publicSettingsLoaded;

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
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLanguagesLoaded(true);
      });
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
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTranslationsLoaded(true);
      });
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
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRatesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPublicSettings()
      .then((data) => {
        if (!cancelled) setPublicSettings(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPublicSettingsLoaded(true);
      });
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
    () => ({
      lang,
      setLang,
      languages,
      isRTL,
      t,
      currency,
      setCurrency,
      convert,
      convertTo,
      formatPrice,
      publicSettings,
    }),
    [lang, setLang, languages, isRTL, t, currency, setCurrency, convert, convertTo, formatPrice, publicSettings]
  );

  // FR-1202 - don't render money or translated strings until the bootstrap
  // fetches have all settled at least once.
  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} testID="app-settings-bootstrap-loading">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
}

export function useAppSettings(): AppSettingsContextValue {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings must be used within an AppSettingsProvider');
  return ctx;
}
