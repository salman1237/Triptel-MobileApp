.PHONY: setup start test typecheck lint check e2e verify

setup:
	bash init.sh

start:
	npx expo start

typecheck:
	npx tsc --noEmit

lint:
	npx eslint . --max-warnings=0

test:
	npx jest --ci

e2e:
	maestro test flows/

# Layers 1-2 (static + runtime). Run every session, before every commit.
check: typecheck lint test

# All three layers. Run before marking a feature `passing` and before `git commit`.
# Needs a connected/booted device for the e2e layer - see
# docs/Technical_Requirements.md -> "Running on a connected device".
verify: check e2e
