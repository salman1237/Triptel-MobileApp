# Progress Log

Read this first every session. Newest entry on top.

---

## Session 10 — 2026-11-07 — FR-1203/801/802/803 passing (maintenance mode + referrals)

**Did:**
- **FR-803 Referral-link pre-fill → passing** (`f1ff116`, flip `2f56226`).
  A shared referral link arrives as `.../auth/register?ref=CODE` -
  `expo-router`'s `useLocalSearchParams` surfaces it as a local search
  param regardless of entry method. `app/auth/register.tsx` now reads
  that param as the referral field's initial value (uppercased), and
  live-validates whatever code is in the field - pre-filled or typed -
  against the new public `validateReferralCode()`
  (`GET /referrals/validate`), debounced 350ms, same pattern as the
  web's `src/app/auth/register/page.tsx`. Shows "Invited by X [+
  reward]" or a soft unrecognised-code note, never blocking submission.
  6 tests, proven non-vacuous (forced the field to always start empty,
  confirmed the 3 pre-fill-dependent tests failed, restored it). Also
  updated the existing FR-101 register tests' `expo-router` mock to add
  `useLocalSearchParams`. Hit one real lint catch along the way -
  `react-hooks/set-state-in-effect` flagged a synchronous `setReferral`
  call at the top of the debounce effect; moved the short-code clear
  branch inside the `setTimeout` alongside the validation call to fix
  it properly rather than suppressing the rule. Verified live on-device:
  deep-linked to `triptel://auth/register?ref=5JRRHJH8` on the connected
  Vivo device, the field pre-filled with that code and the live
  validation call hit the real backend - correctly showed the
  unrecognised-code note, since the referral programme is currently
  disabled on staging (same as `/refer` already shows).
- **FR-802 Claim a referrer's code post-signup → passing** (`c29d297`,
  flip `2c3d61e`). Added the "Were you referred by someone?" claim form
  to `app/refer/index.tsx` - visible only while `/referrals/me` reports
  `can_claim`, replaced by FR-801's existing passive "You were referred
  by X" line once a referrer is on file. New `claimReferralCode()` in
  `src/api/referrals.ts` (`POST /referrals/claim`); on success the form
  clears and the `['referrals', 'me']` query is invalidated so the
  screen re-renders from the server's fresh state instead of guessing
  the result client-side. Also factored the Decimal-to-number
  conversion `getMyReferrals()` used into a shared `toReferralSummary()`
  helper, since both endpoints return the same shape. Ported from the
  web's `src/app/refer/page.tsx` claim form/handler. 5 tests, proven
  non-vacuous (forced the `can_claim` branch to always render the form,
  confirmed the two referred_by-dependent tests failed, restored it).
  Verified live on-device against the real staging backend: deep-linked
  to `/refer` on the connected Vivo device, entered a bogus code
  ("BADCODE1"), submitted, and the server's real rejection ("That
  referral code isn't valid.") rendered in the form - the claim path
  round-trips through the real API end to end.
- **FR-1203 Maintenance mode → passing** (`1789e62`). New
  `src/components/MaintenanceGate.tsx` - a maintenance-flagged backend
  shows a blocking screen instead of the app shell, except for admins
  (SUPER_ADMIN/ADMIN) and the public tracking path (`/track/...` - a
  customer with nothing but a delivery-email link still needs their QR
  code; FR-501, that screen itself, isn't built yet, but the exemption is
  kept now rather than guessed in later). Ported from the web's
  `src/components/MaintenanceGate.tsx`. Reads the `publicSettings`
  FR-1202's bootstrap gate already fetches - no separate request. Wired
  into `app/_layout.tsx` wrapping the root `Slot`. Extended
  `PublicSettings` with `platform_name`/`maintenance_mode`. 5 tests, proven
  non-vacuous. Verified live on-device: staging's `maintenance_mode` is
  currently off, so this confirms the normal path still renders correctly
  with the gate in place - didn't flip the flag on shared staging to force
  the blocking screen; that path is covered by the unit tests.
- **FR-801 Referral screen → passing** (`6a73869`). New `app/refer/index.tsx` -
  code/link + share action (React Native's built-in `Share` API, no new
  dependency), three stat tiles (reward credit, total earned, people
  joined), per-event reward amounts filtered to enabled-only, and a
  referred-people list with GRANTED-only earned totals (a reversed reward
  doesn't count, but is noted) and a Partner badge for a referred
  MERCHANT. Also shows the passive "You were referred by X" line when a
  referrer is already on file - the same `/referrals/me` response this
  screen already has, not a new action. **Explicitly does not include**
  the "Were you referred by someone?" claim-a-code form - that's FR-802,
  a separate FR. Ported from the "Refer & earn" sections of the web's
  `src/app/refer/page.tsx`. Added `src/api/referrals.ts`
  (`getMyReferrals()`). Linked from the wallet overview's REWARD card via
  a new "Earn more" action, matching the web's own entry point. 11 tests,
  proven non-vacuous (confirmed the GRANTED-only earned-total filter is
  load-bearing). Verified live on-device against the real staging
  backend: real referral code shown, the real (currently disabled)
  programme notice rendered correctly, and the new wallet "Earn more"
  link navigates to this screen correctly.
- `make check`'s three layers (typecheck, lint, `jest --ci`) all pass
  clean - 34 suites / 152 tests.
- Also this session: re-investigated the Maestro `launchApp` hang
  blocking FR-106/305/306/402/602 (see `DECISIONS.md`) - tested the
  one principled next step (downgrading to CLI 2.9.0, pre-dating a
  suspected upstream dadb-timeout regression) and ruled it out; the
  hang reproduces identically on both versions, so it's genuinely
  device/environment-specific, not a CLI regression. Still blocked.

**Next step:** FR-1102 (New ticket), FR-1103 (Ticket thread), FR-1301
(Bottom tab bar), FR-1302/1303 (currency/language switchers), and the
eSIM-detail/receipt/tracking group (FR-403/404/405/501) are all good
`npm test`-verified, unblocked candidates. FR-305's Maestro `launchApp`
blocker is still open (see `DECISIONS.md`, now including the ruled-out
version-downgrade experiment) and continues to gate FR-106/306/402/602.

## Session 9 — 2026-11-06 — FR-307/308/309/601/603/701 passing (checkout polish + wallet/withdrawal foundations)

**Did:**
- **FR-307 Purchase success → passing** (`920630f`). `CheckoutFlowModal.tsx`'s
  success stage now shows the branded QR (`EsimQr`, reused from FR-401),
  one-tap install-on-iPhone/Android links (`src/lib/esimInstall.ts`, ported
  verbatim from the web), and a "View & Print" path to a new minimal
  `app/my-esims/` placeholder (FR-402 builds the real list later). 5 tests,
  proven non-vacuous. Verified live on-device: real QR, both install
  buttons, and navigation all confirmed working.
- **FR-308 Purchase still-processing state → passing** (`574b36f`). Added a
  "View My eSIMs" action to the preparing stage (matching the web) and a
  dedicated test suite proving the core invariant: a still-provisioning
  order never shows an error. 4 tests, proven non-vacuous. The preparing
  state itself can't be forced live deterministically (staging's supplier
  resolves within the short poll window every time) - covered by unit
  tests instead; live-verified the success path still works with the
  modal's extra button in place.
- **FR-309 Purchase failure → passing** (`969e0d6`). Replaced the old
  single hedged error message with a three-way `RefundStatus`
  ('refunded' | 'not_charged' | 'unknown') the UI states definitively
  where it actually can - 'refunded' only for an explicit FAILED order
  (fulfil_order always refunds those server-side), 'not_charged' for a
  pre-commit checkout rejection (e.g. insufficient balance), and an
  honestly-uncertain 'unknown' for network-level failures where the
  client genuinely can't know if the backend committed. 5 tests, proven
  non-vacuous.
- **Found and fixed a real regression along the way**: FR-307's
  `useRouter()` call in `CheckoutFlowModal` broke
  `__tests__/explore/country.test.tsx`, which had a *partial*
  `expo-router` mock (only `useLocalSearchParams`) that clobbered the real
  module once `CheckoutFlowModal` started calling `useRouter()`
  unconditionally. Fixed by adding `useRouter` to that mock. Full suite
  (24 suites / 92 tests) confirmed green afterward.
- **FR-601 Wallet overview → passing** (`50fa51a`). New `app/wallet/index.tsx`:
  the three wallet-type balance cards (DEFAULT/REWARD/COMMISSION, each with
  its own title/note ported from the web's `WALLET_COPY`) and the
  transaction ledger (newest first, signed amounts, running balance-after).
  Added `getMyLedger()` to `src/api/wallets.ts` (same Decimal-string-to-
  number conversion as `getMyWallets`). Deliberately scoped to balances +
  ledger only - top-up (FR-602/603/604) and withdrawals (FR-701/702) are
  separate, later FRs. 4 tests, proven non-vacuous. Verified live
  on-device: real balances and real transaction history (the session's
  three eSIM purchases plus one deposit) all rendered correctly.
- **FR-603 Manual deposit → passing** (`0818058`). New
  `app/wallet/manual-deposit.tsx` - submit a bank/mobile-wallet/QR manual
  deposit with a transaction ID for admin approval, linked from the wallet
  overview screen. Added `getPublicSettings()` (`src/api/settings.ts`) and
  `submitManualDeposit()` (`src/api/wallets.ts`) - the latter is one of the
  few endpoints that takes the amount in the customer's own currency
  directly (the backend converts at approval time), unlike every other
  EUR-at-the-boundary amount in this app. Skipped FR-602 (gateway top-up) -
  Maestro-blocked, same as FR-305/306/402. 5 tests, proven non-vacuous.
  Verified live on-device against the real staging backend: real
  configured bKash account shown, real submission created a real PENDING
  deposit request.
- **FR-701 Payout accounts → passing** (`c34ef2c`). New
  `app/withdrawals/accounts.tsx` - add/remove/set-default up to 5 payout
  accounts (bank or mobile wallet), linked from the wallet overview screen.
  Added `src/api/withdrawals.ts`. Deliberately scoped to accounts only -
  the withdrawal request form and history (FR-702/703, same web page) are
  separate, later FRs. 8 tests, proven non-vacuous. Verified live
  on-device: empty state, then added a real bKash account and saw it
  listed with the Default badge.
- Skipped **FR-604** (top-up result banners) this session - its entire
  premise is "returning from the gateway," which only makes sense once
  FR-602 exists; building the banner UI first would be guessing at a
  contract that isn't defined yet.
- **FR-702 Withdrawal request → passing** (`c084978`). New
  `app/withdrawals/request.tsx` - a live fee/net preview (flat or percent)
  honoring the backend's min/max/balance limits, blocked behind KYC using
  the backend's own blocker text (`GET /withdrawals/config` already
  returns human-readable reasons like "Complete KYC verification first.")
  rather than a link to a KYC screen - FR-1002 isn't built, so there's
  nowhere real to send the user; logged in `DECISIONS.md`. Added
  `getWithdrawalConfig()`/`createWithdrawal()` to `src/api/withdrawals.ts`.
  6 tests, proven non-vacuous (both flat and percent fee math). Verified
  live on-device against the real staging backend: the real "Complete KYC
  verification first." blocker rendered correctly and disabled the form -
  this account isn't KYC-verified, so the successful-submission path
  itself is covered only by the unit tests, not a live run.
- **FR-703 Withdrawal history → passing** (`53d9622`). New
  `app/withdrawals/history.tsx` - status history, newest first, with
  status-specific detail (PAID shows payout amount/currency/conversion
  rate, REJECTED shows the rejection reason), and a Cancel action on
  still-PENDING requests only (the held amount returns to the wallet
  server-side on cancel). Added `getMyWithdrawals()`/`cancelWithdrawal()`
  to `src/api/withdrawals.ts`. The receipt link for PAID rows is FR-704
  (separate FR), omitted. 7 tests, proven non-vacuous. Verified live
  on-device: the empty state renders correctly against the real staging
  backend (this account has no withdrawal history yet). This completes the
  withdrawals feature set reachable without Maestro or a KYC-verified test
  account (FR-701/702/703 all passing).
- **FR-1202 App settings bootstrap → passing** (`8ab2a93`).
  `AppSettingsProvider` now gates rendering - public settings, languages,
  translations, and currency rates must all settle at least once (success
  or failure - a single slow/failed endpoint doesn't block forever) before
  children render. Previously it rendered immediately with defaults and
  updated reactively, so every cold start briefly flashed raw translation
  keys and the wrong currency symbol before the real data arrived. Added
  the `GET /settings/public` fetch to the bootstrap itself (not previously
  loaded at this level) and exposed it as `publicSettings` on the context
  for FR-1203 (maintenance mode) to read later. **Load-bearing change**:
  25 existing test files mock `'../../src/api/settings'` without
  `getPublicSettings`, which now throws if called unmocked - all 25
  updated with the same one-line mock addition. 3 new tests, proven
  non-vacuous. Verified live on-device: a real cold start (force-stop,
  relaunch, fresh Metro connect) renders the full destinations screen
  correctly afterward.
- `make check`'s three layers (typecheck, lint, `jest --ci`) all pass
  clean as of this session's end - 30 suites / 125 tests.

**FR-305's Maestro blocker is still open** (see `DECISIONS.md` -
`launchApp` hangs for any app, on either available device - root-caused
to Maestro's own driver, not this project's code). Not revisited this
session; every FR picked up this session was chosen specifically because
its verification is `npm test`, not Maestro.

**Next step:** FR-306's actual mobile-side `openAuthSessionAsync` checkout
screen is still unbuilt (only its backend prerequisite shipped, see
Session 7). FR-402 (My eSIMs list) and FR-602 (gateway top-up) are natural
candidates content-wise but both Maestro-blocked until the launchApp issue
is resolved. FR-1301 (Bottom tab bar) is `npm test`-verified and
unblocked, but `app/(tabs)/_layout.tsx`'s own comment says each tab is
added only once its FR is built - Wallet exists, My eSIMs/Refer don't yet,
so still premature. FR-801 (Referral screen), FR-1102 (New ticket), and
FR-1203 (Maintenance mode - can now read the already-fetched
`publicSettings` from FR-1202's context, though `PublicSettings`'s type in
`src/api/settings.ts` only has `bangla_qr_image`/`payment_methods` so far
and will need a `maintenance_mode` field added) are all `npm test`-verified
and unblocked - good next candidates.

## Session 8 — 2026-11-05 — FR-305 implemented, manually verified live, blocked on Maestro/Vivo for the formal flip

**Did:**
- **FR-305 wallet checkout** - `src/api/orders.ts` (checkout + poll, with the
  same Decimal-string-to-number conversion fix as `wallets.ts`),
  `src/lib/waitForOrder.ts` (ported verbatim from the web), and
  `src/components/CheckoutFlowModal.tsx` (working/preparing/success/error),
  wired into `PackageBrowser.tsx`'s wallet path. 5 new tests in
  `payment-method-chooser.test.tsx`, all proven non-vacuous. Typecheck and
  lint clean.
- **Manually verified live, end-to-end, on the Vivo test device, against the
  real staging backend**: bought the cheapest Bangladesh package (~1.85 EUR)
  with the real wallet funded earlier this session - saw the real
  payment-method chooser, the real "Setting up your eSIM" working state, and
  a real success screen with a real order number
  (`ORD-20261105-E6B7E9`). The implementation works.
- **FR-305 is NOT flipped to `passing`** - its own verification command
  (`maestro test flows/checkout-wallet.yaml`) hit a reproducible
  `DeviceServerDiedException` on every `launchApp` call. Root-caused as far
  as reasonably possible this session: NOT Vivo-specific (identical failure
  on the Tecno device too), NOT app-specific (identical failure against
  Expo Go, the exact app the previously-working `flows/login.yaml` used),
  NOT an adb/OS issue (the equivalent raw `adb shell am force-stop` +
  `am start` commands both return in <0.2s). It's specifically Maestro's
  own on-device driver hanging for exactly 120s inside `launchApp`, on
  every app/device combination available - a genuine Maestro regression/bug
  in this install (v2.12.1), not anything about FR-305's code or flow. Full
  diagnostic trail in `DECISIONS.md`. Also logged in as `salman2033`
  (SUPER_ADMIN, well-funded wallet, password-based) on the Tecno device -
  a better long-term account for this flow than the Google-linked one.
- `flows/checkout-wallet.yaml` added - assumes an already-signed-in session
  (the dedicated QA account has no wallet funds; the user's recharge went to
  their personal Google-linked account instead, which Maestro can't easily
  log into - see `DECISIONS.md`).

**Next step:** resolve the Maestro `launchApp` blocker (try the Tecno
device or an emulator) so FR-305's actual verification command can run to
completion and flip it. The code itself is done and confirmed working -
this is purely a test-infrastructure gap. Once resolved, continue with
FR-306's actual mobile-side screen, FR-307/308/309 (success/preparing/
failure screen polish, building on `CheckoutFlowModal.tsx`), and FR-305
remaining blocked for a *different* reason (QA wallet funding).

## Session 7 — 2026-11-05 — FR-103 passing; FR-306 backend prerequisite done

**Did:**
- **FR-103 Google Sign-In → passing** (`1b24310`).
  `src/components/GoogleSignInButton.tsx` via
  `@react-native-google-signin/google-signin`, configured with the
  backend's existing `GOOGLE_CLIENT_ID` (the same OAuth client the web
  app's Google Sign-In already uses) - wired into both `login.tsx` and
  `register.tsx` through one shared component, since `POST /auth/google`
  already covers both sign-in and sign-up.
- Discovered mid-build that Expo's auth proxy (`auth.expo.io`) is
  deprecated and current SDK 58 guidance for Google Sign-In requires a
  real native module, which Expo Go can't run - had to switch the
  project to an `expo-dev-client` build. `app.json` gained
  `android.package`/`ios.bundleIdentifier` (`co.triptel.app`, a new
  placeholder identity - logged in `DECISIONS.md`), `eas.json` added,
  `react-native-worklets` installed (reanimated's now-separate peer
  dependency, needed for the native build to even compile).
- **FR-306's backend prerequisite is done** (separate repo,
  `D:\eSim\backend`): `POST /payments/shurjopay/order-initiate` accepts
  `mobile: bool`, marks the ShurjoPay reference `ORDERPAY-M-{id}` (no DB
  migration - reuses the existing prefix-dispatch pattern), and the
  callback redirects to the app's `triptel://payment-callback` custom
  scheme instead of the web frontend when that marker is present. 4 new
  backend tests added and proven non-vacuous (deliberately broken and
  confirmed to fail) alongside the existing 14 ShurjoPay tests - all
  passing. The actual mobile-side `openAuthSessionAsync` checkout flow
  for FR-306 is still unbuilt - only its backend prerequisite shipped.
- **Real infrastructure incident, not a code bug:** the first
  dev-client build attempt failed after 1h47m with "No space left on
  device" - drive D: (where this whole project and session live) hit 0
  bytes free. Confirmed via disk measurement this wasn't caused by this
  session's own build artifacts (~0.1 GB). User freed ~17GB and asked to
  retry.
- Also ran the full backend pytest suite (550 tests) under that same
  heavy resource contention - one test
  (`test_checkout_success_delivers_esim`) failed there but passed
  cleanly in isolation afterward; confirmed as contention-flakiness, not
  a regression from the `payments.py` change (that test exercises the
  wallet-checkout path, not the gateway code touched this session).

**Dev-client build: fixed and confirmed working.** The Windows long-path
build failure (8 attempts, `DECISIONS.md` has the full history) was
actually a Ninja version problem, not a Windows OS setting - the SDK's
default CMake 3.22.1 bundles Ninja 1.10.2, which has no Windows long-path
support at all. Fix: `app.config.js` forces `android.cmakeVersion =
'3.31.6'` (bundles Ninja 1.12.1) via `expo-build-properties`, scoped to
`win32` only so EAS's Linux cloud builds are untouched. That SDK package
had to be installed by hand (no local `sdkmanager`) - downloaded directly
from Google's SDK repository and given a hand-derived `package.xml` so
AGP recognizes it. `gradlew.bat assembleDebug` then completed with
`BUILD SUCCESSFUL` (attempt #9, ~40 min clean build). Installed the APK
on a physical Vivo device (`10EF1302BJ000R5`) via `adb`, launched it,
connected to a freshly-started Metro, and **confirmed the FR-103 Google
Sign-In button live on-device**: it renders correctly on the login screen
and tapping it opens the native Google account picker without crashing -
proof the native module, the dev-client build, and the web-client-ID
config are all wired up correctly. First actual sign-in attempt failed
with the expected error ("Google sign-in failed. Please try again.") -
no crash, a clean caught JS error consistent with Play Services'
`DEVELOPER_ERROR` (status 10), because the Android OAuth client
(package `co.triptel.app` + the debug keystore's SHA-1) wasn't yet
registered in Google Cloud Console. **User registered it and retried -
sign-in now completes successfully end-to-end**: signed in live as a
real Google account, Profile screen shows "Linked with Google", verified
email, and wallet balance rendering correctly (৳70,500.00, confirming the
earlier wallet-balance NaN fix holds on a real funded account, not just
in tests). **FR-103 is fully live-verified, not just build-verified.**

**Next step:** user has recharged the test wallet with real funds -
**FR-305 (wallet checkout) is now unblocked** and can start. FR-306's
mobile-side flow (the actual `openAuthSessionAsync` screen) is still
open.

## Session 6 (cont'd) — 2026-11-05 — FR-1201 passing

## Session 6 (cont'd) — 2026-11-05 — FR-1201 passing

**Did:**
- **FR-1201 Legal documents → passing** (`3fbb07d`). `app/legal/[slug].tsx` -
  tabs over the same 6 hardcoded slugs as the backend's `LEGAL_TITLES`
  (`app/services/legal_content_svc.py`) and the web's `LEGAL_LINKS`,
  `GET /settings/legal/{slug}` per tab.
- New shared **`src/components/LegalMarkdown.tsx`**, ported verbatim
  from the web's `frontend/src/components/LegalMarkdown.tsx`: renders
  the policy editor's markdown-lite subset (headings, bullets, bold,
  email links) as React Native elements - no HTML passthrough, since
  policy text is admin-edited.
- **Two more vacuous-test catches, same family as FR-1001's**, both in
  the markdown parsing test: a misparsed `"# The Service"` heading
  falls through to a plain paragraph at the *same block testID*,
  literal `"#"` prefix and all - a `{ exact: false }` substring check
  against that testID still passed, because `"The Service"` is still
  in there. Same shape for bullets (`"- Be nice"` misparsed merges into
  a paragraph that still contains `"Be nice"`). Fixed the heading
  check to an exact match, and the bullets check by giving each bullet
  its own per-item testID - diagnosed and fixed by deliberately
  breaking each parse branch one at a time and confirming failure
  before moving on, per `docs/Rules.md` → "Process". Worth remembering
  for any future markdown/parsing test in this codebase: a misparsed
  line often lands at the same container with an overlapping substring,
  so container-level checks need exact matches or per-item testIDs, not
  loose substring checks against shared content.

**Next step:** the user asked directly whether a connected device was
being checked this session - it wasn't, every FR since FR-1001 was
jest-only. Doing a live on-device smoke test now before picking the
next feature.

## Session 6 (cont'd) — 2026-11-05 — FR-1101 passing; FR-402 confirmed practically blocked

**Did:**
- **FR-1101 Ticket list → passing** (`3ffd420`). `app/support/index.tsx` -
  subject, reference, status badge (customer-facing labels ported from
  the web's `TicketThread.tsx` `STATUS_STYLE`), last-message date, plus
  loading/empty/error states, a "New ticket" button, and per-row
  navigation - all pointing at `FR-1102`/`FR-1103` routes that don't
  exist yet (same forward-reference pattern as FR-901/902's "Next"
  links). `src/api/support.ts` matches `serialize_ticket()` in
  `app/services/support_svc.py` exactly.
- New shared module **`src/lib/datetime.ts`**, ported verbatim from the
  web's `frontend/src/lib/datetime.ts`: `Intl.DateTimeFormat` helpers
  pinned to `Asia/Dhaka`, not the device's own timezone - the same
  reasoning the web app documents (a traveller reading an eSIM's expiry
  the moment their phone picks up a foreign timezone must see the same
  date the backend emailed them). Available for any future FR needing
  date/time display.
- The test caught a real **ICU locale quirk**, not a code bug: Node/Jest's
  `en-GB` locale abbreviates September as "Sept" (4 letters) while every
  other month uses 3 - the test's own expected string was wrong, not
  `formatDate()`.
- Proved all 6 assertions non-vacuous (status label text, the
  last-message-date field actually used, the empty-state condition, the
  error-state condition, and both navigation targets) - each deliberately
  broken one at a time and confirmed to fail, then reverted.
- **FR-402 (My eSIMs) investigated and found practically blocked**, the
  same shape as FR-305/FR-306: confirmed live against
  `GET /orders/my-esims` on `beta.triptel.co` that the QA account
  (`qa.mobile.login@triptel-test.dev`) has zero eSIM orders (`[]`).
  Building it now would mean its own Maestro verification
  (`flows/view-esim-qr.yaml`) couldn't actually exercise the tap-to-reveal
  QR / copy LPA / share behavior the FR describes - the exact kind of
  thin verification `docs/Rules.md` guards against. Left at
  `"not_started"` (same convention as FR-305/FR-306/FR-1002 - not
  formally `"blocked"` in the JSON, just documented here).

**Next step:** FR-1201 (Legal documents) - jest-only, self-contained, not
blocked by checkout or a stakeholder decision.

## Session 6 (cont'd) — 2026-11-05 — FR-401 passing

**Did:**
- **FR-401 eSIM QR component → passing** (`b84d702`). `src/components/EsimQr.tsx` -
  ported from the backend's `qr_branding.py` and the web's `EsimQr.tsx`:
  error correction H, `LOGO_RATIO = 0.22`, a circular white backing disc
  behind the logo (solved `logoBorderRadius` so `react-native-qrcode-svg`'s
  own disc-radius formula renders a true circle, not a rounded square, for
  any ring margin), the app icon (not the wordmark) as the logo.
- **The damage-tolerance test Rules.md requires** ("crop/noise the rendered
  image, confirm it still decodes") can't literally rasterize this
  component's SVG output in Jest, so it instead builds the identical QR
  module matrix via the `qrcode` package - the same encoder
  `react-native-qrcode-svg` uses internally - at the component's actual
  exported `ERROR_CORRECTION_LEVEL`/`LOGO_RATIO` constants (not re-typed
  literals), punches out the same share of it a real logo would cover,
  adds deterministic pixel noise simulating a creased/photographed
  printout, and decodes it with `jsqr`. A built-in negative control
  (level M, same logo coverage) must fail the same scenario - this is the
  exact incident `docs/Rules.md` describes.
- Proved all 4 assertions non-vacuous: downgrading `ERROR_CORRECTION_LEVEL`
  to M, raising `LOGO_RATIO` to 0.55, and breaking the circular-radius
  formula each correctly failed the corresponding test, then reverted.
- Logged in `DECISIONS.md`: the logo source is the bundled
  `assets/icon.png`, not the web's dynamic `publicSettings.favicon` -
  that settings fetch is FR-1202 (not started yet). Revisit once FR-1202
  ships.
- `make check` first failed on a missing `@types/qrcode` declaration
  (added as a devDependency, test-only).

**Next step:** FR-401 unblocks FR-402 (My eSIMs), FR-307 (purchase
success), FR-404 (receipt PDF), FR-501 (public tracking) - all reuse this
component.

## Session 6 (cont'd) — 2026-11-05 — FR-902 passing

**Did:**
- **FR-902 eSIM setup guide → passing** (`f326af5`). `app/guides/esim-setup-guide.tsx` -
  static content, no API call, ported verbatim from the web's
  `frontend/src/app/guides/esim-setup-guide/page.tsx`: 6-step iOS and
  5-step Android install instructions, "install only once" warning,
  "if it's not connecting" troubleshooting checklist.
- **Caught a second, differently-shaped vacuous test** while writing the
  navigation test: pressing two different buttons that both push
  `/support` (the warning box's Support link and the troubleshooting
  list's Support link) and asserting `expect(mockPush).toHaveBeenCalledWith('/support')`
  after each press - but `toHaveBeenCalledWith` checks whether *any* call
  ever matched, not the most recent one. So when I deliberately broke the
  second button to push the wrong route, the assertion still passed
  (satisfied by the *first* button's earlier, correct call). Fixed with
  `toHaveBeenNthCalledWith(n, ...)` + a final `toHaveBeenCalledTimes(4)`,
  confirmed it now genuinely fails on the broken button, reverted.
  `docs/Rules.md` → "Process" already states the general principle
  ("prove the negative before trusting the positive") broadly enough to
  cover this - no doc change needed, just a second concrete instance of
  why that rule exists.

**Next step:** re-assess `feature_list.json` for the next unblocked item -
FR-402 (My eSIMs) is Maestro-only and needs the QA account's order
history (unconfirmed); FR-1101 (ticket list) and FR-1201 (legal docs) are
other static/self-contained candidates worth checking against their real
backend routes first.

## Session 6 (cont'd) — 2026-11-05 — FR-901 passing

**Did:**
- **FR-901 Compatible-phones / eSIM-support check → passing** (`6805048`).
  `app/guides/compatible-phones.tsx` - static content, no API call, ported
  verbatim from the web's `frontend/src/app/guides/compatible-phones/page.tsx`:
  the brand-grouped device list, the *#06#/EID dial-check copy, and the
  manual iOS/Android fallback instructions.
- Added `expo-video` for the embedded check-video (documented in
  `docs/Technical_Requirements.md`). The video source is hardcoded to the
  web app's own production static asset
  (`https://triptel.co/guides/check-esim-support.mp4`) rather than derived
  from `EXPO_PUBLIC_API_URL` - it's a public guide asset, not part of the
  `/api/v1` backend the beta/production split applies to. Logged as a
  judgment call in `DECISIONS.md`.
- First `make check` run caught two real `eslint` `no-require-imports`
  warnings in the test's `expo-video` jest mock (needed `require()` inside
  the mock factory to reach `react`/`react-native` safely under Jest's
  mock-hoisting rules) - fixed with scoped
  `eslint-disable`/`eslint-enable` comments around just those two lines,
  confirmed clean, then re-ran `make check` green (15 suites / 51 tests).
- Proved all 4 of the new test's assertions non-vacuous: broke the EID
  wording, removed the Samsung Galaxy device group, and swapped the
  "next guide" navigation target one at a time, confirming each caused the
  corresponding assertion (and only that one) to fail, then reverted.

**Next step:** FR-902 (eSIM setup guide) is the natural sibling - also
static content, no API call, same porting approach from the web's
`frontend/src/app/guides/esim-setup-guide/page.tsx`.

## Session 6 — 2026-11-05 — FR-1001 passing; FR-1002 confirmed blocked, FR-901 next

**Did:**
- **FR-1001 Profile screen → passing** (`48b518b`). `app/(tabs)/profile.tsx`:
  avatar/initial fallback, name/username/role badge, Google-linked badge,
  email + verified badge, spendable wallet mini-view (DEFAULT+REWARD,
  excluding frozen and COMMISSION, via `formatPrice`), editable
  phone/WhatsApp (`PUT /auth/me/preferences`), sign out. Registered as a
  tab in `app/(tabs)/_layout.tsx`.
- Caught and fixed a **vacuous test**: the wallet-balance test originally
  asserted `.toContain('15.00')` against a correctly-computed €15.00
  balance - but a broken filter that also included the €100 COMMISSION
  wallet produces "115.00", which *also* contains the substring "15.00",
  so the revert-check would have silently passed. Fixed to an exact
  `.toBe('৳15.00')`, confirmed it now genuinely fails on the broken filter,
  then audited every other `.toContain()` numeric assertion in the suite
  for the same overlap risk (none had it).
- Confirmed **FR-1002 (KYC)** is explicitly flagged in
  `docs/Functional_Requirements.md` ("Confirm with stakeholders whether
  this ships in the first release or is deferred") - not attempting it
  without that decision, per the same "don't guess silently" discipline
  as FR-305/FR-306. Still blocked, unchanged from prior session.
- Started **FR-901** (Compatible-phones / eSIM-support check) - static
  content, no API call per the FR doc. Researching the web app's
  equivalent page/component to port its device list, dial-check
  instructions, and video embed verbatim rather than inventing content.

**Next step:** finish FR-901 using the ported web content, verify, commit,
flip to passing. Then FR-902 (eSIM setup guide, also static/no-API) is a
natural follow-on. FR-1301 (tab bar) becomes more worth doing once a few
more tabs exist. FR-305/FR-306/FR-1002 remain the three blocked items -
do not attempt without new information from the user.

## Session 5 (cont'd) — 2026-11-05 — FR-303, FR-304 passing; genuinely blocked on FR-305/FR-306

**Did:**
- **FR-303 Discount code entry (post-login) → passing.** `previewDiscount()`
  wired into `PackageBrowser` as a "See exact price" action per card, once
  signed in with a code checked. Required adding `AuthProvider` + an
  `expo-secure-store` mock to every existing test that renders
  `PackageBrowser` (directly or via `app/explore/[slug].tsx`) - it now calls
  `useAuth()`, which throws without a provider.
- **FR-304 Payment method choice → passing.** `src/api/wallets.ts`
  (`getMyWallets`) + `src/components/PaymentMethodChooser.tsx`. "Buy Now"
  re-checks the real wallet balance on every tap and either opens the
  chooser or goes straight to the gateway - scoped to the *decision* only,
  picking Wallet/Gateway just records the choice for now. Manually verified
  live: the QA account's 0 wallet balance correctly routed to "continuing to
  card/mobile banking" with no chooser.

**Stopped here, not by choice but because the next two items are genuinely
blocked, not just more work:**
- **FR-305 (Wallet checkout)** calls `POST /orders/checkout` with
  `payment_method=WALLET` - a real, non-reversible order against the beta
  database. Can't be exercised live at all right now: the QA account
  (`qa.mobile.login@triptel-test.dev`) has a 0 wallet balance and no way to
  fund it from this session (no admin access, no real payment method to top
  up with). Automated tests alone aren't enough confidence for an endpoint
  that moves (fake, but real-looking) money - this needs either a funded QA
  wallet or a deliberate call to proceed on mocked verification only.
- **FR-306 (Gateway checkout / ShurjoPay)** hits the open question
  `docs/Architecture.md` → "Payment" flags explicitly: how does ShurjoPay's
  redirect hand control back to a mobile app (custom-scheme deep link vs.
  manual-return-then-poll)? That doc says in so many words: "don't guess
  silently in code." Picking one is a real architecture decision, possibly
  needing a backend change (a per-request return URL on
  `POST /payments/shurjopay/order-initiate`), not something to default
  without it being a deliberate, recorded choice.

**Next step:** resolve the two blockers above before FR-305/FR-306 - either
in `DECISIONS.md` (the ShurjoPay mechanism) or by sorting out a funded QA
wallet for live verification. Everything else in `feature_list.json` that
doesn't depend on checkout (FR-104's sibling items, FR-1xxx profile/KYC,
FR-9xx guides, FR-1301 tab bar, etc.) is still open and unblocked - a
reasonable place to keep going before circling back to checkout.

## Session 5 (cont'd) — 2026-11-05 — FR-301, FR-302 passing

**Did:**
- **FR-301 Package list & filters → passing.** `src/components/PackageBrowser.tsx`
  - the "choose" state of the web's checkout state machine
  (`docs/Architecture.md`), scoped to display + filter chips only, no Buy Now
  yet. `app/explore/[slug].tsx` (FR-203) refactored to use it instead of its
  own inline list - updated and re-ran FR-203's test to confirm it still
  passes after the extraction.
- **FR-302 Discount code entry (pre-login) → passing.** `DiscountCodeBox.tsx`
  + `estimateDiscount()` wired into `PackageBrowser`, ported verbatim from
  the web's own component/formula. Found the backend route's own module
  docstring claims it's authenticated — the actual FastAPI handler has no
  auth dependency; trusted the running code over the comment. Manually
  verified against live beta: a made-up code correctly came back "That
  discount code isn't valid."
- Both: wrote the test first, confirmed it fails when reverted before
  restoring. FR-302 needed a `max_discount_amount` cap check specifically
  (a generic "does filtering work" test wouldn't have caught a missing cap).

**Next step:** FR-303 (Discount code entry, post-login) is the natural next
- same `PackageBrowser`, but needs a signed-in user and `POST
  /discounts/preview` (exact, server-verified amount vs. FR-302's estimate).
  After that, FR-304 (payment method choice) starts needing `GET
  /wallets/my-wallets`, which doesn't have a wrapper yet.

## Session 5 — 2026-11-05 — FR-101, FR-104, FR-105, FR-202, FR-203 passing

**Did** (user asked to keep committing/continuing through FRs without
stopping to check in each time):
- **FR-101 Register → passing.** `app/auth/register.tsx`, `register()` in
  `src/api/auth.ts`. `flows/register.yaml` generates a unique email/username
  per run via `evalScript` (the backend rejects duplicates) and reused every
  device-interaction lesson from `flows/login.yaml` - passed clean on the
  first try.
- **Skipped FR-103 (Google Sign-In)** - needs a real `GOOGLE_CLIENT_ID` this
  session has no way to provision (Google Cloud Console project access).
  Left `not_started` rather than half-build against a backend that 503s it.
- **FR-104 Forgot/reset password → passing.** Both screens
  (`forgot-password.tsx`, `reset-password.tsx`) - the reset-password one
  honors a `?token=` param for when deep-linking exists, with manual entry
  as the fallback now (no deep-link interception yet, see CLAUDE.md).
- **FR-105 Forced password change → passing.** `set-password.tsx`. Found
  while building this: `GET /auth/me` never returns `must_change_password` -
  only login/register do - so `AuthContext` can't rediscover it on session
  restore. Not a bug to fix here: the backend enforces the real boundary
  server-side regardless (`require_password_changed`), same as the web app.
  Full writeup in `DECISIONS.md`.
- **Skipped FR-106 (resume purchase after login)** - needs the checkout
  screens (FR-301+) to exist first; nothing to resume into yet.
- **FR-202 Full destination directory → passing.** `explore/destinations.tsx`
  (`SectionList`, grouped by region, client-side filter). Linked from Home.
  Manually found the backend's `region` field is empty for every country on
  beta right now - everything groups into "Other destinations" today. Not a
  bug in this code; will group correctly once the backend populates it.
- **FR-203 Country landing screen → passing.** `explore/[slug].tsx` -
  `GET /catalog/destinations/{slug}` in one call. **This is also where
  `AppSettingsContext` got real currency conversion** (`convert`/
  `convertTo`/`formatPrice`, `GET /settings/rates`), deferred from FR-201 -
  ported from the web's `AppSettingsContext` verbatim. Manually verified
  against real Japan data on-device: 21 packages, correct BDT prices,
  correct cheapest price, "Recommended" badges.
- Every feature this session: wrote the test first, confirmed it actually
  fails when the behavior is reverted (not vacuous - see `docs/Rules.md` →
  "Process"), then restored it. FR-203's cheapest-price test needed its
  fixture reordered (featured/pricier item first) to actually be capable of
  catching a `products[0]`-instead-of-minimum bug - worth remembering for
  any future "pick the min/max from a list" test.

**Next step:** `feature_list.json` → FR-301 (Package list & filters) is the
natural next pick - the package cards already exist inside FR-203's screen,
FR-301 is about adding filter chips (data size/validity) and likely
extracting a shared `PackageBrowser` component per `docs/Architecture.md`'s
folder layout, since the full checkout state machine will need the same
component later. FR-106 and FR-103 are still blocked (see above) - check
before resuming them.

## Session 4 — 2026-11-05 — FR-102 (Login) passing; Maestro CLI set up

**Did:**
- Built `app/auth/login.tsx` (email-or-username + password, routes to `/` or
  `/auth/set-password` based on `must_change_password`), extended
  `src/api/auth.ts` with `login()`/`AuthToken`. Test:
  `__tests__/auth/login.test.tsx`, 3 cases, each confirmed to fail when
  reverted. Also fixed an un-awaited `fireEvent` bug in this file and
  `__tests__/explore/home.test.tsx` (testing-library v14's
  `fireEvent.changeText`/`.press` are async).
- **FR-102 → passing** (evidence `a9838a2`) — the harder part this session
  was getting `flows/login.yaml` (the e2e half of FR-102's verification
  command) to actually pass. Installed Maestro CLI
  (`C:\maestro\bin`, on `PATH`), registered a dedicated beta-only QA account
  (`qa.mobile.login@triptel-test.dev`) for it to log in with. Hit a long
  chain of environment issues before getting a clean run — full writeup,
  including the JDK 17 requirement and the retry pattern needed on this
  machine, is in `DECISIONS.md`. Short version: **this machine's Maestro
  setup needs `JAVA_HOME` pointed at a JDK 17 install
  (`C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot`), and the
  adb/USB (and wireless-adb) connection to the physical test device is
  genuinely flaky — expect to retry `maestro test` a few times**, that's
  environmental, not a sign the feature broke.
- Fixed `Makefile`'s `e2e` target, which called `npx maestro` — Maestro
  Mobile isn't an npm package, it's the standalone CLI above. Separate
  commit (`fix(e2e): ...`).

**Next step:** `feature_list.json` — FR-101 (Register) is the natural next
auth item (same screen pattern as Login, same QA-account approach works for
its own e2e flow), or FR-103/104/105 round out the rest of the auth group.
Check `feature_list.json` for current state before picking.

## Session 3 — 2026-11-05 — FR-201 (Home / destination search) passing; Expo Router wired

**Did:**
- Picked FR-201 over FR-101/FR-102 (the prior session's guess) — reasoning
  and tradeoffs in `DECISIONS.md`. This is also where Expo Router actually
  got wired up (`app/_layout.tsx`, `app/(tabs)/_layout.tsx`): the classic
  `App.tsx`/`index.ts` scaffold entry is gone, `package.json`'s `main` is now
  `expo-router/entry`.
- Shipped `src/api/catalog.ts`, `src/api/settings.ts`, a partial
  `src/state/AppSettingsContext.tsx` (i18n only, no currency yet — see
  `DECISIONS.md`), and `app/(tabs)/index.tsx` (live debounced search +
  Popular Destinations grid). Test: `__tests__/explore/home.test.tsx`, 2
  cases, both confirmed to actually fail when reverted.
- **FR-201 → passing** (evidence `ee6fe81`).
- Found and fixed two more `init.sh` gaps (on top of Session 2's), both only
  surfaced by actually running on the connected device, not by the test
  suite:
  - `@react-native-async-storage/async-storage` was installed via plain `npm
    install` in `init.sh` instead of `expo install`, landing v3.1.1 — too new
    for Expo Go's bundled native module (runtime error: "Native module is
    null, cannot access legacy storage"). Re-installed via `expo install` →
    pinned to 2.2.0. **If a future session adds another native-module
    dependency (anything with native Android/iOS code, not pure JS), always
    use `npx expo install <pkg>`, never plain `npm install` — this is the
    second time plain `npm install` landed an SDK-incompatible native module
    version; `docs/Technical_Requirements.md`'s dependency table doesn't
    currently flag which listed packages are native vs. pure JS.**
  - `expo-router` needs a set of peer dependencies `init.sh` never installed
    (`react-native-safe-area-context`, `react-native-screens`'s full
    companion set, `react-native-gesture-handler`, `react-native-reanimated`,
    `expo-linking`, `expo-symbols`, `@expo/metro-runtime`) — only breaks once
    a route under `app/` actually gets exercised, so F-000/FR-107's checks
    never caught it. Installed via `expo install`.
- **Operational note for next session:** `npx expo start` run via a
  backgrounded shell task does not reliably get killed by stopping the task
  (`TaskStop`/killing the wrapper) — the underlying Metro `node` process can
  survive as an orphan and keep serving a stale bundle/cache. If the device
  shows a stale screen or a resolver error (`Unable to resolve ...`,
  `Failed to get the SHA-1 for ...`) after a structural change (entry point,
  a native dependency's version), check `Get-Process node` for a
  long-running orphan and `taskkill //PID <id> //F` it before starting a
  fresh `expo start -c`. Also: the CLI's own "Opening exp://... on <device>"
  line does not reliably make the device actually fetch the new bundle on
  its own — forcing it via
  `adb shell am force-stop host.exp.exponent && adb shell am start -a android.intent.action.VIEW -d "exp://<ip>:8081"`
  was needed every time in this session.

**Next step:** `feature_list.json` — next `not_started` auth item (FR-101
Register or FR-102 Login) now has a real place to land post-auth (`/(tabs)`),
so the chicken-and-egg problem from Session 2 is gone. Check
`feature_list.json` for the current `active`/`not_started` state before
picking.

## Session 2 — 2026-11-04 — F-000 and FR-107 (session restore) passing

**Did:**
- Confirmed the device-run step from Session 1: started `npx expo start
  --android` against the connected USB device (adb device `10EF1302BJ000R5`,
  model V2344), confirmed Expo Go installed and the JS bundle launched, and
  pulled a screenshot via `adb shell screencap` to verify the blank-template
  screen actually renders on-device (the first `adb exec-out screencap | >`
  attempt through PowerShell corrupted the PNG via text-mode redirection —
  route through `/sdcard` + `adb pull` instead).
- **F-000 → passing** (evidence `24e87b9`): `make check` is green and the app
  boots on a connected device.
- **FR-107 (session restore on app start) → passing** (evidence `dd5f159`):
  added `src/lib/apiClient.ts` (shared fetch wrapper + `ApiError`),
  `src/api/auth.ts` (`GET /auth/me` wrapper, typed from the actual backend
  route in `D:\eSim\backend\app\api\v1\auth.py` — its response doesn't match
  the `UserResponse` schema, it predates it), and `src/state/AuthContext.tsx`
  (restore-on-mount, 401 clears the token, `signIn`/`signOut` for FR-101/102
  to use later). Test: `__tests__/auth/session-restore.test.tsx`, 3 cases
  (valid token restores, no token skips the network call, 401 clears the
  token) — each confirmed to actually fail when the corresponding behavior is
  reverted, not just pass when present (see `docs/Rules.md` → "Process").
- Fixed two infra gaps found while building this: `jest-expo` was missing its
  `@react-native/jest-preset` peer dependency (installed it, wired
  `"jest": {"preset": "jest-expo"}` into `package.json`), and no FR's
  `npm test -- <path>` verification command could run because `package.json`
  had no `test`/`typecheck` scripts (added them). Both recorded in
  `DECISIONS.md`.
- Judgment call: `AuthContext` calls `getMe` directly on mount rather than
  through a `useQuery` hook (a one-line deviation from
  `.claude/skills/new-api-integration/SKILL.md` step 6) — session restore has
  to resolve before the app knows what to render, which doesn't fit the
  query-cache model as cleanly as a screen's own data fetch. See
  `DECISIONS.md` for when to revisit.

**Next step:** `app/_layout.tsx`/Expo Router wiring (switching the entry point
off the classic `index.ts`/`App.tsx` and actually mounting `AuthProvider`) was
deliberately left for whichever FR builds the first real screen — FR-107's own
verification command is a unit test on the context in isolation and doesn't
need it. Likely next: FR-102 (Login) or FR-101 (Register), since FR-107
already covers the restore half of the auth loop; check `feature_list.json`
for the next `not_started` auth item before starting.

## Session 1 — 2026-11-04 — `init.sh` run, app scaffolded and verified

**Did:**
- Ran `init.sh`. `create-expo-app` refuses to scaffold into a non-empty
  directory, and this repo already had the harness files checked in, so it
  aborted immediately (no files written). Worked around it by scaffolding into
  a temp dir and merging the generated app files (`App.tsx`, `app.json`,
  `index.ts`, `tsconfig.json`, `package.json`/`package-lock.json`, `assets/`)
  into the repo by hand — skipping the generic `AGENTS.md`/`.claude`/`LICENSE`
  the scaffold also produces, since this repo already has its own.
- Installed the core deps (`expo-router`, `expo-secure-store`,
  `expo-web-browser`, `expo-image-picker`, `expo-sharing`, `expo-print`,
  `react-native-svg`, `@tanstack/react-query`, `zustand`,
  `@react-native-async-storage/async-storage`, `react-native-qrcode-svg`) and
  dev deps (`typescript`, `eslint`, `prettier`, `eslint-config-prettier`,
  `jest`, `jest-expo`, `@testing-library/react-native`, `@types/react`) from
  `docs/Technical_Requirements.md`.
- Hit an `ERESOLVE` peer-dependency conflict (expo-router's web/radix-ui tree
  vs. npm 11's strict resolver) installing the first batch of extra deps —
  added `.npmrc` (`legacy-peer-deps=true`) to fix it repo-wide. Recorded in
  `DECISIONS.md`.
- Added `@types/jest` + `"types": ["jest"]` in `tsconfig.json` so the smoke
  test typechecks (init.sh's dep list didn't include it).
- No `eslint.config.js` existed yet (ESLint 10 needs the flat-config format;
  init.sh installs eslint/prettier but never writes a config) — ran
  `npx expo lint`, which generated `eslint.config.js` via
  `eslint-config-expo` and, as a side effect, pinned `eslint` back to `^9.0.0`
  (the config package doesn't yet support ESLint 10).
- Renamed the app from the scaffold's placeholder (`triptel-scaffold`) to
  `triptel-user-app` / `"Triptel"` in `package.json`/`app.json`.
- `make`'s binary isn't on PATH in this shell, so ran the three `check`
  commands directly: `npx tsc --noEmit`, `npx eslint . --max-warnings=0`,
  `npx jest --ci` — all clean. Layer 3 (Maestro `make e2e`) still needs a
  connected/booted device, not run yet.
- Committed: `init: runnable Expo app, one passing test`.

**Known rough edges, not fixed (not needed yet):**
- `docs/Technical_Requirements.md` also lists `date-fns` as a core dependency;
  `init.sh` doesn't install it. Left alone — add it when the first screen
  needs date formatting, not speculatively.
- No Jest config/preset (`jest-expo`) wired up in `package.json` yet — the
  smoke test is plain JS and doesn't need it. Will be needed the first time a
  real RN component test lands under `__tests__/`.
- `make` isn't available in this shell (Windows/Git Bash) — use the `npx`
  commands from `docs/Technical_Requirements.md` → "Verification commands"
  directly, or run via WSL/a shell with `make` on PATH.

**Next step:** start `F-000` (project initialized — mark it via its own
verification command, not by hand), then `FR-107` (session restore), per the
prior session's note — almost everything downstream needs auth.

## Session 0 — 2026-11-04 — Harness written, no app code yet

**Did:**
- Created this repo (`D:\eSim\Triptel-MobileApp`), independent git history from
  the main `D:\eSim` web+backend monorepo.
- Explored the live Triptel web app + backend end to end (every consumer route,
  API endpoint, model, and service — explicitly excluding admin/merchant/agent
  panels) to make sure the harness docs don't miss a user feature.
- Wrote the full harness: `CLAUDE.md`, `AGENTS.md`, `docs/Architecture.md`,
  `docs/Rules.md`, `docs/Technical_Requirements.md`,
  `docs/Functional_Requirements.md` (50 FR items), `docs/Non_Functional_Requirements.md`,
  `feature_list.json` (one item per FR, all `not_started`), `DECISIONS.md`,
  `init.sh`, `.claude/settings.json`, a destructive-command hook, and two skills
  (`new-screen`, `new-api-integration`).
- Stack decided: Expo (managed) + TypeScript + Expo Router + TanStack Query +
  Zustand + `expo-secure-store` + `react-native-qrcode-svg` + `expo-web-browser`.
  Full rationale in `docs/Architecture.md`; decision record in `DECISIONS.md`.

**No feature code exists yet.** `F-000` (project initialized) is `not_started`.

**Known open questions, flagged not solved:**
- How ShurjoPay hands control back to the app (custom-scheme redirect vs. manual
  return + poll) — needs resolving before FR-306/FR-602 are built. See
  `docs/Architecture.md` → "Payment".
- Whether KYC (FR-1002) ships in the first release or is deferred — most users
  never withdraw. Flagged for a stakeholder call before FR-702/FR-1002.
- Push notifications and deep links are backend gaps, not app gaps — don't try to
  build around them; see `CLAUDE.md` → "Known Gaps".

**Next step:** run `init.sh` to produce a runnable Expo app with one passing test,
then start `F-000`, then `FR-107` (session restore) before anything that needs
auth, since almost everything downstream depends on it.
