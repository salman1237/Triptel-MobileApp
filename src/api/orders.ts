import { apiFetch } from '../lib/apiClient';

export type ESIMProfile = {
  id: string;
  order_id: string;
  iccid: string | null;
  lpa_string: string | null;
  qr_code_data: string | null;
  smdp_address: string | null;
  status: string;
  is_mock_fallback: boolean;
  created_at: string;
};

export type OrderStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type Order = {
  id: string;
  order_no: string;
  buyer_id: string;
  beneficiary_id: string;
  product_id: string;
  total_amount: number;
  discount_amount: number;
  currency: string;
  payment_method: 'WALLET' | 'SHURJOPAY';
  status: OrderStatus;
  created_at: string;
  esim_profile: ESIMProfile | null;
};

// Decimal fields serialize as JSON strings - see app/schemas/order.py's
// OrderResponse - the same class of bug fixed in src/api/wallets.ts's
// getMyWallets(). Converted once here so every caller gets real numbers.
type RawOrder = Omit<Order, 'total_amount' | 'discount_amount'> & {
  total_amount: string | number;
  discount_amount: string | number;
};

function toOrder(raw: RawOrder): Order {
  return { ...raw, total_amount: Number(raw.total_amount), discount_amount: Number(raw.discount_amount) };
}

// Only the WALLET path - gateway checkout is POST /payments/shurjopay/order-initiate
// (FR-306), a separate, unbuilt flow. See docs/Architecture.md -> "The
// checkout state machine".
export async function checkoutWithWallet(token: string, productId: string, discountCode?: string): Promise<Order> {
  const raw = await apiFetch<RawOrder>('/orders/checkout', {
    method: 'POST',
    token,
    body: {
      product_id: productId,
      payment_method: 'WALLET',
      ...(discountCode ? { discount_code: discountCode } : {}),
    },
  });
  return toOrder(raw);
}

export async function getOrder(token: string, orderId: string): Promise<Order> {
  const raw = await apiFetch<RawOrder>(`/orders/${orderId}`, { token });
  return toOrder(raw);
}
