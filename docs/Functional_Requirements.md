# Functional Requirements
**Read when:** building a feature. Every FR below maps to one `feature_list.json`
item (same ID). Each is sized to roughly one session — "user can reveal a QR code",
not "build My eSIMs".

Source of truth for every FR here is the live web app (`D:\eSim\frontend` +
`D:\eSim\backend`) as it exists today, not this doc's memory of it — if the two
disagree once you're building, the running backend wins and this doc gets corrected.

Endpoints are under `https://<api-host>/api/v1` unless noted.

---

## A. Onboarding & Auth

- **FR-101 Register.** Email, username, optional phone, password, optional referral
  code (pre-filled and live-validated if opened via a `?ref=CODE` link — see
  FR-801). `POST /auth/register`.
- **FR-102 Login.** Email-or-username + password. `POST /auth/login`. Response
  carries `must_change_password` — if set, route to FR-105 instead of home, but
  still allow navigating to My eSIMs.
- **FR-103 Google Sign-In.** Native Google auth → `POST /auth/google` (server
  verifies the ID token). Covers both sign-in and sign-up.
- **FR-104 Forgot / reset password.** `POST /auth/forgot-password` (generic
  response, no account enumeration) and `POST /auth/reset-password` (token + new
  password). The reset link from email currently points at the web app; see
  `AGENTS.md` → "Known Gaps" — MVP opens it in the system browser.
- **FR-105 Forced password change.** For accounts created by a merchant with the
  customer's phone number as the password. Requires current password + new
  password. `POST /auth/change-password`. Blocks checkout/wallet actions until
  done; does not block viewing `/my-esims`.
- **FR-106 Resume purchase after login/register.** If the user was sent to auth
  mid-checkout, restore the exact package + discount code selection after
  successful login/register and land them back in the checkout flow, not the home
  screen.
- **FR-107 Session restore on app start.** If a valid token is in SecureStore,
  silently restore the session (`GET /auth/me`) instead of showing the login
  screen; on a `401`, clear it and fall through to login.

## B. Discovery & Browse

- **FR-201 Home / destination search.** Live country search (debounced) via
  `GET /catalog/countries?search=`, a "Popular Destinations" grid, entry point to
  the full destination list.
- **FR-202 Full destination directory.** Browse/search all countries, grouped by
  region.
- **FR-203 Country landing (explore) screen.** `GET /catalog/destinations/{slug}`
  — flag, name, package count, cheapest price, then the package list (FR-301).
  Deep-linkable by slug for sharing (web-link parity, not necessarily an app
  universal link — see `AGENTS.md` → "Known Gaps").

## C. Checkout
See `docs/Architecture.md` → "The checkout state machine" for the full flow this
group implements; don't redesign it, port it.

- **FR-301 Package list & filters.** Cards (GB/unlimited, validity, price,
  "Recommended" badge for `is_featured`), filter chips for data size and validity.
  `GET /catalog/countries/{iso2}/products`.
- **FR-302 Discount code entry (pre-login).** `POST /discounts/check` (public) —
  shows an estimated saving on every visible package.
- **FR-303 Discount code entry (post-login).** `POST /discounts/preview`
  (authenticated) — exact amount, called right before charging.
- **FR-304 Payment method choice.** If wallet (`DEFAULT` + `REWARD`) covers the
  payable amount, show a Wallet-vs-Gateway choice; otherwise go straight to the
  gateway. `GET /wallets/my-wallets`.
- **FR-305 Wallet checkout.** `POST /orders/checkout` (`payment_method=WALLET`,
  optional `discount_code`), then poll `GET /orders/{id}` until the eSIM is ready or
  the backend reports `FAILED`. See `docs/Rules.md` — `PROCESSING` is not failure.
- **FR-306 Gateway checkout (ShurjoPay).** `POST /payments/shurjopay/order-initiate`
  → hosted checkout → back to the app → poll the order the same way as FR-305. The
  hand-off mechanism is an open technical decision — see `docs/Architecture.md` →
  "Payment" before building this one.
- **FR-307 Purchase success.** QR reveal (FR-401 component), 1-tap install links,
  "View in My eSIMs".
- **FR-308 Purchase still-processing state.** "Setting up your eSIM" — explicitly
  not an error state; backend may finish provisioning after the screen stops
  polling, email arrives regardless.
- **FR-309 Purchase failure.** Only shown on an explicit `FAILED` order status, with
  a clear statement of whether/how a refund happens.

## D. My eSIMs

- **FR-401 eSIM QR component.** Center-logo QR exactly matching the web/email
  version — see `docs/Rules.md` → "The QR code". Reused by FR-402, FR-307, FR-404,
  FR-501.
- **FR-402 My eSIMs list.** Cards per owned profile: tap-to-reveal QR, ICCID, order
  number, 1-tap iOS/Android install links, copy LPA code, share/print. `GET
  /orders/my-esims`.
- **FR-403 eSIM status/detail screen.** Usage %, status, validity countdown, install
  buttons, SM-DP+/matching-ID/LPA rows (copyable), daily usage breakdown,
  install-history timeline, a visible warning if carrier telemetry is stale/
  unavailable. `GET /esims/{id}/status`, with a manual refresh action
  (`POST /esims/{id}/refresh`). This is the single richest screen in the app —
  budget it more than one session if needed, but don't let that become an excuse to
  skip the "size to one session" rule; split it into sub-items when you get there.
- **FR-404 Printable / shareable receipt.** RN equivalent of the web's print sheet
  — render to PDF (`expo-print`) and share (`expo-sharing`) rather than
  `window.print()`.
- **FR-405 Copy / share the public tracking link.** Native share sheet for the
  `share_token` URL (see FR-501).

## E. Public eSIM Tracking

- **FR-501 Public tracking screen.** No login required, keyed on the 128-bit
  `share_token` from the delivery email (`GET /esims/public/{token}`). Reuses the
  same status component as FR-403, scoped read-only. Invalid/expired token shows an
  error state linking to Support.

## F. Wallet

- **FR-601 Wallet overview.** Three balances — DEFAULT ("Main balance"), REWARD
  ("Reward credit — not withdrawable"), COMMISSION — plus the transaction ledger.
  `GET /wallets/my-wallets`, `GET /wallets/ledger`.
- **FR-602 Top-up via gateway.** Preset + custom amount (respecting configured
  min/max and ShurjoPay's own floor), `POST /payments/shurjopay/topup`, same
  hand-off question as FR-306.
- **FR-603 Manual deposit.** Select a configured payment method (bank / bKash /
  Nagad / Rocket / Bangla QR image), submit a transaction ID for admin approval.
  `POST /wallets/manual-deposit`.
- **FR-604 Top-up result banners.** Success / failed / cancelled states after
  returning from the gateway.

## G. Withdrawals

- **FR-701 Payout accounts.** Add/remove/set-default bank or mobile-wallet account
  (max 5). `GET/POST /withdrawals/accounts`, `POST .../{id}/default`,
  `DELETE .../{id}`.
- **FR-702 Withdrawal request.** Amount with live min/max/fee preview, category,
  optional note. Blocked behind KYC (FR-1002) with a clear "Verify now" path if not
  eligible. `GET /withdrawals/config`, `POST /withdrawals`.
- **FR-703 Withdrawal history.** List with status badges (Pending/Paid/Rejected/
  Cancelled), cancel-while-pending. `GET /withdrawals`,
  `POST /withdrawals/{id}/cancel`.
- **FR-704 Withdrawal receipt.** Printable/shareable, same approach as FR-404 —
  reference number, frozen conversion rate, payout amount/currency, account line.
  `GET /withdrawals/{id}`.

## H. Referrals

- **FR-801 Referral screen.** Own code + shareable link (native share sheet), 3
  stat tiles (reward balance, total earned, people joined), per-event reward
  amounts (JOINING / FIRST_PURCHASE / NEW_MERCHANT), list of referred people and
  what each earned. `GET /referrals/me`.
- **FR-802 Claim a referrer's code post-signup.** Only shown while eligible (before
  the user's first purchase — `can_claim` from the API, don't infer this
  client-side). `POST /referrals/claim`.
- **FR-803 Referral-link pre-fill.** Opening the app via a referral link pre-fills
  and live-validates the code on the register screen (`GET /referrals/validate`) —
  tie this to whatever link-opening mechanism is chosen per `AGENTS.md` →
  "Known Gaps".

## I. Guides

- **FR-901 Compatible-phones / eSIM-support check.** Curated device list by brand,
  the `*#06#` / EID dial-check instructions with the embedded video, and the manual
  iOS/Android settings-path fallback. Static content — no API call.
- **FR-902 eSIM setup guide.** Step-by-step iOS/Android install instructions,
  "can only install once" warning, a troubleshooting checklist. Static content.

## J. Profile & KYC

- **FR-1001 Profile screen.** Avatar, name/username, role, linked-Google badge,
  email (+ verified badge), editable phone/WhatsApp (`PUT /auth/me/preferences`),
  wallet-balance mini view, sign out.
- **FR-1002 KYC submission.** NID number + front photo (required) + back photo
  (optional) via `expo-image-picker`, shows Pending/Rejected states.
  `POST /kyc/submit`, `GET /kyc/me`. Confirm with stakeholders whether this ships
  in the first release or is deferred — most users never withdraw, so it is not on
  the checkout-critical path; see `DECISIONS.md`.

## K. Support

- **FR-1101 Ticket list.** Subject, reference, status, last-message date.
  `GET /support/tickets`.
- **FR-1102 New ticket.** Subject, category (`GET /support/categories`), body, up to
  5 attachments ≤5MB (`expo-image-picker`/document picker).
  `POST /support/tickets`.
- **FR-1103 Ticket thread.** Reply with attachments, "Close this ticket", resolved
  banner that reopens on reply. `GET /support/tickets/{id}`,
  `POST .../{id}/messages`, `POST .../{id}/close`.

## L. Legal & Settings

- **FR-1201 Legal documents.** Privacy / Data Privacy / Terms / Declaration /
  Refund Policy / Payment Policy, tabbed, admin-editable markdown-lite content.
  `GET /settings/legal`, `GET /settings/legal/{slug}`.
- **FR-1202 App settings bootstrap.** On launch: `GET /settings/public` (branding,
  payment methods, top-up limits, support contact, feature flags),
  `GET /settings/languages`, `GET /settings/rates`. Powers currency/i18n
  everywhere else (`docs/Architecture.md` → "Currency & i18n").
- **FR-1203 Maintenance mode.** If `publicSettings` flags maintenance, show a
  blocking screen instead of the app shell (port of the web's `MaintenanceGate`).

## M. Navigation / Global chrome

- **FR-1301 Bottom tab bar.** Explore · My eSIMs · Wallet · Refer · Profile — direct
  port of the web's `MobileBottomNav`. No Agent/Partner tabs (out of scope, see
  `AGENTS.md`).
- **FR-1302 Currency switcher.** EUR/USD/BDT/GBP/AED/SAR (+ whatever
  `/settings/rates` returns), persisted via `PUT /auth/me/preferences`.
- **FR-1303 Language switcher.** Admin-controlled active-language list, RTL-aware.

---

## Explicitly out of scope for this app (noted for completeness, not to be built)
- `/admin`, `/reseller` (merchant/partner dashboard), `/agent` (agent dashboard),
  `/api-docs` (partner API docs) — separate panels entirely.
- `/partners` marketing page and its "apply" CTA — the CTA leads into merchant
  onboarding, out of scope; the marketing page itself is arguably a web-only
  concern and is not an FR here.
- `is_buy_for_user` (merchant "buy on behalf of a customer") — not part of the
  self-serve flow. If a "gift an eSIM to someone else" feature is wanted later,
  it needs its own FR, not a silent reuse of this flag.
