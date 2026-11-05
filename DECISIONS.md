# Decisions

One entry per judgment call that wasn't obvious from the task, newest on top.
Each entry: what was decided, why, and what would make it worth revisiting.

---

## 2026-11-05 — Found live on-device: wallet balance showed "NaN" (FR-304/FR-1001 regression)

**Found doing a live device smoke test** (the user asked directly whether a
connected device was being checked - it wasn't, for every FR since FR-1001
this session): the Profile screen's wallet balance rendered "৳NaN" against
the real QA account, not the correct €0.00.

**Root cause:** `WalletResponse.balance` is a `Decimal` on the backend
(`app/schemas/wallet.py`), which FastAPI/Pydantic serializes to JSON as a
**string** (e.g. `"0.00"`), not a number - the same pattern already handled
in `discounts.ts` for `/discounts/preview`. `src/api/wallets.ts` typed
`balance: number` but never parsed it. Both consumers summed wallets with
`.reduce((sum, w) => sum + w.balance, 0)` - JS's `+` does string
concatenation the instant either side is a string, so `0 + "0.00"` produces
the string `"00.00"`, not the number `0`. `formatPrice()` then multiplies
that (safe, coerces) but the concatenated multi-wallet result is no longer
a valid numeric string, so `Number(...)` returns `NaN`.

**Fixed** by parsing `balance` to a real `Number` once, inside
`getMyWallets()` itself, so every consumer (Profile's mini-view,
`PackageBrowser`'s wallet-vs-gateway spendable check from FR-304) gets a
correct number. Added `__tests__/api/wallets.test.ts` - mocks `fetch`
directly (not `getMyWallets`) so it actually exercises the JSON string ->
number conversion, which every screen-level test's mocked `getMyWallets`
fixture had been skipping past with clean numeric fixture data.

**Real-world impact this had already shipped**: `PackageBrowser`'s "Buy Now"
spendable check (`spendable >= payableAmount`) compared `NaN >= amount`,
which is always `false` - meaning a real user with actual wallet funds
would never have been offered the Wallet payment option, silently routed
to gateway every time. `FR-304` was marked `passing` entirely on jest tests
that mock `getMyWallets` with clean numeric data, never catching this.

**Broader note, not acted on now:** other `Decimal` fields from this
backend (e.g. `ProductResponse.retail_price`) have the same string-on-the-
wire shape, but are currently only used with `*`/`-`/comparison, which
coerce a numeric string correctly in JS - only `+`/`.reduce`-style summing
is the dangerous case. No other instance found. Worth remembering for any
future money-summing code (FR-601 wallet overview, cart/order totals):
parse `Decimal` fields to `Number` explicitly at the API boundary, the same
way `discounts.ts` and now `wallets.ts` do - don't trust the TS `number`
annotation alone.

## 2026-11-05 — FR-401's `EsimQr` logo is the bundled `assets/icon.png`, not the dynamic branding settings

**Decided:** `src/components/EsimQr.tsx` always uses the locally bundled
`assets/icon.png` as the center logo, via a plain `require()`. The web's
`EsimQr.tsx` instead reads `publicSettings.favicon || publicSettings.logo_light`
from `GET /settings/public` at runtime, so an admin can swap the brand mark
without a redeploy.

**Why:** That dynamic branding source doesn't exist in this app yet - it's
FR-1202 (App settings bootstrap), still `not_started`. FR-401's own behavior
is about the QR's rendering safety (error correction H, 22% logo ratio,
circular backing, decode-survival), not about where the logo image comes
from, and the hard constraint is "app icon, not wordmark" - satisfied either
way since `assets/icon.png` is literally configured as the app's own icon in
`app.json`.

**Revisit when:** FR-1202 ships. At that point `EsimQr` should likely accept
an optional `logoUri` prop that callers pass from `publicSettings`, falling
back to the bundled icon only if that settings fetch hasn't resolved yet -
matching the web's fallback chain.

## 2026-11-05 — FR-901's embedded video is a hardcoded production web URL

**Decided:** `app/guides/compatible-phones.tsx` points its `expo-video` player
directly at `https://triptel.co/guides/check-esim-support.mp4` - the web app's
own static asset, same one `frontend/src/app/guides/compatible-phones/page.tsx`
embeds - rather than deriving it from `EXPO_PUBLIC_API_URL`.

**Why:** `docs/Rules.md`'s "real backend" / beta-vs-production split is about the
`/api/v1` backend this app talks to for data, not static marketing/guide assets
served from the web app's own public folder. That video isn't part of the API at
all - it's the same public file regardless of whether the app is pointed at beta
or production for everything else, so there's no beta equivalent to prefer.

**Revisit if:** the web app ever moves guide assets behind the API domain, or a
CDN/base-URL is introduced for static content - then this should read from that
instead of a hardcoded literal.

## 2026-11-05 — `must_change_password` can't be rediscovered on session restore; `AuthContext` only knows it from login/register

**Found/decided building FR-105 (forced password change):** `GET /auth/me`
(`app/api/v1/auth.py` on the backend) never returns `must_change_password` -
only `POST /auth/login`, `/auth/register`, and `/auth/google` do, via the
`Token` response. So `AuthContext`'s `mustChangePassword` state is only ever
set at sign-in time (`signIn(token, user, mustChangePassword)`); session
restore (FR-107, which only has `GET /auth/me` to work with) always resets it
to `false`, whether or not a real must-change-password account closed the
app with the flag still outstanding.

**Why this is OK, not a bug to route around:** the client-side gating this
powers (hiding checkout/wallet UI) is UX, not the security boundary - the
backend enforces the real one server-side via `require_password_changed`
(`app/core/deps.py`), applied to every checkout/wallet endpoint regardless of
what the client thinks. Confirmed the web app has the identical limitation
(`D:\eSim\frontend\src\app\auth\login\page.tsx` is the only place it reads
the flag) - this is a pre-existing backend gap, not something introduced
here, and not worth a client-side workaround (e.g. persisting the flag
locally) when the server already covers the real case.

**Revisit if:** the backend ever adds `must_change_password` to `GET
/auth/me`'s response - then `AuthContext`'s restore effect should start
reading it from there instead of hardcoding `false`.

## 2026-11-05 — Maestro CLI setup on this Windows dev machine: use JDK 17, expect connection flakiness, retry pattern for flows

**Decided/learned getting FR-102's e2e flow (`flows/login.yaml`) to actually
pass, worth recording so a future session doesn't re-discover all of this:**

1. **Maestro needs JDK 17, not whatever newer JDK happens to be on PATH.**
   This machine's default Java was JDK 23; Maestro's own `logSystemInfo`
   couldn't even parse its version string ("Java Version: 0"), and every
   `launchApp`/`openLink` call hung for exactly ~120s before
   `DeviceServerDiedException`. Installed Temurin 17
   (`C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot` via
   `winget install --id EclipseAdoptium.Temurin.17.JDK`) and ran Maestro with
   `JAVA_HOME`/`PATH` pointed at it explicitly - this took the hang rate from
   ~100% to intermittent. **Any future session invoking `maestro` on this
   machine should set `JAVA_HOME` to the JDK 17 install first**, e.g.:
   `export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-17.0.21.9-hotspot"`
   `export PATH="$JAVA_HOME/bin:$PATH:/c/maestro/bin"`
2. **The remaining flakiness is a real, confirmed connection problem, not an
   app or flow bug.** Traced it to the adb/USB (and, to a lesser extent,
   wireless-adb) connection to the physical test device dropping mid-run - at
   one point Maestro's own log showed a literal
   `device '...' not found` mid-flow. Both transports on this network flap in
   and out on a sub-second-to-several-second timescale. Mitigation: if
   `maestro test flows/*.yaml` hangs or reports a connection error, just
   retry (`adb devices -l` to confirm a device shows `device` state, then
   re-run) - this is expected on this machine/network until the underlying
   USB/Wi-Fi instability is fixed, not a signal the feature regressed. One
   full clean run (every step `COMPLETED`, final assertion `COMPLETED`) is
   enough to trust the flow - don't chase a 100% pass rate on retries here.
3. **Flow-writing lessons for every future `flows/*.yaml`** (applied in
   `flows/login.yaml`, worth reusing):
   - `launchApp` defaults to force-stopping the app first, which triggers a
     full cold bundle reload from Expo Go and raced badly with an immediately
     following `openLink` (landed on a nonsense `triptel:///` "Unmatched
     Route" screen once). Use `launchApp: { stopApp: false }` when the app is
     already running against the right dev server.
   - ...but `stopApp: false` means React component state (e.g. a controlled
     `TextInput`'s value) can carry over from a previous run of the *same*
     flow file run back-to-back - without clearing it first, a second
     `inputText` call appends to/interleaves with old text instead of
     replacing it. Always `tapOn` the field, `eraseText: 500`, then
     `inputText`.
   - Android's native autofill can show two different system dialogs around
     a real login form: "Use your saved password for X?" (can block the
     password field) and "Save password to Google?" (can cover the screen
     right after submit). Both need an `optional: true` dismiss step
     (`tapOn: { text: "No thanks"/"Not now", optional: true }`) since they
     won't appear on every device/account/run.
   - `hideKeyboard` isn't supported on every device/keyboard combination
     (failed outright on the Tecno test device) - always mark it
     `optional: true` rather than let it hard-fail the flow.
4. **Registered a dedicated beta-only QA account**
   (`qa.mobile.login@triptel-test.dev`, directly via `POST /auth/register`
   against `https://beta.triptel.co`) for `flows/login.yaml` to log in with.
   Never a real customer account, never pointed at production. Future e2e
   flows that need a signed-in state (checkout, wallet, etc.) should reuse
   this account rather than minting a new one per flow, to keep the number of
   throwaway accounts on beta small.
5. **Makefile's `e2e` target now calls `maestro` directly** (not
   `npx maestro`, which isn't an npm package - separate fix, see the
   `fix(e2e)` commit). Maestro itself was installed to `C:\maestro\bin`
   (added to the user `PATH` via `setx`/`[Environment]::SetEnvironmentVariable`),
   downloaded from the GitHub releases zip per
   `docs.maestro.dev/maestro-cli/how-to-install-maestro-cli`.

**Revisit if:** the connection flakiness gets bad enough to block routine
`make verify` runs - worth trying a USB hub/cable swap, or investigating
whether Windows' USB selective-suspend or the Wi-Fi adapter's power-saving
mode is the actual root cause before accepting this as permanent.

## 2026-11-05 — Built FR-201 (Home) before FR-101/FR-102 (Register/Login); wired Expo Router now; `AppSettingsContext` ships without currency conversion yet

**Decided (three calls made while picking and building the next feature after
FR-107):**

1. Built FR-201 (Home / destination search) next, not FR-101/FR-102 as the
   prior session's progress note guessed. Reason: `GET /catalog/countries` is
   public - Home doesn't need an authenticated-vs-not routing decision to
   render, while Login/Register do (where does a signed-in user land when
   `/(tabs)/index.tsx` - the literal Home/Explore route in
   `docs/Architecture.md`'s folder layout - doesn't exist yet?). Building
   Home first gives Login/Register a real destination to redirect into
   instead of a throwaway stub screen.
2. This is also the point `app/_layout.tsx`/Expo Router got wired in (root
   `Stack` via `Slot`, providers: `QueryClientProvider`, `AppSettingsProvider`,
   `AuthProvider`; `app/(tabs)/_layout.tsx` with only the Explore tab
   registered) and the classic entry (`App.tsx`/`index.ts`) removed in favor
   of `"main": "expo-router/entry"` - deliberately deferred from F-000/FR-107
   since neither needed a real screen to exist.
3. `src/state/AppSettingsContext.tsx` (the RN port of the web's
   `AppSettingsContext`) currently only carries `lang`/`t()`/`languages`/
   `isRTL` - not `currency`/`convert`/`convertTo`/`formatPrice`/`me`/
   `publicSettings` from the web version `docs/Architecture.md` describes.
   Home shows no money, so there was nothing to convert yet.

**Why these are recorded:** (1) and (2) reverse what the prior session's
progress note suggested would be next - worth knowing why. (3) is a partial
port of a file `docs/Architecture.md` describes as one piece; a future
session reading just the architecture doc could reasonably expect the full
surface to already exist.

**Revisit:** add `convert`/`convertTo`/`formatPrice` (and `me`/`publicSettings`
if something needs them) to `AppSettingsContext` the first time a screen needs
to show a price - likely FR-203 (country landing, shows "from €X") or FR-301
(package list) - port them from `D:\eSim\frontend\src\lib\AppSettingsContext.tsx`
verbatim, same formula (`CURRENCY_SYMBOLS`, `ZERO_DECIMAL_CURRENCIES`, rates
from `GET /settings/rates`).

## 2026-11-04 — Added `npm run test`/`typecheck` scripts; `AuthContext` calls the API wrapper directly, not through `useQuery`

**Decided (two small calls made while building FR-107, session restore):**

1. Added `"test": "jest"` and `"typecheck": "tsc --noEmit"` to `package.json`
   `scripts`. Every FR's `verification` command in `feature_list.json` is written
   as `npm test -- <path>` (see e.g. FR-101/102/107), and
   `docs/Technical_Requirements.md` already documents `npm run typecheck`/
   `npm test` as the verification commands — but `init.sh` never added these
   scripts, so no FR's literal verification command could run before this.
2. `src/state/AuthContext.tsx`'s session-restore effect calls
   `src/api/auth.ts`'s `getMe` directly, not via a `useQuery` hook, despite
   `.claude/skills/new-api-integration/SKILL.md` step 6 generally asking for
   that. Session restore is a one-shot bootstrap that has to resolve *before*
   the app can decide what to render (login vs. the authenticated tree), which
   doesn't fit React Query's cache/refetch model as cleanly as a screen fetching
   its own data does — same shape most RN apps use for auth bootstrapping.

**Why these are recorded rather than just done:** (1) is foundational — it
silently blocks every other FR's verification command until fixed, not just
this one. (2) is a one-line deviation from a skill's stated step, which the
skill itself says not to do silently.

**Revisit if:** a screen other than the root layout needs the same "has a
fresh user profile" data mid-session (e.g. to react to a changed
`preferred_currency`) — that's exactly the case `useQuery` is for; add a
`useCurrentUser` hook wrapping `getMe` at that point rather than duplicating
`AuthContext`'s bootstrap-only fetch.

## 2026-11-04 — `.npmrc` with `legacy-peer-deps=true`

**Decided:** Added a project-root `.npmrc` setting `legacy-peer-deps=true`.

**Why:** `expo-router`'s web/tabs support pulls in a `react-dom`-pinned `@radix-ui`
tree whose peer ranges conflict with npm's (npm 11's) default strict ERESOLVE
check as soon as any other dependency is added alongside it — this surfaced
installing `@tanstack/react-query`/`zustand`/etc. during `init.sh`, not from
anything specific to this app's own code. Without this flag, `npm install`
fails outright for a solo dev re-running `make setup` on a clean checkout.

**Revisit if:** a future Expo/expo-router SDK bump resolves the upstream peer
ranges cleanly — recheck by removing the flag and running `npm install`.

## 2026-11-04 — Expo (managed), not bare React Native

**Decided:** Build on Expo managed workflow, not bare React Native CLI.

**Why:** Nothing in the current feature set (see `docs/Functional_Requirements.md`)
needs a native module Expo doesn't already support — QR with a logo overlay, secure
storage, a WebView/browser hand-off for the payment gateway, and an image picker
are all first-class Expo packages. Expo also gets a solo developer testing on a
connected physical device in minutes (`expo start`, scan with Expo Go), which
matches how this app will actually be built and tested day to day.

**Revisit if:** a future dependency needs custom native code Expo Go can't run.
The move at that point is `expo-dev-client` (a custom but still Expo-managed dev
build), not ejecting to bare RN — see `docs/Technical_Requirements.md`.

## 2026-11-04 — Expo Router for navigation

**Decided:** File-based routing via Expo Router, not React Navigation configured
by hand.

**Why:** Deliberately mirrors the Next.js App Router folder shape the web app
already uses (`frontend/src/app/`), so the same mental model carries over and
`docs/Architecture.md`'s folder layout reads as a direct translation of a layout
the team already knows.

## 2026-11-04 — TanStack Query + Zustand, not Redux

**Decided:** Server state via TanStack Query, the small amount of cross-tree
client state (pending-purchase payload, etc.) via Zustand, auth/app-settings via
plain React Context.

**Why:** The backend is a stateless REST API with no real-time/websocket surface
and no complex client-side derived state — Redux's ceremony buys nothing here that
Query's cache + a couple of small stores doesn't already cover.

## 2026-11-04 — Maestro for end-to-end tests

**Decided:** Maestro (flow-based YAML) for the e2e layer, not Detox/Appium.

**Why:** The explicit requirement is testing against a connected physical device
day to day, not a CI device farm first. Maestro drives a real connected device or
emulator over `adb`/`idb` with no Appium server to stand up, which is the lowest
-friction path to "test in my connected device" as stated in the task.

**Revisit if:** CI needs a device farm / cloud grid later — Maestro Cloud exists
for that, so this shouldn't force a rewrite, but confirm before assuming.

## 2026-11-04 — Password-reset / referral links open in the system browser (MVP)

**Decided:** Do not build custom-scheme or universal-link interception for the
password-reset email link (FR-104) or referral links (FR-803) in the first
release. They open in the device's system browser, which shows the existing web
page.

**Why:** No deep-link infrastructure (`AASA`/`assetlinks.json`, custom scheme,
Expo linking config) exists anywhere in the current system — building it is a
real, non-trivial piece of work (both app config and, for referral links,
probably a hosted App/Universal Links config) that isn't needed for the app to be
useful. Both flows work today via the browser; they're just not "in-app-native."

**Revisit when:** the first release is stable and the team wants the referral
share flow to open directly into the register screen instead of the mobile web
page — that's the stronger case for the investment (FR-803 explicitly ties to
this).

## 2026-11-04 — ShurjoPay hand-off mechanism: left open, not decided

**Explicitly not decided yet** — see `docs/Architecture.md` → "Payment" for the
two options. This needs to be resolved (and possibly needs a small backend change
to accept a per-request return URL) before FR-306/FR-602 are built, not guessed at
in code. Recorded here as a placeholder so it isn't silently decided by whoever
writes that screen first.
