import { getOrder, type Order } from '../api/orders';

// Checkout returns as soon as payment is taken; the eSIM is provisioned in
// the background (~10-30s). Polls the order until it settles. Ported
// verbatim from the web app's src/lib/waitForOrder.ts - see
// docs/Architecture.md -> "The checkout state machine".
//
// A single failed poll (network blip, brief deploy restart) doesn't abort -
// the order keeps provisioning server-side regardless of this screen. Throws
// "still_processing" on timeout so the caller can tell the customer it will
// appear in My eSIMs rather than reporting a failure that hasn't happened.
export async function waitForOrder(
  token: string,
  orderId: string,
  { intervalMs = 2000, timeoutMs = 180000 }: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<Order> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const order = await getOrder(token, orderId);
      if (order.status === 'COMPLETED' || order.status === 'FAILED') {
        return order;
      }
    } catch {
      // Transient - keep polling until the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error('still_processing');
}
