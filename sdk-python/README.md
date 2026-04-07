# `primitive-sdk`

Official Primitive Python SDK for webhook verification and validation.

This package helps you:

- verify Primitive webhook signatures
- parse webhook request bodies
- validate webhook payloads against the canonical JSON schema
- work with `email.received` events in Python

Validated events are returned as generated Pydantic models derived from the
canonical JSON schema.

## Installation

```bash
pip install primitive-sdk
```

## Basic Usage

```python
from primitive_sdk import handle_webhook, PrimitiveWebhookError

def webhook_handler(body: bytes, headers: dict[str, str]) -> dict[str, object]:
    try:
        event = handle_webhook(
            body=body,
            headers=headers,
            secret="whsec_...",
        )

        print("Email from:", event.email.headers.from_)
        print("Subject:", event.email.headers.subject)
        return {"received": True}
    except PrimitiveWebhookError as error:
        return {"error": error.code, "message": str(error)}
```

## Parsing Events

- `parse_webhook_event(input)` strictly validates known event types such as `email.received`
- malformed known events raise `WebhookValidationError`
- unknown future event types are returned as dictionaries for forward compatibility

## Development

```bash
uv sync --dev
uv run python scripts/generate_schema_module.py
uv run python scripts/generate_models.py
uv run pytest
uv run ruff check .
uv run basedpyright
uv run python -m build
```
