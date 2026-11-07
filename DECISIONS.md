# Decisions

One entry per judgment call that wasn't obvious from the task, newest on top.
Each entry: what was decided, why, and what would make it worth revisiting.

---

## 2026-11-07 — Maestro `launchApp` hang: version-downgrade theory tested and ruled out

**Context:** picking FR-106/305/306/402/602 back up, following the earlier
entry's "Revisit if" note (try a different Maestro version, since 2.12.1
might carry a known regression).

**What was tried:** researched upstream (no newer release exists - 2.12.1
is still latest as of this date). Found GitHub issue
[mobile-dev-inc/Maestro#3658](https://github.com/mobile-dev-inc/Maestro/issues/3658)
(open, unfixed) describing `launchApp`/`adb shell` hangs with no bounded
timeout, which the reporter traced to a dadb socket-timeout default
regression introduced in CLI 2.10.0/2.11.0. Downloaded CLI 2.9.0 (the last
release before that suspected regression) from the official GitHub release
assets into a scratch directory (did not touch the project's installed
`/c/maestro`), and ran a minimal `launchApp` + `takeScreenshot` flow against
the same connected Vivo device (`10EF1302BJ000R5`) and app (`co.triptel.app`)
that hangs on 2.12.1.

**Result: ruled out.** 2.9.0 hung identically - log shows the same
`Stopping co.triptel.app app during launch` line followed by silence, this
time for 2+ minutes before failing with exit code 1 (heartbeat-lock I/O
errors logged every 5s while it waited, a separate, unrelated Windows
file-locking issue in Maestro's own session-heartbeat writer - not the
cause of the hang itself). Since the hang reproduces on both the latest
release and the pre-regression release, it is **not** the dadb timeout
regression from #3658 - that theory is specific to a different trigger
(long `inputText` calls / unbounded `adb shell` reads) and doesn't match
our case. This confirms the original diagnosis stands: a genuine,
device/environment-specific `launchApp` stall, not something a CLI version
swap fixes.

**Not resolved.** Did not keep trying further versions blindly past this
point (2.9.0 was the one principled thing to try, based on the actual
upstream theory) - reporting back per standing guidance against
open-ended retry loops.

**Revisit if:** the original entry's remaining untried option - a clean
Android emulator (removes any lingering on-device AccessibilityService/
UiAutomation state as a variable, which is the other standing theory for
what `launchApp`'s internal idle-detection wait might be blocking on) - or
commenting on/following upstream issue #3658 for a maintainer response,
since the symptom (hang specifically inside `launchApp`'s internal wait,
while other commands like `hierarchy` work instantly) hasn't been matched
to any other open issue either.

## 2026-11-05 — FR-305 wallet checkout: implementation done and manually verified live; formal Maestro verification blocked on this Vivo device

**Status:** `src/api/orders.ts`, `src/lib/waitForOrder.ts`, `src/components/CheckoutFlowModal.tsx`,
and the wiring into `PackageBrowser.tsx`'s `payByWallet()` are written, typecheck
clean, lint clean, and `__tests__/checkout/payment-method-chooser.test.tsx` has
5 new FR-305 tests (9/9 passing) - each proven non-vacuous by deliberately
commenting out the `payByWallet(product)` call and confirming all 5 failed,
then restoring it. **`feature_list.json` still shows FR-305 as `not_started`**,
per the hard rule that only the FR's own verification command going from fail
to pass flips it - that command (`maestro test flows/checkout-wallet.yaml`)
has not yet passed, for reasons below.

**Manually verified working, live, on-device, against the real staging
backend** (`beta.triptel.co`) - confirmed the user's choice to use the
Google-linked personal account's wallet rather than the dedicated QA account
(see next entry). Bought "Bangladesh, 1 Day, 500MB/day" (~1.85 EUR) via
`adb shell input tap` sequences: payment-method chooser opened with the real
wallet balance, `checkout-working` ("Setting up your eSIM") rendered, and it
resolved to `checkout-success` with a real order number
(`ORD-20261105-E6B7E9`) within the short poll window - the whole
working -> success path, end to end, for real money and a real supplier
order.

**Why the Maestro flow itself (`flows/checkout-wallet.yaml`) couldn't be run
to completion:** every `launchApp` command against `co.triptel.app` on this
device (serial `10EF1302BJ000R5`, a Vivo) hung for exactly 120s and died with
`DeviceServerDiedException` / `DEADLINE_EXCEEDED` - 5 consecutive identical
failures, not the already-documented random USB/Wi-Fi flakiness (see the
Maestro CLI entry below): that flakiness looks different (connection drops
mid-flow, varies run to run) and responds to a plain retry; this did not,
across multiple retries, an adb-server restart, and freeing ~2GB of RAM by
stopping stale Gradle daemons. **Other Maestro commands against the same
device/connection work fine** - `maestro --device 10EF1302BJ000R5 hierarchy`
returned a full UI tree instantly - so the on-device driver connection
itself is healthy; the fault is specific to `launchApp` against this app on
this device. No Maestro driver/instrumentation package or registered
instrumentation shows up via `pm list packages -u` / `pm list instrumentation`
on this device at all, unlike (presumably) the Tecno device `flows/login.yaml`
was originally proven on - worth checking first if this comes up again.

**Update - same session, root-caused further:** tried the Tecno device next
(where `flows/login.yaml` was originally proven) - **identical failure**,
ruling out "Vivo-specific" entirely. Then isolated further: a minimal
one-line flow (`launchApp` + `takeScreenshot`, no other steps) against
**`host.exp.exponent` (Expo Go)** - the exact app `flows/login.yaml` was
built and proven against - **also hung identically**, on the Tecno device.
So this isn't about `co.triptel.app`, the dev-client switch, or either
device - it reproduces for `launchApp` against *any* app, on *any* of the
two devices available. Confirmed `maestro --device ... hierarchy` (a
different command, no app launch involved) returns instantly against the
same device/connection, so the on-device driver connection itself is
healthy - the fault is inside `launchApp` specifically. Reading the
timestamped log: ~20 permission-grant attempts (all expected no-ops,
unrelated) complete in under a second, then `Stopping <app> during launch`
logs immediately, then **nothing for exactly 120.000s** until
`DeviceServerDiedException`. Tested the equivalent raw commands directly -
`adb shell am force-stop <pkg>` and `adb shell am start -n <pkg>/<activity>`
- both return in under 0.2s. So the OS-level primitives are fast; whatever
Maestro's on-device driver does internally after issuing them (most likely
waiting on its own "app has settled" / idle-detection check, probably via
an injected AccessibilityService) is what hangs, every time, regardless of
app or device. No stale cached Android driver artifacts found under
`~/.maestro/deps` to clear (that directory only holds iOS-related tools on
this machine). Maestro version: 2.12.1.

**Not resolved this session** - this is a genuine, reproducible bug/
regression in this Maestro install's `launchApp` implementation, not an app,
flow, or device problem. Did not keep guessing blindly past this point per
standing guidance (diagnose root cause, don't retry forever) - reported to
the user with the full trail above instead.

**Revisit if:** picking this back up - try `maestro --version` against a
freshly reinstalled/different Maestro version (2.12.1 may have a known
regression), or test on a clean Android emulator (removes any lingering
on-device AccessibilityService/UiAutomation state as a variable). Once
`launchApp` works again, `flows/checkout-wallet.yaml` itself needs no
changes - it was never reached due to this earlier blocker. A good, ready,
password-based account for it going forward: `salman2033` (logged in on
the Tecno device this session, SUPER_ADMIN role, verified email, wallet
balance confirmed well-funded - see conversation) - script-friendly unlike
the Google-linked account below, though still a real personal account, not
a disposable QA one.

## 2026-11-05 — FR-305 Maestro flow: personal Google-linked account instead of the dedicated QA account

**Decided (user's explicit choice):** `flows/checkout-wallet.yaml` assumes an
already-signed-in session and does not log in itself, unlike
`flows/login.yaml`/`flows/register.yaml`.

**Why:** the dedicated QA account (`qa.mobile.login@triptel-test.dev`) that
earlier Maestro flows use had a 0 EUR wallet balance; the user's wallet
recharge (this session) went to their personal Google-linked account
instead, and Google Sign-In's native account-picker can't be reliably
scripted in Maestro. Asked the user directly (3 options: fund the QA account
too, give credentials to fund it myself, or use the personal account and
skip scripting login) - they chose to use the personal account.

**Revisit if:** this flow is going to be run repeatedly/unattended (e.g. a
future CI setup) - a script-friendly, password-based QA account with its own
standing wallet balance would be far more durable than depending on a
personal account staying signed in and funded on whatever device runs this.

---

## 2026-11-05 — Windows native-build path length: CMake 3.31.6 via expo-build-properties (superseded the buildDir-relocation approach below)

**Decided (final, confirmed working):** `app.config.js` sets
`android.cmakeVersion = '3.31.6'` through the `expo-build-properties`
config plugin, scoped to `process.platform === 'win32'` only (EAS's Linux
cloud builders don't need or have this package). CMake 3.31.6 bundles
Ninja 1.12.1, which supports Windows long paths; the SDK's default CMake
3.22.1 bundles Ninja 1.10.2, which does not, regardless of the OS-level
`LongPathsEnabled=1` registry setting (already confirmed on at every step
below - it never mattered, because the limitation is in Ninja, not
Windows).

No `sdkmanager`/`cmdline-tools` exists on this machine to install the
CMake 3.31.6 SDK package the normal way, so it was installed manually:
downloaded `cmake-3.31.6-windows.zip` directly from
`https://dl.google.com/android/repository/` (URL found by fetching and
parsing that repository's `repository2-3.xml` manifest), extracted to
`$env:LOCALAPPDATA\Android\Sdk\cmake\3.31.6\`, and given a `package.xml`
hand-derived from the working `cmake\3.22.1\package.xml` (same license
block, `path="cmake;3.31.6"`, revision `3.31.6`) so AGP recognizes it as
an installed SDK component rather than just binaries on disk.

**Confirmed end-to-end on 2026-11-05**: `gradlew.bat assembleDebug`
completed with `BUILD SUCCESSFUL` (attempt #9; the first 8 all failed on
this exact issue). The resulting APK was installed on a physical device
(Vivo, serial `10EF1302BJ000R5`) via `adb`, the app launched, connected to
Metro, and the FR-103 Google Sign-In button on the login screen opened the
native account picker without crashing - the dev-client build this whole
investigation was blocked on is now provably working.

**Superseded below:** everything in the rest of this entry (relocating
`react-native-gesture-handler`'s and `:app`'s `buildDir` via a
`subprojects` block) was the path tried *before* the real fix was found.
It is kept verbatim as a record of what was ruled out and why - do not
reapply it; `android/build.gradle` has been reverted to its clean,
auto-generated state and the `expo-build-properties` plugin is the only
Windows-specific override now in place, applied automatically on every
`expo prebuild` since it lives in `app.config.js`, not in a gitignored,
hand-edited Gradle file.

---

**Historical (ruled out) - original entry follows unedited:**

**Decided:** `android/build.gradle` relocates `react-native-gesture-handler`'s
and `:app`'s `buildDir` to `D:/rnb/<module-name>` (outside the project
tree), via a `subprojects` block scoped to those two modules by name -
not `allprojects`.

**Why:** the local dev-client Android build failed four times in a row
before landing on this:
1. Disk space (resolved separately - unrelated pre-existing machine issue).
2. `ninja: error: Stat(...) Filename longer than 260 characters` compiling
   `react-native-gesture-handler`'s New Architecture codegen output
   (`.../react/renderer/components/rngesturehandler_codegen/...` - the
   *relative* portion of that one path alone measured 274 characters,
   before even adding this project's own absolute path prefix).
3. Tried disabling New Architecture first (`newArchEnabled: false`) -
   **not viable**: React Native 0.82+ hard-ignores that setting with an
   explicit warning ("not supported anymore... will run with New
   Architecture enabled by default"), confirmed by an actual build
   attempt, not assumed.
4. First fix attempt relocated **every** subproject's `buildDir`
   (`allprojects { buildDir = ... }`) - too blunt: it broke the React
   Native Gradle plugin's autolinking step, which expects its generated
   `autolinking.json` at a location relative to the *root* project's
   default `buildDir` (`Failed to apply plugin 'com.facebook.react'...
   generated/autolinking/autolinking.json (The system cannot find the
   path specified)`).
5. Second fix attempt scoped the relocation to just
   `react-native-gesture-handler`'s own module build - that cleared the
   module's own CMake build, but `:app:buildCMakeDebug` then hit the
   *identical* "Filename longer than 260 characters" error separately:
   the app module's own combined/autolinked native build independently
   references gesture-handler's codegen source files from their
   original `node_modules` location (not through gesture-handler's
   relocated `buildDir`), so it has its own, separate instance of the
   same problem.
6. **This fix**: relocate both `react-native-gesture-handler`'s *and*
   `:app`'s `buildDir`. `subprojects` (unlike `allprojects`) already
   excludes the root project automatically, so this still doesn't touch
   root's buildDir - confirmed safe by checking `rootProject.name` is
   `'Triptel'` and matches the autolinking.json path from the earlier
   failure (`D:\rnb\Triptel\generated\autolinking\...`), i.e. that
   failure really was specifically about the *root* project, not `:app`.
   Confirmed Windows's own long-path support (`LongPathsEnabled=1`) is
   already on at the OS level, but `ninja` (CMake's backend here)
   doesn't honor that opt-in regardless - a known, widely-reported
   Windows + RN New Architecture pain point for this specific library.
   No other native module's CMake build (reanimated, worklets, svg,
   screens, expo-modules-core) has hit this in any attempt so far.

**Caveat - not yet durable (superseded, see top of this entry):** this
manual `android/build.gradle` edit did not survive `expo prebuild` and was
never wired into a config plugin before the real fix (CMake 3.31.6) was
found instead. It has since been reverted; `android/build.gradle` is back
to its clean, regenerated state.

## 2026-11-05 — FR-306 ShurjoPay hand-off: custom-scheme deep link, backend changed

**Decided** (user's explicit choice, see conversation): option 1 from
`docs/Architecture.md` → "Payment" - `expo-web-browser`'s
`openAuthSessionAsync` watches for a redirect to `triptel://payment-callback`.
This needed the backend change that doc flagged as a prerequisite, made
directly in `D:\eSim\backend` (a separate repo/codebase) per the user's
explicit choice to do it there rather than switch to the no-backend-change
option.

**What changed in the backend** (`D:\eSim\backend`):
- `app/core/config.py`: new `MOBILE_APP_RETURN_SCHEME` setting, defaults to
  `"triptel://payment-callback"`.
- `app/schemas/order.py`: `OrderCreateRequest` gets a new `mobile: bool = False`
  field. No effect on the WALLET path, which never redirects anywhere.
- `app/api/v1/payments.py`: `POST /payments/shurjopay/order-initiate` marks
  the ShurjoPay reference `"ORDERPAY-M-{order.id}"` (vs `"ORDERPAY-{order.id}"`)
  when `req.mobile` is set - no new DB column or migration, reusing the same
  prefix-dispatch pattern the code already uses to tell `ORDERPAY-` apart
  from `TOPUP-`. `GET /payments/shurjopay/callback` and
  `_complete_gateway_order` detect the `-M-` marker and redirect to the
  custom scheme instead of `FRONTEND_BASE_URL` - both the success path and
  every failure path (`_fail` helper now takes a `mobile` flag). `return_url`/
  `cancel_url` sent to ShurjoPay itself stay pointed at the backend's own
  `/callback` unchanged, so verification/crediting logic is 100% shared
  between web and mobile - only the *final* redirect destination differs.
  Added 4 new backend pytest tests (`tests/test_gateway_checkout.py`) proving
  the mobile redirect, mobile failure redirect, and that the existing web
  redirect is unaffected - all deliberately broken and confirmed to fail
  before being trusted.

**Not yet done (mobile app side):** `POST /payments/shurjopay/order-initiate`
needs to be called with `mobile: true` from the RN app, and the actual
`openAuthSessionAsync` screen/flow for FR-306 still needs building in this
repo (Triptel-MobileApp) - this entry only covers the backend prerequisite.

**One known gap, accepted:** the earliest possible failure point in
`shurjopay_callback` (ShurjoPay's own verification API call returning
something unparseable, before `customer_order_id` is even known) still
defaults to a web-style `/wallet` redirect regardless of which client
initiated the payment - there's no way to know the origin at that point
without a DB column, and this is an exceptional failure of ShurjoPay's own
API, not a normal customer-facing path. Revisit if this turns out to matter
in practice.

**Follow-on requirement:** Google Sign-In (FR-103) and this both needed
switching the mobile app from plain Expo Go to an `expo-dev-client` build -
see the FR-103 entry for that.

## 2026-11-05 — App identity: `co.triptel.app`; switching to expo-dev-client for FR-103

**Decided:** Android `package` and iOS `bundleIdentifier` both set to
`co.triptel.app` (no prior convention existed anywhere in the repo or
docs). Also starting the switch from plain Expo Go to an
`expo-dev-client` build, specifically to support FR-103 (Google
Sign-In) - the previously-assumed "try the existing web OAuth client ID
via Expo's auth proxy in plain Expo Go" path turned out to be dead:
Expo's `auth.expo.io` proxy is deprecated, and current SDK 58 guidance
for Google Sign-In requires either a direct custom-scheme redirect or
the native `@react-native-google-signin/google-signin` library - both
need a dev client, confirmed via Expo's own docs and auth.expo.io's own
deprecation notice before committing to this path (see chat transcript
2026-11-05).

**Why `co.triptel.app` specifically:** reverse-domain of `triptel.co`,
matches `app.json`'s existing `"scheme": "triptel"`. Low-stakes before
any store submission - can still change before a real App
Store/Play Store listing exists.

**Follow-on requirement this creates:** Google Sign-In on Android needs
a *separate* Android-type OAuth client registered in the same Google
Cloud project as the existing web `GOOGLE_CLIENT_ID`
(`1095507553767-...`), tied to `co.triptel.app` + the dev build's
signing certificate SHA-1 fingerprint. That registration step needs
Google Cloud Console access this session doesn't have - the user needs
to do it, with the exact package name and SHA-1 this session provides.

**Revisit if:** the app is renamed, or a real published package
name/bundle ID is assigned later - `co.triptel.app` is a placeholder
chosen for development, not confirmed as the production identity.

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
