# Technical Requirements
**Read when:** adding a dependency, or touching build/test/device-run setup.

## Runtime
- **Expo SDK** (latest stable at project-init time — pin the exact version in
  `package.json`/`app.json` when `init.sh` is actually run; don't float `latest`).
- **React Native**, **TypeScript** in `strict` mode. No `any` without a comment
  explaining why.
- **Node.js** LTS (match whatever the backend/web repo's `.nvmrc`-equivalent uses,
  for familiarity — check `D:\eSim\frontend` if unsure).

## Core dependencies (pin exact versions at init time)
| Package | Purpose |
|---|---|
| `expo-router` | File-based navigation |
| `@tanstack/react-query` | Server state/cache |
| `zustand` | Cross-tree client state (pending purchase, etc.) |
| `expo-secure-store` | JWT storage |
| `@react-native-async-storage/async-storage` | Non-sensitive UI prefs, resume-purchase payload |
| `react-native-qrcode-svg` | QR with center-logo overlay |
| `expo-web-browser` | ShurjoPay hosted checkout hand-off |
| `expo-image-picker` | KYC NID photos, support-ticket attachments |
| `expo-sharing` | Share install links / printable receipts |
| `expo-print` | Render a receipt/eSIM sheet to PDF (RN equivalent of the web's print-only pages) |
| `date-fns` (or equivalent already used on the web, check `frontend/package.json`) | Date formatting consistent with the web app |

Do not add a dependency outside this list without updating this doc — that's the
whole point of pinning it here instead of letting `package.json` drift silently.

## Environment
- `EXPO_PUBLIC_API_URL` — points at `https://beta.triptel.co` during development.
  **Never** point a development build at `https://triptel.co` (production) until a
  feature is verified — see `docs/Rules.md` and the main repo's own
  "verify deploys, don't trust CI green" practice, which applies here too.
- `.env.example` checked in; `.env` gitignored.

## Testing (the three layers, see `CLAUDE.md`/the harness talk this project follows)
1. **Static**: `npm run typecheck` (`tsc --noEmit`), `npm run lint` (ESLint +
   Prettier check).
2. **Runtime/component**: `npm test` — Jest + `@testing-library/react-native`.
   Mirrors `src/` under `__tests__/`.
3. **End-to-end**: **Maestro** — flow-based YAML, runs directly against a
   connected physical device or emulator over `adb`/`idb`. One flow file per
   primary journey in `flows/` (e.g. `checkout-wallet.yaml`,
   `resume-purchase-after-login.yaml`, `view-esim-qr.yaml`). Chosen specifically
   because it needs no Appium server setup and works well against a real connected
   phone, which is how this app will actually be tested day to day.

## Verification commands
- `make typecheck` → `npm run typecheck`
- `make lint` → `npm run lint`
- `make test` → `npm test`
- `make e2e` → `maestro test flows/` (requires a connected/booted device)
- `make check` → typecheck + lint + test (layers 1–2, fast, run every session)
- `make verify` → `check` + the Maestro flows touched by the active feature (layer
  3, run before marking a feature `passing` and before `git commit`)

## Running on a connected device
- **Android**: enable USB debugging, confirm `adb devices` shows the phone, then
  `npx expo start` and press `a` — or scan the terminal QR with the Expo Go app for
  any feature that doesn't need custom native code.
- **iOS**: scan the terminal QR with the Camera app (opens in Expo Go) over the
  same Wi-Fi network as the dev machine. A physical iOS device needs no Apple
  developer account for Expo Go; one is only needed once a custom dev client build
  is required (see below).
- **If a future dependency needs native code** that Expo Go can't run (none of the
  packages above do, as of this doc), switch to an `expo-dev-client` build
  (`eas build --profile development --local`, installed once per device) instead of
  silently ejecting to bare React Native. Record that switch in `DECISIONS.md` when
  it happens — don't let it happen implicitly.

## CI (set up once the first feature is building)
Mirror the web/backend repo's instinct: a passing local run is not proof. At
minimum, `make check` should run in GitHub Actions on every push; `make e2e`
against an emulator/simulator is a stretch goal once the app has enough surface
area to be worth it — don't block early feature work on building CI infrastructure
first, but don't skip it indefinitely either.

## Secret scanning
This org has GitGuardian wired into its other repos and has twice had it fire on a
test fixture value that looked like a credential but wasn't (a hardcoded password in
a test). If that happens here: fix the *literal* (name it as a constant, generate it,
or route it through a fixture) rather than suppressing the scanner — see the sibling
`D:\eSim` repo's `backend/tests/test_buy_for_customer.py` for the pattern already
adopted there.
