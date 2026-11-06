import { apiFetch } from '../lib/apiClient';

export type ReferralEventName = 'JOINING' | 'FIRST_PURCHASE' | 'NEW_MERCHANT';

export type ReferralEventConfig = {
  referrer: number;
  referred: number;
  enabled: boolean;
};

export type ReferredPerson = {
  username: string;
  joined_at: string;
  role: string;
};

export type ReferralRewardStatus = 'GRANTED' | 'REVERSED';

export type ReferralReward = {
  event: ReferralEventName;
  referred_username: string;
  amount: number;
  status: ReferralRewardStatus;
  created_at: string;
};

// Matches referral_svc.my_summary()'s dict (app/services/referral_svc.py) -
// no Pydantic response_model on GET /referrals/me, so this is the raw
// shape the backend actually sends.
export type ReferralSummary = {
  code: string | null;
  is_enabled: boolean;
  events: Record<string, ReferralEventConfig>;
  promo_balance: number;
  total_earned: number;
  referred_count: number;
  referred: ReferredPerson[];
  rewards: ReferralReward[];
  share_url: string | null;
  can_claim: boolean;
  referred_by: string | null;
  currency: string;
};

type RawReferralSummary = Omit<ReferralSummary, 'events' | 'promo_balance' | 'total_earned' | 'rewards'> & {
  events: Record<string, { referrer: string | number; referred: string | number; enabled: boolean }>;
  promo_balance: string | number;
  total_earned: string | number;
  rewards: (Omit<ReferralReward, 'amount'> & { amount: string | number })[];
};

// Authenticated. FR-801 - everything the "Refer & earn" screen shows.
// Decimal fields serialize as JSON strings - same conversion as every
// other wallet/withdrawal endpoint in this app.
export async function getMyReferrals(token: string): Promise<ReferralSummary> {
  const raw = await apiFetch<RawReferralSummary>('/referrals/me', { token });
  return {
    ...raw,
    events: Object.fromEntries(
      Object.entries(raw.events).map(([key, v]) => [
        key,
        { referrer: Number(v.referrer), referred: Number(v.referred), enabled: v.enabled },
      ])
    ),
    promo_balance: Number(raw.promo_balance),
    total_earned: Number(raw.total_earned),
    rewards: raw.rewards.map((r) => ({ ...r, amount: Number(r.amount) })),
  };
}
