import { apiFetch } from '../lib/apiClient';

// Matches GET /catalog/countries's CountryResponse (app/schemas/catalog.py) -
// slug is server-computed from name_en, used to build /explore/<slug>.
export type Country = {
  id: number;
  iso2: string;
  iso3: string | null;
  name_en: string;
  name_bn: string | null;
  flag_url: string | null;
  region: string | null;
  is_popular: boolean;
  popular_order: number;
  is_active: boolean;
  slug: string;
};

export type GetCountriesParams = {
  search?: string;
  popularOnly?: boolean;
};

// Public - no Authorization header needed.
export function getCountries(params: GetCountriesParams = {}): Promise<Country[]> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.popularOnly) query.set('popular_only', 'true');
  const qs = query.toString();
  return apiFetch<Country[]>(`/catalog/countries${qs ? `?${qs}` : ''}`);
}
