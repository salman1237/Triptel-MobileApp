import { apiFetch } from '../lib/apiClient';

// Matches WalletResponse (app/schemas/wallet.py).
export type Wallet = {
  id: string;
  wallet_type: 'DEFAULT' | 'REWARD' | 'COMMISSION';
  balance: number;
  currency: string;
  is_frozen: boolean;
};

// The raw response has `balance` as Decimal, which FastAPI/Pydantic
// serializes to JSON as a string (e.g. "0.00"), not a number - same as
// /discounts/preview's amounts. Parsed here, once, so every caller gets a
// real number instead of silently summing/comparing strings into NaN.
type RawWallet = Omit<Wallet, 'balance'> & { balance: string | number };

// Authenticated.
export async function getMyWallets(token: string): Promise<Wallet[]> {
  const raw = await apiFetch<RawWallet[]>('/wallets/my-wallets', { token });
  return raw.map((w) => ({ ...w, balance: Number(w.balance) }));
}

// Matches LedgerEntryResponse (app/schemas/wallet.py).
export type LedgerEntry = {
  id: string;
  tx_type: 'CREDIT' | 'DEBIT';
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type: string;
  description: string | null;
  created_at: string;
};

// Same Decimal-as-JSON-string fields as WalletResponse above.
type RawLedgerEntry = Omit<LedgerEntry, 'amount' | 'balance_before' | 'balance_after'> & {
  amount: string | number;
  balance_before: string | number;
  balance_after: string | number;
};

// Authenticated. FR-601 - the transaction ledger, newest first.
export async function getMyLedger(token: string): Promise<LedgerEntry[]> {
  const raw = await apiFetch<RawLedgerEntry[]>('/wallets/ledger', { token });
  return raw.map((e) => ({
    ...e,
    amount: Number(e.amount),
    balance_before: Number(e.balance_before),
    balance_after: Number(e.balance_after),
  }));
}

export type ManualDepositStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// Matches ManualDepositResponse (app/schemas/wallet.py).
export type ManualDeposit = {
  id: string;
  amount: number;
  currency: string;
  bank_name: string;
  transaction_id: string;
  status: ManualDepositStatus;
  created_at: string;
};

type RawManualDeposit = Omit<ManualDeposit, 'amount'> & { amount: string | number };

// Authenticated. FR-603 - submits an admin-pending manual deposit. Unlike
// every EUR-at-the-boundary amount elsewhere, this endpoint takes the
// amount in whatever currency the customer actually deposited (they sent
// real money in BDT/etc. to a real bank/mobile account) - the backend
// converts it at approval time, not here. See docs/Rules.md -> "Payment &
// checkout" and app/api/v1/wallets.py's submit_manual_deposit().
export async function submitManualDeposit(
  token: string,
  params: { amount: number; currency: string; bankName: string; transactionId: string }
): Promise<ManualDeposit> {
  const raw = await apiFetch<RawManualDeposit>('/wallets/manual-deposit', {
    method: 'POST',
    token,
    body: {
      amount: params.amount,
      currency: params.currency,
      bank_name: params.bankName,
      transaction_id: params.transactionId,
    },
  });
  return { ...raw, amount: Number(raw.amount) };
}
