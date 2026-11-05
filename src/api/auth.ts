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

// Matches UserRegister (app/schemas/auth.py). An unknown/expired referral
// code is silently ignored by the backend, never rejects the signup - see
// app/api/v1/auth.py's register().
export type RegisterDetails = {
  email: string;
  username: string;
  password: string;
  phone?: string;
  full_name?: string;
  referral_code?: string;
};

export function register(details: RegisterDetails): Promise<AuthToken> {
  return apiFetch<AuthToken>('/auth/register', { method: 'POST', body: details });
}

export type StatusMessage = {
  status: string;
  message: string;
};

// Always returns the same generic response whether or not the email is
// registered - never surface a different message for "not found" here, that
// would let an attacker enumerate accounts. See app/api/v1/auth.py.
export function forgotPassword(email: string): Promise<StatusMessage> {
  return apiFetch<StatusMessage>('/auth/forgot-password', { method: 'POST', body: { email } });
}

export function resetPassword(token: string, newPassword: string): Promise<StatusMessage> {
  return apiFetch<StatusMessage>('/auth/reset-password', {
    method: 'POST',
    body: { token, new_password: newPassword },
  });
}

// Authenticated. Also how a must_change_password account (FR-105) clears
// that flag - the current password is still required even though the user
// is signed in, since the credential in play (their phone number, set by a
// merchant) may be known to other people. See app/api/v1/auth.py.
export function changePassword(
  authToken: string,
  currentPassword: string,
  newPassword: string
): Promise<StatusMessage> {
  return apiFetch<StatusMessage>('/auth/change-password', {
    method: 'POST',
    token: authToken,
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

export type PreferencesUpdate = {
  // Both optional, matching the backend's PreferencesRequest (app/api/v1/auth.py)
  // - omitted leaves a field alone, "" clears phone (it's optional everywhere).
  preferred_currency?: string;
  phone?: string;
};

export type PreferencesResult = {
  status: string;
  preferred_currency: string | null;
  phone: string | null;
};

// Authenticated. FR-1001's phone/WhatsApp edit and the future currency
// switcher (FR-1302) both go through this one endpoint.
export function updatePreferences(authToken: string, update: PreferencesUpdate): Promise<PreferencesResult> {
  return apiFetch<PreferencesResult>('/auth/me/preferences', { method: 'PUT', token: authToken, body: update });
}
