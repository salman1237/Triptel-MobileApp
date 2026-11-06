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
