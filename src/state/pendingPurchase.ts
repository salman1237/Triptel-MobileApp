import { create } from 'zustand';

// FR-106 - a Buy Now tap while signed out stashes the selection here (not
// AuthContext/SecureStore - this never needs to survive an app restart,
// only the login/register detour) so PackageBrowser can restore it and
// resume checkout once the user comes back signed in. See
// docs/Architecture.md -> "Client/session state".
export type PendingPurchase = {
  countrySlug: string;
  productId: string;
  discountCode: string | null;
};

type PendingPurchaseState = {
  pending: PendingPurchase | null;
  setPending: (pending: PendingPurchase) => void;
  clearPending: () => void;
};

export const usePendingPurchase = create<PendingPurchaseState>((set) => ({
  pending: null,
  setPending: (pending) => set({ pending }),
  clearPending: () => set({ pending: null }),
}));

// Where login/register/set-password should land after a successful auth:
// back at the country page that had a purchase in flight, or home if there
// wasn't one. Doesn't consume the pending purchase - PackageBrowser itself
// does that once it's actually re-mounted and can safely resume.
export function postAuthRoute(): string {
  const pending = usePendingPurchase.getState().pending;
  return pending ? `/explore/${pending.countrySlug}` : '/';
}
