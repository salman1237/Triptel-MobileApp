import { apiFetch } from '../lib/apiClient';

export type DiscountCheckResult =
  | {
      valid: true;
      code: string;
      description: string | null;
      discount_type: 'PERCENT' | 'FIXED';
      value: string;
      max_discount_amount: string | null;
      // These rules (scope, first-purchase-only, per-user cap) can't be
      // checked without a signed-in user - true means "looks real, but the
      // exact savings are only confirmed once you sign in". See
      // app/services/discount_svc.py's check_generic().
      scoped: boolean;
    }
  | {
      valid: false;
      reason: string;
    };

// Public (despite this file's own module docstring saying otherwise - the
// route has no auth dependency; see docs/.claude/skills/new-api-integration
// step 2, the running backend wins over stale comments). Deliberately weaker
// than /discounts/preview (FR-303): never treat its numbers as final, see
// docs/Rules.md -> "Payment & checkout".
export function checkDiscountCode(code: string): Promise<DiscountCheckResult> {
  return apiFetch<DiscountCheckResult>('/discounts/check', { method: 'POST', body: { code } });
}

// All amount fields come back as decimal strings (Python's str(Decimal)) -
// see app/api/v1/discounts.py's preview_discount().
export type DiscountPreviewResult =
  | {
      valid: true;
      code: string;
      description: string | null;
      discount_type: 'PERCENT' | 'FIXED';
      value: string;
      discount_amount: string;
      list_price: string;
      total: string;
      currency: string;
    }
  | {
      valid: false;
      reason: string;
    };

// Authenticated. The exact, server-verified amount for a specific product -
// this is the number that's actually charged (re-validated again, under a
// lock, at checkout itself). See docs/Rules.md -> "Payment & checkout".
export function previewDiscount(token: string, code: string, productId: string): Promise<DiscountPreviewResult> {
  return apiFetch<DiscountPreviewResult>('/discounts/preview', {
    method: 'POST',
    token,
    body: { code, product_id: productId },
  });
}
