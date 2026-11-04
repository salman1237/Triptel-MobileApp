# Rules
**Read when:** writing any code, not just the areas these rules name.

Each rule exists because of something specific — either a real incident on the web
app, or a structural guarantee the backend already relies on. Don't relax one
without understanding why it's here first.

## Auth
- JWT lives in `expo-secure-store` only. Never `AsyncStorage`, never component
  state outside the auth context, never a log line, never a crash report payload.
- Every authenticated request sends `Authorization: Bearer <token>` via the shared
  API client — never construct this header ad hoc in a screen.
- There is **no refresh-token endpoint**. On a `401`, clear the stored session and
  route to `/auth/login`. Do not write a silent-retry-with-stale-token path; there
  is nothing on the server for it to call.
- `must_change_password` (set when a merchant created the account on a customer's
  behalf, with their phone number as the password) blocks checkout and wallet
  moves but **not** viewing eSIMs — route such a user to `/auth/set-password`, but
  still let them see `/my-esims`.

## Payment & checkout
- A `PROCESSING` order status, or an empty poll response, is **not a failure**. The
  supplier call takes 10–30 seconds. Never show a failure state, a "try again"
  button, or trigger any refund-looking UI for an order the backend hasn't
  explicitly marked `FAILED`. This is the single most expensive mistake the web app
  has made — see `docs/Architecture.md` → "Lessons from the web app".
- Never compute a final charge amount on-device. `POST /discounts/check` (public,
  pre-login) and `POST /discounts/preview` (authenticated) are estimates and
  server-verified amounts respectively — the client never charges based on its own
  arithmetic.
- The wallet-vs-gateway choice is a UI convenience, not a security boundary: always
  let the backend be the final word on whether a wallet balance covered the order.
- `is_buy_for_user` / "buy on behalf of a customer" is a merchant feature. Do not
  call `POST /orders/checkout` with that flag, and do not build a "gift an eSIM to
  someone else" screen under this scope without it being added to
  `docs/Functional_Requirements.md` first.

## Money
- The API boundary is **EUR**, always. A value coming from any endpoint is EUR
  unless that endpoint's own doc says otherwise (e.g. a withdrawal's frozen
  `payout_amount`/`payout_currency` at approval time).
- Conversion for display is client-side only, using `GET /settings/rates`. A
  converted amount is never sent back to the API and never persisted as if it were
  the authoritative value.

## The QR code
- Must match `qr_branding.py` (backend, used for the emailed QR) and `EsimQr.tsx`
  (web) exactly: error correction **H**, logo at **22%** of the QR's width
  (`LOGO_RATIO = 0.22`), a circular white disc behind the logo, the app icon — not
  the wordmark — as the logo.
- A logo sitting directly on top of QR modules destroys the data underneath it.
  Error correction H is what makes that survivable; dropping to a lower level
  "because it still scans in the simulator" is exactly how the web app once shipped
  a QR that looked fine on a clean screen and failed on a folded, photographed
  printout — with every existing test still green, because none of them tested a
  damaged/scanned-from-paper image. Any change to the RN QR component needs a
  damage-tolerance test (crop/noise the rendered image, confirm it still decodes)
  before it can be marked `passing`.

## Scope
- This is the **User App**. No merchant, agent, partner, or admin screen. No call
  to `/merchant/*`, `/agent/*`, `/admin/*`, or `/orders/reseller-orders`.
- Don't build toward a backend capability that doesn't exist yet (push
  notifications, app deep links) without flagging it in `claude-progress.md` as
  blocked-on-backend first — see `CLAUDE.md` → "Known Gaps".

## Process
- **WIP = 1.** Finish and verify the active feature before starting the next.
- A feature only moves from `active` to `passing` in `feature_list.json` by its own
  verification command passing — never by editing the JSON directly.
- A verification command must be proven to **fail** when the feature it checks is
  reverted. This codebase (web + backend) has shipped a vacuous test — one that
  passes whether or not the bug is fixed — at least three times in its history.
  Prove the negative before trusting the positive.
- Don't "also fix" something nearby while working a feature. Log it as a new
  `not_started` item in `feature_list.json` instead and keep WIP at 1.
