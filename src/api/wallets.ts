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
