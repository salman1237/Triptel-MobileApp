import { apiFetch } from '../lib/apiClient';

// Matches WalletResponse (app/schemas/wallet.py).
export type Wallet = {
  id: string;
  wallet_type: 'DEFAULT' | 'REWARD' | 'COMMISSION';
  balance: number;
  currency: string;
  is_frozen: boolean;
};

// Authenticated.
export function getMyWallets(token: string): Promise<Wallet[]> {
  return apiFetch<Wallet[]>('/wallets/my-wallets', { token });
}
