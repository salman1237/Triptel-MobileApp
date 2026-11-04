# Architecture
**Read when:** writing any screen or API call.

## Stack
| Layer | Choice | Why |
|---|---|---|
| Framework | React Native via **Expo** (managed, TypeScript strict) | No native payment SDK is needed (ShurjoPay is a hosted web checkout — see "Payment" below), so there is nothing in this app's known feature set that requires ejecting from Expo. Expo gets you testing on a connected device in minutes (`expo start`, scan with Expo Go) instead of an Xcode/Android-Studio build the first day. |
| Routing | **Expo Router** (file-based) | Deliberately mirrors the web app's Next.js App Router mental model — the same person who built `frontend/src/app/` will recognize the shape of `app/` here. |
| Server state | **TanStack Query** | The backend is a plain REST API with no client-side cache contract of its own; React Query gives caching, retry, and loading/error states for free and is the de facto RN standard. |
| Client/session state | **React Context** (`AuthContext`, `AppSettingsContext`) + **Zustand** for anything that needs to live outside the component tree (e.g. the pending-purchase payload) | Small surface area; no Redux boilerplate needed for an app this size. |
| Secure storage | `expo-secure-store` (JWT) · `@react-native-async-storage/async-storage` (non-sensitive UI prefs, pending-purchase resume payload) | Matches the sensitivity split the web app makes between its session and its `sessionStorage` convenience state. |
| QR | `react-native-qrcode-svg` | Supports a center-logo overlay and SVG output, needed to reproduce `EsimQr.tsx` exactly (see "QR parity" below). |
| Payment hand-off | `expo-web-browser` (`openAuthSessionAsync`) | ShurjoPay is a hosted redirect checkout, not a native SDK — see "Payment" below. |
| Files | `expo-image-picker` (KYC NID photos, support-ticket attachments) · `expo-sharing` (install links, receipts) | |
| i18n | Thin wrapper over `GET /settings/translations/{lang}`, same `t(ns, key, fallback)` shape as the web's `AppSettingsContext` | Keeps translation keys identical across web and mobile so they can be maintained from one admin panel. |

Full dependency list and exact pinned versions live in
`docs/Technical_Requirements.md`.

## Folder layout
```
app/                      # Expo Router screens (file-based)
  (tabs)/
    index.tsx             # Explore — destination search & grid
    my-esims/
      index.tsx
      [id].tsx
    wallet/
      index.tsx
      withdraw.tsx
    refer.tsx
    profile.tsx
  explore/[slug].tsx       # country landing + package browser
  auth/
    login.tsx
    register.tsx
    forgot-password.tsx
    reset-password.tsx
    set-password.tsx
  track/[token].tsx         # public tracking, no auth
  guides/
    compatible-phones.tsx
    esim-setup-guide.tsx
  support/
    index.tsx
    [id].tsx
  legal/[slug].tsx
src/
  api/                     # one file per backend router (auth.ts, catalog.ts, orders.ts, …)
                           # thin typed fetch wrappers; screens never call fetch() directly
  state/                   # AuthContext, AppSettingsContext, pendingPurchase store
  components/              # EsimQr, PackageBrowser, PaymentMethodChooser, DiscountCodeBox,
                           # EsimStatusView, CurrencyLabel, … — ports of the same-named web components
  lib/                     # esimInstall (1-tap install links), currency convert/format, qr constants
  theme/                   # colors/type ported from the web app's design tokens
assets/
flows/                     # Maestro e2e flow YAML, one file per primary journey
__tests__/                 # Jest + React Native Testing Library, mirrors src/ structure
```

## Layering rule
Screens → hooks (`src/api/*` wrapped in `useQuery`/`useMutation`) → typed fetch
client → backend. A screen component never imports `fetch`/`axios` directly — this
is the same discipline the backend's `api/` → `service/` → `repo` layering enforces,
applied to the client side.

## The checkout state machine
Port `PackageBrowser.tsx`'s state machine as-is; do not redesign it — it already
encodes real incident history (see "Lessons from the web app" below):

```
checking → choose → working → preparing | success | error
                        └──→ redirecting (gateway payment only)
```

- **choose**: package cards, `DiscountCodeBox` (pre-login `/discounts/check`,
  post-login `/discounts/preview`), Buy Now.
- Not logged in → persist `{ productId, code }` to AsyncStorage under
  `pendingPurchase` (RN equivalent of the web's `sessionStorage` key
  `esim_pending_purchase`) and navigate to `/auth/login?next=<path>&resume=1`. After
  login/register, auto-resume the exact purchase and clear the stored payload.
- Logged in → re-check wallet balance (`GET /wallets/my-wallets`); if DEFAULT +
  REWARD covers the payable amount, show `PaymentMethodChooser` (Wallet vs. gateway);
  otherwise go straight to the gateway.
- **Wallet path**: `POST /orders/checkout` (202) → poll `GET /orders/{id}` (short
  interval first ~12s, then slower up to ~170s) → **success** (QR + install links) or
  **preparing** (still provisioning — not a failure, see below) or **error**.
- **Gateway path**: `POST /payments/shurjopay/order-initiate` → open the hosted
  checkout (`expo-web-browser`) → on return, poll the order the same way as the
  wallet path. See "Payment" below for the open question on how the gateway hands
  control back to the app.

## Payment
ShurjoPay is the only payment gateway integration (bKash/Nagad/Rocket/Visa/
Mastercard behind one hosted checkout). There is no native SDK — the web app
redirects the browser to ShurjoPay's hosted page and ShurjoPay redirects back to a
server callback URL (`GET /payments/shurjopay/callback`), which then redirects the
*browser* to `/my-esims?order=...`.

**Open question, resolve before building the gateway checkout screen:** a mobile
app can't rely on a server-side redirect landing back inside itself the way a
browser tab can. The two realistic options are:
1. `expo-web-browser`'s `openAuthSessionAsync`, which can watch for a redirect to a
   custom URL scheme (e.g. `triptel://payment-callback`) and resolve the promise
   when it sees it — this requires the backend to accept a per-request return/
   redirect URL on `POST /payments/shurjopay/order-initiate` (or `/topup`) that it
   does not currently expose; a backend change may be required.
2. Open the hosted checkout in a plain in-app browser and, after the user returns to
   the app manually (or the browser session closes), just poll `GET /orders/{id}`
   / `GET /wallets/ledger` — slower UX, needs zero backend changes.

Record which option is chosen in `DECISIONS.md` once this is actually built; don't
guess silently in code.

## Currency & i18n
Base currency is **EUR** everywhere the API talks money. Port
`AppSettingsContext.convert/convertTo/formatPrice` from the web app verbatim:
rates come from `GET /settings/rates` (6-hour TTL server-side, cache client-side
too), the symbol map is `{USD:$, BDT:৳, EUR:€, GBP:£, AED:د.إ, SAR:﷼, THB:฿, SGD:S$,
JPY:¥, MYR:RM, INR:₹}`, and JPY (and similarly zero-decimal currencies) must render
with zero decimal places. `preferred_currency` and `preferred_language` are already
per-user fields on `/auth/me` / `PUT /auth/me/preferences` — read/write the same
fields, no new schema needed. Languages are admin-controlled and may be RTL; use
`I18nManager` + logical flex properties, never hardcoded `left`/`right`.

## QR parity
`EsimQr.tsx` (web) and `qr_branding.py` (backend, used for the emailed QR) agree on
three constants: error correction **H** (~30% redundancy), logo covering **22%**
(`LOGO_RATIO = 0.22`) of the QR's width, and a circular white backing disc behind
the logo so the modules under it aren't destroyed. The RN component must use the
same three constants — see `docs/Rules.md` for why this is a hard rule, not a
preference.

## Lessons from the web app (carry these into the client)
These are real production incidents on the Triptel web app that a careless RN port
could reintroduce on the client side:
- **Async provisioning is not failure.** An eSIM purchase can legitimately take
  10–30 seconds to provision after payment succeeds. The web app once treated an
  early "still processing" poll as a failure and triggered a refund path for
  already-charged, already-provisioning orders. The RN checkout screen must show a
  "Setting up your eSIM" state for `PROCESSING`/empty polls and never present a
  failure/retry UI until the backend actually reports `FAILED`.
- **Resume-after-login must not drop the selection.** The pending-purchase pattern
  above exists because losing the chosen package mid-login is a real support-ticket
  source on the web app.
- **Tests have passed while the bug was present, more than once** in this codebase's
  history (QR error-correction silently downgraded from H to M, a wallet-sort bug, a
  price-matching bug) — all with a fully green test suite. Any verification command
  added to `feature_list.json` must be proven to fail when the feature is reverted,
  not just proven to pass when it's present. See `docs/Rules.md`.
