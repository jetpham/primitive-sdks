# `@primitivedotdev/contract-node`

Server-side webhook contract tooling for Primitive on Node.js.

Use this package when you need to construct or sign Primitive webhook payloads on
the producer side, such as in the Primitive server, fixture generators, or local
integration tooling.

## Installation

```bash
npm install @primitivedotdev/contract-node @primitivedotdev/sdk-node
```

## Exports

- `buildEmailReceivedEvent(input, options?)`
- `generateEventId(endpointId, emailId)`
- `RAW_EMAIL_INLINE_THRESHOLD`
- `WEBHOOK_VERSION`
- `signWebhookPayload(rawBody, secret, timestamp?)`

## When to use this package

- building canonical `email.received` payloads server-side
- generating signed webhook fixtures for tests
- keeping server payload construction aligned with the published SDK schema

For receiving and verifying webhooks in applications, use
`@primitivedotdev/sdk-node`.
