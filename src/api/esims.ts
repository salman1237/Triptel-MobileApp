import { apiFetch } from '../lib/apiClient';

// Matches GET /orders/my-esims's per-item shape (app/api/v1/orders.py's
// list_my_esims()) - a flattened join of ESIMProfile/Order/Product, not
// the nested ESIMProfile type orders.ts's checkout types use.
export type MyEsim = {
  id: string;
  order_no: string;
  product_title: string;
  data_amount_gb: number;
  is_unlimited: boolean;
  validity_days: number;
  iccid: string | null;
  lpa_string: string | null;
  qr_code_data: string | null;
  smdp_address: string | null;
  status: string;
  is_mock_fallback: boolean;
  created_at: string;
  activated_at: string | null;
  expires_at: string | null;
  is_beneficiary: boolean;
};

type RawMyEsim = Omit<MyEsim, 'data_amount_gb'> & { data_amount_gb: string | number };

function toMyEsim(raw: RawMyEsim): MyEsim {
  return { ...raw, data_amount_gb: Number(raw.data_amount_gb) };
}

// Authenticated. FR-402 - every eSIM the account owns, either as buyer or
// as the beneficiary a purchase was made for, newest first.
export async function getMyEsims(token: string): Promise<MyEsim[]> {
  const raw = await apiFetch<RawMyEsim[]>('/orders/my-esims', { token });
  return raw.map(toMyEsim);
}

// Matches app/api/v1/esims.py's serialize() in esim_telemetry_svc.py - one
// shape shared by this screen (FR-403), the public tracking link (FR-501),
// the merchant view, and admin support, so nobody ever debugs against
// different numbers than the customer sees. Kept as its own type (not
// reusing MyEsim) since the fields genuinely differ - this is telemetry
// merged with the order/product, not the flattened list-row shape.
export type EsimStatus = {
  esim_id: string;
  order_no: string;
  purchased_at: string;
  product: { title: string; validity_days: number; is_unlimited: boolean; data_amount_gb: string | null };
  iccid: string | null;
  lpa_string: string | null;
  qr_code_data: string | null;
  smdp_address: string | null;
  matching_id: string | null;
  supplier_reference: string | null;
  status: { label: string; code: number | null; is_installed: boolean; is_activated: boolean; device_model: string | null };
  usage: {
    used_mb: string;
    used_bytes: number;
    formatted: string | null;
    allowance_mb: string | null;
    remaining_mb: string | null;
    remaining_formatted: string | null;
    used_pct: number | null;
    is_unlimited: boolean;
  };
  validity: { days: number; activated_at: string | null; expires_at: string | null; note: string | null };
  share_url: string | null;
  history: { event_name?: string; date?: string; status?: string }[];
  daily_breakdown: { usageDate?: string; enus?: string; mnoname?: string; usage?: string }[];
  telemetry: { fetched_at: string | null; error: string | null; available: boolean };
};

// Authenticated. FR-403 - served from a 5-minute cache, refetched by the
// backend when stale. Never throws for a down supplier - the last snapshot
// comes back with telemetry.error set instead, which the screen shows as a
// stale-data warning rather than failing outright.
export async function getEsimStatus(token: string, esimId: string): Promise<EsimStatus> {
  return apiFetch<EsimStatus>(`/esims/${esimId}/status`, { token });
}

// Authenticated. FR-403's manual refresh - forces the backend to re-poll the
// carrier instead of serving the cached snapshot. Rate-limited server-side
// (per-caller and a short per-eSIM cooldown), so a held-down button can't
// become a load test - this call itself has no client-side throttling.
export async function refreshEsimStatus(token: string, esimId: string): Promise<EsimStatus> {
  return apiFetch<EsimStatus>(`/esims/${esimId}/refresh`, { method: 'POST', token });
}
