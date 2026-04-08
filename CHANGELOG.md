# Changelog

## Unreleased

### Breaking Changes

#### Node SDK

- Removed the `@primitivedotdev/sdk-node/webhook` subpath export. Import from `@primitivedotdev/sdk-node` instead.
- Added `signWebhookPayload` and `SignResult` to the root `@primitivedotdev/sdk-node` export surface.
- `parseWebhookEvent()` is stricter for known events and now validates them against the generated JSON Schema before returning typed payloads.
- `WebhookValidationError` no longer exposes Zod-specific internals. Use `.validationErrors` instead of `.zodError`.
- `safeValidateEmailReceivedEvent()` now returns the SDK's custom `ValidationResult<T>` shape instead of Zod's `SafeParseReturnType`.

#### Contract Node

- Replaced `@primitivedotdev/sdk-node/contract` with the new `@primitivedotdev/contract-node` package.
- `buildEmailReceivedEvent()` now validates the generated payload against the canonical JSON Schema before returning.
- `EmailReceivedEventInput.smtp_rcpt_to` is now typed as a non-empty tuple, `[string, ...string[]]`, to match the schema's `minItems: 1` requirement.

### Migration Notes

#### Import Path Changes

Old:

```ts
import { handleWebhook } from "@primitivedotdev/sdk-node/webhook";
import { buildEmailReceivedEvent } from "@primitivedotdev/sdk-node/contract";
```

New:

```ts
import { handleWebhook } from "@primitivedotdev/sdk-node";
import { buildEmailReceivedEvent } from "@primitivedotdev/contract-node";
```

#### Validation Error Internals

If you were inspecting validation internals directly:

- replace `.zodError` with `.validationErrors`
- update any code expecting Zod safe-parse return shapes from `safeValidateEmailReceivedEvent()`

#### Contract Builders

`buildEmailReceivedEvent()` is now schema-backed at runtime. Inputs that were loosely accepted before may now fail earlier if they do not match the canonical Primitive webhook schema.
