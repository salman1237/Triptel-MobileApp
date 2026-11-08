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
