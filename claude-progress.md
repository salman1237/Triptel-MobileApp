# Progress Log

Read this first every session. Newest entry on top.

---

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
