import { apiFetch } from '../lib/apiClient';

export type LanguageMeta = {
  code: string;
  name: string;
  native_name: string;
  flag_emoji: string | null;
  is_active: boolean;
  is_rtl: boolean;
};

export type TranslationNamespaces = Record<string, Record<string, string>>;

export type TranslationsResponse = {
  language_code: string;
  namespaces: TranslationNamespaces;
};

// Both public - no Authorization header needed.
export function getLanguages(): Promise<LanguageMeta[]> {
  return apiFetch<LanguageMeta[]>('/settings/languages');
}

export function getTranslations(lang: string): Promise<TranslationsResponse> {
  return apiFetch<TranslationsResponse>(`/settings/translations/${encodeURIComponent(lang)}`);
}

export type CurrencyRate = {
  currency_code: string;
  rate_to_base: number;
  is_manual_override: boolean;
  manual_rate: number | null;
  source: string;
};

export function getRates(): Promise<CurrencyRate[]> {
  return apiFetch<CurrencyRate[]>('/settings/rates');
}

export type LegalDocument = {
  slug: string;
  title: string;
  body: string;
  updated_at: string | null;
};

// Public. 404s if the slug isn't one of the six LEGAL_TITLES keys on the backend.
export function getLegalDocument(slug: string): Promise<LegalDocument> {
  return apiFetch<LegalDocument>(`/settings/legal/${encodeURIComponent(slug)}`);
}

// Matches PaymentMethodConfig (app/schemas/settings.py) - one manual-deposit
// account (bank/mobile wallet/QR) an admin has configured and activated.
export type PaymentMethod = {
  id: string | null;
  name: string;
  kind: 'mobile' | 'bank' | 'qr';
  account_name: string | null;
  account_number: string | null;
  branch: string | null;
  instructions: string | null;
  is_active: boolean;
};

// Only the fields FR-603 (manual deposit) and FR-1203 (maintenance mode)
// need from PublicSettingsResponse - add more as later FRs need them, not
// speculatively.
export type PublicSettings = {
  bangla_qr_image: string | null;
  payment_methods: PaymentMethod[];
  platform_name: string;
  maintenance_mode: boolean;
};

// Public.
export function getPublicSettings(): Promise<PublicSettings> {
  return apiFetch<PublicSettings>('/settings/public');
}
