---
name: new-api-integration
description: Wire up a new backend endpoint the project's way - typed client, auth header, error shape, React Query key - instead of a one-off fetch call per screen.
---

# New API Integration

Use this whenever a feature needs to call a backend endpoint that doesn't have a
wrapper under `src/api/` yet.

## Steps
1. **Confirm the endpoint is in scope.** Check `docs/Functional_Requirements.md`
   and `docs/Rules.md` → "Scope" - never wrap a `/merchant`, `/agent`, `/admin`, or
   `/orders/reseller-orders` endpoint in this app.
2. **Confirm the real shape against the running backend**, not memory of it. This
   doc's FR list is a snapshot of `D:\eSim` as of when it was written - if the
   backend has moved on, the backend wins; note the discrepancy in
   `claude-progress.md`.
3. **Add the wrapper** to the matching file under `src/api/` (one file per
   backend router - `auth.ts`, `catalog.ts`, `orders.ts`, `esims.ts`, `wallets.ts`,
   `withdrawals.ts`, `payments.ts`, `referrals.ts`, `discounts.ts`, `support.ts`,
   `kyc.ts`, `settings.ts`). A thin, typed function: request in, typed response
   out, no React in this file.
4. **Auth header**: use the shared authenticated-fetch helper - never attach
   `Authorization` ad hoc in a screen. If the endpoint is public (no auth), say so
   explicitly in a comment so the next person doesn't assume otherwise.
5. **Errors**: surface the backend's actual error shape to the caller rather than
   collapsing every failure to a generic string - screens need to tell "wrong
   password" apart from "network down" apart from "still processing, not a
   failure" (see `docs/Rules.md` → "Payment & checkout" for why that last one
   specifically matters).
6. **Wrap in a hook**: `useQuery`/`useMutation` with an explicit, stable query key
   (e.g. `["wallet", "ledger"]`), placed in the screen or a shared `src/api/hooks/`
   file if more than one screen needs it. Never call the raw wrapper from a
   component directly.
7. **401 handling**: if this is an authenticated endpoint, confirm a `401`
   response clears the session and routes to login through the shared handler -
   don't write a local special case (`docs/Rules.md` → "Auth": there is no
   refresh-token endpoint, so there is nothing to silently retry with).
8. **Test**: a unit test for the wrapper function (request shape, error mapping)
   and/or a component test that mocks it - whichever the owning FR's
   `verification` command in `feature_list.json` names.

## After
- Update `claude-progress.md` if this unblocked a previously-blocked feature.
- Commit alongside the screen that uses it, not as a bare, unused wrapper.
