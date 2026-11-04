# Progress Log

Read this first every session. Newest entry on top.

---

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
