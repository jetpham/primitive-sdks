# Primitive SDKs

[![SDK Checks](https://github.com/jetpham/primitive-sdks/actions/workflows/sdk-checks.yml/badge.svg?branch=main)](https://github.com/jetpham/primitive-sdks/actions/workflows/sdk-checks.yml)

Monorepo for Primitive webhook SDKs.

The repository currently contains:

- `sdk-node/` for the Node.js SDK
- `sdk-python/` for the Python SDK
- `sdk-go/` for the Go SDK
- `json-schema/` for the canonical webhook schema
- `test-fixtures/` for shared cross-SDK compatibility fixtures

## Purpose

Each SDK implements the same core webhook workflow:

- verify Primitive webhook signatures
- parse request bodies
- validate payloads against the canonical JSON schema
- expose typed `email.received` events in the target language

## Repository Layout

```text
primitive-sdks/
  .github/workflows/
  json-schema/
  sdk-go/
  sdk-node/
  sdk-python/
  test-fixtures/
```

## Development

If you use Nix, install the shared toolchain with:

```bash
nix develop
```

Use the root `Makefile` as the main task interface:

```bash
make check
make shared-check
make build
```

The `Makefile` wraps each SDK's native commands. You can still run them directly from each SDK directory when needed:

```bash
cd sdk-node && pnpm install && pnpm typecheck && pnpm test
cd sdk-python && uv sync --dev && uv run pytest && uv run ruff check . && uv run basedpyright
cd sdk-go && go test ./... && go test -run TestSharedCompatibilityFixtures ./...
```

## CI

`.github/workflows/sdk-checks.yml` runs:

- Node SDK checks
- Python SDK checks
- Go SDK checks
- shared fixture compatibility checks across all three SDKs
