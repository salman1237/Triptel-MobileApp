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

// Matches the dict GET /withdrawals/config returns (app/api/v1/withdrawals.py).
// Amounts come back as decimal strings - converted to numbers here, once,
// same as every other Decimal-as-JSON-string field in this app.
export type WithdrawalConfig = {
  min_amount: number;
  max_amount: number;
  fee_type: 'flat' | 'percent';
  fee_value: number;
  payout_currency: string;
  processing_time: string;
  is_enabled: boolean;
  base_currency: string;
  note_categories: string[];
  balance: number;
  can_withdraw: boolean;
  blockers: string[];
  kyc_verified: boolean;
  kyc_status: string | null;
  account_count: number;
};

type RawWithdrawalConfig = Omit<WithdrawalConfig, 'min_amount' | 'max_amount' | 'fee_value' | 'balance'> & {
  min_amount: string | number;
  max_amount: string | number;
  fee_value: string | number;
  balance: string | number;
};

// FR-702 - eligibility + live limits, fetched before the form is even
// shown, so the screen can explain itself rather than fail on submit.
export async function getWithdrawalConfig(token: string): Promise<WithdrawalConfig> {
  const raw = await apiFetch<RawWithdrawalConfig>('/withdrawals/config', { token });
  return {
    ...raw,
    min_amount: Number(raw.min_amount),
    max_amount: Number(raw.max_amount),
    fee_value: Number(raw.fee_value),
    balance: Number(raw.balance),
  };
}

export type NewWithdrawal = {
  amount: number;
  bankAccountId: string;
  noteCategory?: string;
  note?: string;
};

// Matches withdrawal_svc.serialize() - only the fields FR-702 itself needs
// to confirm a submission; FR-703 (withdrawal history) types the rest.
export type WithdrawalRequestResult = {
  id: string;
  reference_no: string;
  amount: string;
  fee_amount: string;
  net_amount: string;
  status: 'PENDING' | 'PAID' | 'REJECTED' | 'CANCELLED';
};

export function createWithdrawal(token: string, params: NewWithdrawal): Promise<WithdrawalRequestResult> {
  return apiFetch<WithdrawalRequestResult>('/withdrawals', {
    method: 'POST',
    token,
    body: {
      amount: params.amount,
      bank_account_id: params.bankAccountId,
      note_category: params.noteCategory,
      note: params.note,
    },
  });
}
