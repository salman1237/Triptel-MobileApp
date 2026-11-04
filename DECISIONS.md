# Decisions

One entry per judgment call that wasn't obvious from the task, newest on top.
Each entry: what was decided, why, and what would make it worth revisiting.

---

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
