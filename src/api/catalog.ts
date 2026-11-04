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

// Matches ProductResponse (app/schemas/catalog.py). retail_price is EUR -
// see docs/Rules.md -> "Money" - convert for display via useAppSettings().
export type Product = {
  id: string;
  country_id: number;
  title_en: string;
  title_bn: string | null;
  data_amount_gb: number;
  validity_days: number;
  retail_price: number;
  currency: string;
  is_unlimited: boolean;
  is_active: boolean;
  is_featured: boolean;
  coverage_networks: string | null;
};

export type Destination = {
  country: Country;
  products: Product[];
};

// Public. One call for the whole country landing screen (FR-203) - country
// info + its package list together. Accepts an ISO2 code or the name slug.
export function getDestination(slug: string): Promise<Destination> {
  return apiFetch<Destination>(`/catalog/destinations/${encodeURIComponent(slug)}`);
}
