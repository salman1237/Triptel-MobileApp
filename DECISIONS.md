# Decisions

One entry per judgment call that wasn't obvious from the task, newest on top.
Each entry: what was decided, why, and what would make it worth revisiting.

---

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
