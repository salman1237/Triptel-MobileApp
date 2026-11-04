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
