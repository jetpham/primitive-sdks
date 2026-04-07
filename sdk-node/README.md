# `@primitivedotdev/sdk-node`

Official Primitive Node.js SDK for webhook verification and validation.

This package helps you:

- verify Primitive webhook signatures
- parse webhook request bodies
- validate webhook payloads against the canonical JSON schema
- work with typed `email.received` events in Node.js

## Requirements

- Node.js `>=22`

## Installation

```bash
npm install @primitivedotdev/sdk-node
```

## Basic Usage

```ts
import { handleWebhook, PrimitiveWebhookError } from "@primitivedotdev/sdk-node";

app.post("/webhooks/email", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const event = handleWebhook({
      body: req.body,
      headers: req.headers,
      secret: process.env.PRIMITIVE_WEBHOOK_SECRET!,
    });

    console.log("Email from:", event.email.headers.from);
    console.log("Subject:", event.email.headers.subject);

    res.json({ received: true });
  } catch (error) {
    if (error instanceof PrimitiveWebhookError) {
      return res.status(400).json({ error: error.code, message: error.message });
    }

    throw error;
  }
});
```

## API

### Main functions

- `handleWebhook(options)`
  - verifies the webhook signature
  - decodes and parses the request body
  - validates the payload
  - returns a typed `EmailReceivedEvent`
- `parseWebhookEvent(input)`
  - parses a JSON payload into a known webhook event or `UnknownEvent`
- `validateEmailReceivedEvent(input)`
  - validates an `email.received` payload and returns the typed event
- `safeValidateEmailReceivedEvent(input)`
  - returns `{ success, data }` or `{ success, error }`
- `verifyWebhookSignature(options)`
  - verifies `x-primitive-signature`
- `validateEmailAuth(auth)`
  - computes a verdict from SPF, DKIM, and DMARC results

### Helpful exports

- `emailReceivedEventJsonSchema`
- `WEBHOOK_VERSION`
- `PrimitiveWebhookError`
- `WebhookVerificationError`
- `WebhookPayloadError`
- `WebhookValidationError`
- `RawEmailDecodeError`

### Types

The package exports the main webhook types, including:

- `EmailReceivedEvent`
- `WebhookEvent`
- `UnknownEvent`
- `EmailAuth`
- `EmailAnalysis`
- `ParsedData`
- `RawContent`
- `WebhookAttachment`

## JSON Schema

The webhook payload contract is defined by the canonical JSON schema in the repository and is exported by this package as `emailReceivedEventJsonSchema`.

The SDK uses that schema to generate:

- TypeScript types
- runtime validators
- the published schema export

## Error Handling

All SDK-specific runtime errors extend `PrimitiveWebhookError` and include a stable error `code`.

```ts
import { PrimitiveWebhookError } from "@primitivedotdev/sdk-node";

try {
  // ...
} catch (error) {
  if (error instanceof PrimitiveWebhookError) {
    console.error(error.code, error.message);
  }
}
```

## Development

From `primitive-sdks/sdk-node`:

```bash
pnpm install
pnpm generate
pnpm typecheck
pnpm test
pnpm build
```

If you use Nix, from `primitive-sdks/`:

```bash
nix develop
```

## Repository Layout

```text
primitive-sdks/
  json-schema/
    email-received-event.schema.json
  sdk-node/
    src/
      webhook/
      validation.ts
      schema.generated.ts
      types.ts
      types.generated.ts
    scripts/
      generate-schema-module.ts
      generate-types.ts
      generate-validator.ts
```
