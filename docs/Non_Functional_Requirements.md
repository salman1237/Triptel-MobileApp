# Non-Functional Requirements
**Read when:** performance, offline behavior, accessibility, i18n/RTL, or security
is in question for a feature — these are bars a feature must clear before it can be
marked `passing`, alongside its functional behavior.

## Performance
- Cold start to interactive: budget it, measure it once the app exists, don't
  guess a number here that can't be checked yet — add a real target to this file
  the first time it's measured (e.g. via `expo-dev-client` + a simple timestamp
  log), rather than inventing one now.
- Lists (destinations, packages, My eSIMs, ledger, withdrawal history) must use a
  virtualized list (`FlatList`/`FlashList`), never a mapped `ScrollView`, once the
  item count can realistically exceed ~20.
- QR rendering (FR-401) must not block the screen — show the card immediately,
  reveal/render the QR on tap, not on mount, matching the web's "tap to reveal"
  pattern (also a small privacy nicety: a QR isn't visible by default over
  someone's shoulder).

## Offline / network behavior
- **Must degrade gracefully, read-only:** My eSIMs list and a previously-loaded
  eSIM's QR/LPA code (cache the last-fetched status), legal documents, guides
  (FR-901/902, already static).
- **Must fail clearly, not silently:** checkout, any wallet action, withdrawal
  request/cancel, support ticket actions, KYC submission. Show an explicit
  "you're offline" state — never let a mutation appear to hang indefinitely or
  silently retry against a dead connection without telling the user.
- Cache with TanStack Query's built-in persistence rather than hand-rolling a
  second cache layer.

## Accessibility
- Support OS font-scaling (Dynamic Type / Android font scale) — don't lock text to
  a fixed pixel size anywhere a user reads real content (amounts, eSIM status,
  ticket replies).
- Minimum touch target 44×44pt.
- Screen-reader labels on every icon-only control, the QR code (state it as
  "eSIM QR code for <country>, tap to reveal" rather than leaving it unlabeled),
  and all status badges (don't convey status by color alone).
- Color contrast at least matches the web app's existing brand palette — don't
  invent new colors with weaker contrast for the mobile build.

## i18n / RTL
- Must support every language the admin panel can activate, including RTL
  languages — use `I18nManager` and logical layout properties (`start`/`end`, not
  `left`/`right`) throughout, not just in screens built after this is noticed.
- Currency formatting must match the web app's symbol set and zero-decimal
  handling (JPY, and any other zero-decimal currency the web app lists) exactly —
  a user switching between the web app and this app should never see a different
  number for the same wallet balance.

## Security
- JWT in `expo-secure-store` only (see `docs/Rules.md`).
- No sensitive value (token, KYC document, full card/bank detail) in RN debug logs,
  Flipper, or a crash-reporting payload. If/when a crash reporter is added, scrub
  before it's wired up, not after the first leak is noticed.
- KYC images (FR-1002): upload directly, don't retain a local copy on-device
  longer than the upload itself needs; clear any temp file after a successful
  `POST /kyc/submit`.
- Treat every amount, discount, and reward value that reaches the UI as
  display-only unless it came directly from the response of the specific mutation
  that's about to charge or credit something — see `docs/Rules.md` → "Payment &
  checkout".

## Observability
- Decide on a crash-reporting tool (e.g. Sentry) before the first public build, not
  before the first local one — don't commit to a vendor in this doc pre-emptively;
  record the choice in `DECISIONS.md` when it's made.
- Log enough on checkout/payment screens (non-sensitive: order id, status
  transitions, timing) to debug a stuck purchase after the fact, mirroring why the
  backend's own checkout path logs what it logs.

## Consistency with the backend
- This app inherits the backend's existing behavior and limits as given — it does
  not get its own SLA. If a number here needs to reference the backend's actual
  performance or uptime target, pull it from the backend's own
  `docs/Non_Functional_Requirements.md` (`D:\eSim\backend\docs\...` if present) at
  build time rather than restating a guessed figure here.
