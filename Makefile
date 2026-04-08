.PHONY: node-install node-generate node-check-generated node-test node-check node-build
.PHONY: python-sync python-generate python-check-generated python-test python-check python-build
.PHONY: go-generate go-check-generated go-check
.PHONY: shared-check check build

node-install:
	pnpm install --frozen-lockfile --dir sdk-node

node-generate:
	pnpm --dir sdk-node generate

node-check-generated:
	cd sdk-node && pnpm generate && git diff --exit-code -- src/schema.generated.ts src/types.generated.ts src/validator.generated.ts

node-test:
	pnpm --dir sdk-node test -- tests/webhook/auth.test.ts tests/webhook/encoding.test.ts tests/webhook/index.test.ts tests/webhook/signing.test.ts tests/webhook/validation.test.ts

node-check: node-check-generated
	pnpm --dir sdk-node lint
	pnpm --dir sdk-node typecheck
	$(MAKE) node-test

node-build:
	pnpm --dir sdk-node build

python-sync:
	cd sdk-python && uv sync --dev

python-generate:
	cd sdk-python && uv run python scripts/generate_schema_module.py && uv run python scripts/generate_models.py

python-check-generated:
	cd sdk-python && uv run python scripts/generate_schema_module.py && uv run python scripts/generate_models.py && git diff --exit-code -- src/primitive_sdk/schemas/email_received_event.schema.json src/primitive_sdk/models_generated.py

python-test:
	cd sdk-python && uv run pytest tests -k "not shared_fixtures"

python-check: python-check-generated
	cd sdk-python && uv run ruff check .
	cd sdk-python && uv run basedpyright
	$(MAKE) python-test

python-build:
	cd sdk-python && uv run python -m build

go-generate:
	cd sdk-go && python scripts/generate_schema_module.py

go-check-generated:
	cd sdk-go && python scripts/generate_schema_module.py && git diff --exit-code -- schema_generated.go

go-check: go-check-generated
	cd sdk-go && test -z "$(gofmt -l .)"
	cd sdk-go && go vet ./...
	cd sdk-go && go test ./...

shared-check:
	cd sdk-node && pnpm exec vitest run tests/webhook/shared-fixtures.test.ts
	cd sdk-python && uv run pytest tests/test_shared_fixtures.py
	cd sdk-go && go test -run TestSharedCompatibilityFixtures ./...

check: node-check python-check go-check shared-check

build: node-build python-build
