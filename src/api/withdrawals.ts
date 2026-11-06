import { apiFetch } from '../lib/apiClient';

// Matches the dict shape _account_json() (app/api/v1/withdrawals.py) returns -
// no Pydantic response_model on that router, so these are the raw field
// names/types the backend actually sends.
export type PayoutAccount = {
  id: string;
  account_type: 'BANK' | 'MOBILE';
  bank_name: string;
  holder_name: string;
  account_number: string;
  branch_name: string | null;
  routing_number: string | null;
  is_default: boolean;
};

export type NewPayoutAccount = {
  account_type: 'BANK' | 'MOBILE';
  bank_name: string;
  holder_name: string;
  account_number: string;
  branch_name?: string | null;
  routing_number?: string | null;
  is_default?: boolean;
};

// FR-701 - up to 5 payout accounts. The backend enforces the limit and
// duplicate-account check too (400s); this is for showing the right UI
// before the user even tries, not the source of truth.
export const MAX_PAYOUT_ACCOUNTS = 5;

export function getPayoutAccounts(token: string): Promise<PayoutAccount[]> {
  return apiFetch<PayoutAccount[]>('/withdrawals/accounts', { token });
}

export function addPayoutAccount(token: string, account: NewPayoutAccount): Promise<PayoutAccount> {
  return apiFetch<PayoutAccount>('/withdrawals/accounts', { method: 'POST', token, body: account });
}

export function setDefaultPayoutAccount(token: string, accountId: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/withdrawals/accounts/${encodeURIComponent(accountId)}/default`, {
    method: 'POST',
    token,
  });
}

export function deletePayoutAccount(token: string, accountId: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/withdrawals/accounts/${encodeURIComponent(accountId)}`, {
    method: 'DELETE',
    token,
  });
}
