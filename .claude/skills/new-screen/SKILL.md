---
name: new-screen
description: Build one feature-list.json screen the project's way - consistent file layout, data layer, i18n, tests - instead of improvising structure each time.
---

# New Screen

Use this whenever the active `feature_list.json` item is "a screen the user sees"
(most of `docs/Functional_Requirements.md`). Follow every step in order; skipping
the test or the i18n pass is how a screen looks done in a demo and isn't.

## Before starting
1. Read the FR item in `docs/Functional_Requirements.md` for this feature's exact
   behavior and the backend endpoint(s) it calls.
2. Confirm the feature is `active` in `feature_list.json` (set it there if it was
   `not_started`) and that nothing else is `active` — WIP = 1, see `docs/Rules.md`.

## Steps
1. **Route**: add the screen under `app/` following the layout in
   `docs/Architecture.md` → "Folder layout". File-based, so the path *is* the
   route — match the grouping already used for sibling screens.
2. **Data layer**: add/extend the relevant file under `src/api/` (one file per
   backend router, e.g. `src/api/wallets.ts`) with a typed fetch wrapper. The
   screen component calls a `useQuery`/`useMutation` hook, never `fetch` directly
   - see `docs/Architecture.md` → "Layering rule".
3. **State**: if the screen needs state beyond server data (e.g. a multi-step
   form), use local component state first; only reach for `src/state/` (Zustand)
   if it genuinely needs to be read outside this screen's tree.
4. **i18n**: every user-visible string goes through the `t(ns, key, fallback)`
   wrapper (`docs/Architecture.md` → "Currency & i18n"), never a hardcoded
   English literal - this app ships in RTL languages too.
5. **Currency**: any money value is formatted via the shared `formatPrice`/
   `convert` helpers, never hand-rolled - see `docs/Rules.md` → "Money".
6. **Loading / error / offline states**: every screen that calls the network
   needs explicit loading, error, and (per `docs/Non_Functional_Requirements.md`)
   offline states - not just a happy path.
7. **Accessibility**: screen-reader labels on icon-only controls, 44pt minimum
   touch targets, no color-only status indicators - see
   `docs/Non_Functional_Requirements.md` → "Accessibility".
8. **Test**: write the component test named by this feature's `verification`
   command in `feature_list.json` (e.g. `npm test -- __tests__/wallet/overview.test.tsx`).
   If the FR also has a Maestro flow listed, add/extend that flow file too.
9. **Prove the test actually tests something**: temporarily break the feature
   (comment out the real behavior) and confirm the verification command fails,
   then restore it. This codebase's sibling web/backend repo has shipped a
   passing-but-vacuous test at least three times - see `docs/Rules.md` → "Process".
10. **Run `make check`** (or `make verify` if this FR has an e2e flow) and fix
    anything red.

## After
- Flip the feature's `state` to `passing` only because its own verification
  command now passes - not by editing the JSON as a shortcut.
- Update `claude-progress.md`: what shipped, what's next.
- Note any judgment call made along the way in `DECISIONS.md`.
- Commit.
