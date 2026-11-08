# AGENTS.md

## Goal
Reliable, verified work over speed — a React Native app a solo developer can keep
building across many short sessions, with any agent tool, without re-deriving
context each time.

## Project Overview
**Triptel User App** — the consumer-facing mobile client for Triptel, a travel-eSIM
marketplace. React Native (Expo, TypeScript), talking to the existing Triptel backend
(FastAPI, async SQLAlchemy, PostgreSQL) over the same `/api/v1` REST API the web app
(triptel.co) already uses in production.

This repo is **independent** of `D:\eSim` (the main web + backend monorepo) and ships
no backend code — it is a pure client, its own git history, its own harness.

**Scope for this build: User App only** — the self-serve customer flows (browse, buy,
manage eSIMs, wallet, referrals, support). The B2B merchant/agent app is a separate,
later build. Do not add merchant, agent, partner, or admin screens or API calls here;
see "Known Gaps" below and `docs/Rules.md`.

## Quick Start
- Install: `make setup`
- Run on your connected device: `make start` — see
  `docs/Technical_Requirements.md` → "Running on a connected device"
- Test: `make test`
- Full verification: `make verify`

## Start
Read `claude-progress.md` first. It says what's done, what's active, and the next
step. Then check `feature_list.json` for the one feature currently `active`.

## End
Update `claude-progress.md`, and `DECISIONS.md` if you made a judgment call this
session. Run `make verify`. Commit only verified work.

## Hard Constraints
- **User App only.** No merchant, agent, partner, or admin screen, and no call to a
  `/merchant`, `/agent`, `/admin`, or `/orders/reseller-orders` endpoint.
- Every screen talks to the **real backend** at `EXPO_PUBLIC_API_URL`. No mock data
  baked into a feature once it is marked `passing`.
- The JWT lives in `expo-secure-store` only — never in `AsyncStorage`, never in
  component state beyond the auth context, never logged.
- Money is **EUR at the API boundary.** Convert for display only, client-side, the
  same way the web app does (`docs/Architecture.md` → "Currency & i18n"). Never send
  a converted amount back to the API, and never persist one as if it were authoritative.
- The eSIM QR code must stay in lockstep with the backend's `qr_branding.py` /
  the web's `EsimQr.tsx`: error correction **H**, logo covering **22%** of the QR's
  width, circular backing disc, app icon (not the wordmark). See `docs/Rules.md` —
  the web app has shipped a silently-downgraded version of this exact component once
  already, with a test suite that still passed.
- Never compute a discount, reward, or price on-device and treat it as final. Always
  call the server (`/discounts/preview`, `/referrals/validate`) before charging
  anything; client-side math is for display estimates only.
- **WIP = 1.** One feature in `feature_list.json` is `active` at a time. Finish and
  verify it before starting the next.
- No agent flips a feature's `state` to `passing` by editing the JSON — only
  that feature's own verification command going from fail to pass does that.

## Topic Docs
- **Architecture** (`docs/Architecture.md`) — required reading before writing any
  screen or API call: stack, folder layout, state/data layer, navigation, the
  checkout state machine, and lessons carried over from the web app's production
  incidents.
- **Rules** (`docs/Rules.md`) — required reading before touching auth, payment,
  checkout, or the QR component: the non-negotiable constraints and why each exists.
- **Technical Requirements** (`docs/Technical_Requirements.md`) — required when
  adding a dependency, or touching the build / test / device-run setup.
- **Functional Requirements** (`docs/Functional_Requirements.md`) — required
  reading before building a feature. Every FR is one customer-facing capability and
  maps to a `feature_list.json` entry.
- **Non-Functional Requirements** (`docs/Non_Functional_Requirements.md`) —
  reference for performance, offline behavior, accessibility, i18n/RTL, and security
  bars a feature must clear before it can be marked `passing`.

## Known Gaps vs. the Web App (do not silently build around these)
- **No push notifications.** Nothing in the backend registers a device token or
  dispatches FCM/APNs — all order/status/trip-feedback communication is email-only
  today. Don't invent a client push feature with nothing to call; log it in
  `claude-progress.md` as blocked-on-backend instead.
- **No refresh-token mechanism on the backend** — a single long-lived JWT is issued
  at login. On a 401, clear the session and route to login; don't build a silent
  retry-with-stale-token path that doesn't exist server-side.
- *(Note, 2026-11-08: this section said "no app deep-link infrastructure" as of
  the original harness write-up. FR-803 has since added a `triptel://` custom
  scheme for referral links — check `DECISIONS.md`'s 2026-11-05 "app identity"
  entry and `claude-progress.md`'s FR-803 session before assuming deep links
  still don't exist. This doc hasn't been swept for staleness against shipped
  work since it was first written; treat any "Known Gap" here as a claim to
  verify against `claude-progress.md`, not as settled fact.)*

## Working across multiple agent tools
This repo is worked on with more than one coding agent (Claude Code, Codex). Both
read this file as their primary instructions — `CLAUDE.md` is a one-line pointer
to it, kept only because Claude Code looks for that filename first. Whichever tool
is running:
- Follow "Start"/"End" above exactly the same way — `claude-progress.md`,
  `feature_list.json`, and `DECISIONS.md` are shared state, not
  Claude-Code-specific. A stale "next step" from a different tool's session is
  still the real next step.
- **WIP = 1 holds regardless of which tool opened the session.** Check
  `feature_list.json` for an `active` item before starting anything, whichever
  tool you're running.
- `.claude/settings.json` (permissions) and `.claude/hooks/block-destructive.sh`
  (the guard against `rm -rf`/force-push/hard-reset) are Claude-Code-only
  mechanisms — Codex has no equivalent hook here. `docs/Rules.md`'s constraints
  still apply under Codex; they're just not mechanically enforced the same way,
  so read diffs more carefully before approving a destructive command.
- `.claude/skills/*/SKILL.md` (new-screen, new-api-integration) are Claude Code's
  auto-loaded skill format and won't be discovered by Codex. Their content is
  plain markdown — open and follow them manually under Codex; nothing in them is
  Claude-Code-specific advice, just unindexed for that tool.
