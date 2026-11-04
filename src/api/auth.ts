import { apiFetch } from '../lib/apiClient';

export type Wallet = {
  type: string;
  wallet_type: string;
  balance: number;
  currency: string;
};

export type MerchantProfileSummary = {
  business_name: string;
  status: string;
  rejection_reason: string | null;
  commission_rate_pct: number;
};

export type AgentProfileSummary = {
  company_name: string;
  agent_code: string;
  status: string;
  rejection_reason: string | null;
  commission_rate_pct: number;
};

// Matches GET /auth/me's actual response body (app/api/v1/auth.py on the
// backend) - it predates UserResponse and returns a few fields that schema
// doesn't declare, so this type is shaped from the endpoint, not the schema.
export type CurrentUser = {
  id: string;
  email: string;
  username: string;
  role: string;
  status: string;
  phone: string | null;
  full_name: string | null;
  is_kyc_verified: boolean;
  preferred_currency: string;
  avatar_url: string | null;
  email_verified: boolean;
  has_google: boolean;
  wallets: Wallet[];
  merchant_profile: MerchantProfileSummary | null;
  agent_profile: AgentProfileSummary | null;
};

// Authenticated. Used on app start to confirm a stored token is still valid
// and fetch the signed-in user - see docs/Functional_Requirements.md FR-107.
export function getMe(token: string): Promise<CurrentUser> {
  return apiFetch<CurrentUser>('/auth/me', { token });
}

export type LoginCredentials = {
  // The field is literally named "email" in the backend's UserLogin schema,
  // but it accepts a username too - see app/api/v1/auth.py's login().
  email: string;
  password: string;
};

// Matches Token (app/schemas/auth.py) - the backend has no refresh-token
// endpoint, so this access_token is the whole session. See docs/Rules.md.
export type AuthToken = {
  access_token: string;
  token_type: string;
  role: string;
  user_id: string;
  username: string;
  must_change_password: boolean;
};

export function login(credentials: LoginCredentials): Promise<AuthToken> {
  return apiFetch<AuthToken>('/auth/login', { method: 'POST', body: credentials });
}
