import { getMyWallets } from '../../src/api/wallets';

// Regression test for a live, on-device-only bug: the backend's
// WalletResponse.balance is a Decimal, which FastAPI/Pydantic serializes to
// JSON as a *string* (e.g. "15.00"), not a number. src/api/wallets.ts used
// to type `balance: number` but never parsed it, so every consumer
// (Profile's wallet mini-view, PackageBrowser's wallet-vs-gateway spendable
// check) was summing/comparing strings - `0 + "0.00"` concatenates instead
// of adding, which turned into NaN once formatPrice tried to format it.
// None of the screen-level tests caught this because they all mock
// getMyWallets() directly with already-numeric fixture data, never
// exercising the real JSON-to-number conversion - only a real device run
// surfaced it (Profile showed "৳NaN" live).
describe('getMyWallets (decimal-string parsing)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('parses string balances from the raw API response into numbers', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          { id: 'w1', wallet_type: 'DEFAULT', balance: '12.00', currency: 'EUR', is_frozen: false },
          { id: 'w2', wallet_type: 'REWARD', balance: '3.50', currency: 'EUR', is_frozen: false },
        ]),
    }) as unknown as typeof fetch;

    const wallets = await getMyWallets('token');

    expect(wallets[0].balance).toBe(12);
    expect(wallets[1].balance).toBe(3.5);
    expect(typeof wallets[0].balance).toBe('number');

    // The actual bug: summing the unparsed strings concatenates instead of
    // adding, and is never NaN by accident - prove the parsed values behave
    // like real numbers under addition.
    const spendable = wallets.reduce((sum, w) => sum + w.balance, 0);
    expect(spendable).toBe(15.5);
    expect(Number.isNaN(spendable)).toBe(false);
  });
});
