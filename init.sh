#!/usr/bin/env bash
# Once: Initialize. No feature code — just a runnable, verified environment.
# Safe to re-run: every step is idempotent.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "== Triptel User App: init =="

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required (LTS). Install it first, then re-run this script." >&2
  exit 1
fi
echo "node: $(node --version)"
echo "npm:  $(npm --version)"

if [ ! -f package.json ]; then
  echo "-- Scaffolding Expo app (TypeScript, blank template) --"
  npx --yes create-expo-app@latest . --template blank-typescript
else
  echo "-- package.json already exists, skipping scaffold --"
fi

echo "-- Installing core dependencies (see docs/Technical_Requirements.md) --"
npx --yes expo install \
  expo-router \
  expo-secure-store \
  expo-web-browser \
  expo-image-picker \
  expo-sharing \
  expo-print \
  react-native-svg

npm install --save \
  @tanstack/react-query \
  zustand \
  @react-native-async-storage/async-storage \
  react-native-qrcode-svg

echo "-- Installing dev dependencies (lint, typecheck, test) --"
npm install --save-dev \
  typescript \
  eslint \
  prettier \
  eslint-config-prettier \
  jest \
  jest-expo \
  @testing-library/react-native \
  @types/react

echo "-- Writing config files (only if missing — never overwrite your edits) --"

if [ ! -f .env.example ]; then
  cat > .env.example <<'EOF'
# Point at beta during development. Never point a dev build at production
# (https://triptel.co) until a feature is verified — see docs/Rules.md.
EXPO_PUBLIC_API_URL=https://beta.triptel.co
EOF
fi

if [ ! -f .env ]; then
  cp .env.example .env
fi

if [ ! -f tsconfig.json ]; then
  cat > tsconfig.json <<'EOF'
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
EOF
fi

mkdir -p app src/api src/state src/components src/lib src/theme flows __tests__

if [ ! -f __tests__/smoke.test.tsx ]; then
  cat > __tests__/smoke.test.tsx <<'EOF'
// The one passing test a freshly-initialized harness requires (see docs/
// Technical_Requirements.md's "three layers"). Replace/extend per feature as
// real screens land - this just proves the toolchain works end to end.
test("the test runner itself works", () => {
  expect(1 + 1).toBe(2);
});
EOF
fi

echo "-- Running the three static/runtime checks --"
npx tsc --noEmit || echo "(typecheck not clean yet - expected on a fresh scaffold, fix before first commit)"
npx jest --ci || echo "(tests not clean yet - fix before first commit)"

echo
echo "== Done. Next steps =="
echo "1. Review feature_list.json and claude-progress.md."
echo "2. make start   # then scan the QR with Expo Go on your connected device"
echo "3. Start with F-000, then FR-107 (session restore) - most other features need auth."
echo "4. First commit once 'make check' is clean: git add -A && git commit -m 'init: runnable Expo app, one passing test'"
