from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Any, cast

import pytest

from primitive_sdk import (
    PrimitiveWebhookError,
    RawEmailDecodeError,
    WebhookPayloadError,
    WebhookValidationError,
    confirmed_headers,
    decode_raw_email,
    get_download_time_remaining,
    handle_webhook,
    is_download_expired,
    is_email_received_event,
    is_raw_included,
    parse_webhook_event,
    sign_webhook_payload,
    validate_email_auth,
    verify_raw_email_download,
)


def test_parse_webhook_event_handles_known_and_unknown_events() -> None:
    assert is_email_received_event(
        parse_webhook_event({"event": "email.received", "id": "x"})
    )
    unknown = cast(
        dict[str, Any],
        parse_webhook_event({"event": "email.bounced", "id": "y"}),
    )
    assert unknown["event"] == "email.bounced"


def test_parse_webhook_event_rejects_bad_inputs() -> None:
    with pytest.raises(WebhookPayloadError):
        parse_webhook_event(None)
    with pytest.raises(WebhookPayloadError):
        parse_webhook_event()
    with pytest.raises(WebhookPayloadError):
        parse_webhook_event({"id": "test"})
    with pytest.raises(WebhookPayloadError):
        parse_webhook_event({"event": 123})
    with pytest.raises(WebhookPayloadError):
        parse_webhook_event([{"event": "email.received"}])


def test_handle_webhook_round_trip(valid_payload: dict[str, Any]) -> None:
    secret = "test-webhook-secret"
    body = json.dumps(valid_payload)
    header = sign_webhook_payload(body, secret)["header"]
    event = handle_webhook(
        body=body,
        headers={"primitive-signature": str(header)},
        secret=secret,
    )
    assert event.event == "email.received"


def test_handle_webhook_accepts_bytes_body(valid_payload: dict[str, Any]) -> None:
    secret = "test-webhook-secret"
    body = json.dumps(valid_payload).encode()
    header = sign_webhook_payload(body, secret)["header"]

    event = handle_webhook(
        body=body,
        headers={"primitive-signature": str(header)},
        secret=secret,
    )

    assert event.id == "evt_abc123"


def test_handle_webhook_accepts_custom_tolerance(valid_payload: dict[str, Any]) -> None:
    secret = "test-webhook-secret"
    body = json.dumps(valid_payload)
    timestamp = int(datetime.now(tz=UTC).timestamp()) - 500
    header = sign_webhook_payload(body, secret, timestamp)["header"]

    event = handle_webhook(
        body=body,
        headers={"primitive-signature": str(header)},
        secret=secret,
        tolerance_seconds=1000,
    )

    assert event.id == "evt_abc123"


def test_handle_webhook_finds_signature_with_original_header_casing(
    valid_payload: dict[str, Any],
) -> None:
    secret = "test-webhook-secret"
    body = json.dumps(valid_payload)
    header = sign_webhook_payload(body, secret)["header"]

    event = handle_webhook(
        body=body,
        headers={"Primitive-Signature": str(header)},
        secret=secret,
    )

    assert event.id == "evt_abc123"


def test_handle_webhook_finds_signature_with_uppercase_header_name(
    valid_payload: dict[str, Any],
) -> None:
    secret = "test-webhook-secret"
    body = json.dumps(valid_payload)
    header = sign_webhook_payload(body, secret)["header"]

    event = handle_webhook(
        body=body,
        headers={"PRIMITIVE-SIGNATURE": str(header)},
        secret=secret,
    )

    assert event.id == "evt_abc123"


def test_handle_webhook_rejects_invalid_version_format(
    valid_payload: dict[str, Any],
) -> None:
    secret = "test-webhook-secret"
    body = json.dumps({**valid_payload, "version": "not-a-date"})
    header = sign_webhook_payload(body, secret)["header"]

    with pytest.raises(WebhookValidationError):
        handle_webhook(
            body=body,
            headers={"primitive-signature": str(header)},
            secret=secret,
        )


def test_handle_webhook_rejects_invalid_json(secret: str = "test-webhook-secret") -> None:
    body = "{invalid json"
    header = sign_webhook_payload(body, secret)["header"]
    with pytest.raises(WebhookPayloadError):
        handle_webhook(
            body=body,
            headers={"primitive-signature": str(header)},
            secret=secret,
        )


def test_handle_webhook_rejects_invalid_payload_structure(secret: str = "test-webhook-secret") -> None:
    body = json.dumps({"event": "email.received", "id": "test"})
    header = sign_webhook_payload(body, secret)["header"]
    with pytest.raises(WebhookValidationError):
        handle_webhook(
            body=body,
            headers={"primitive-signature": str(header)},
            secret=secret,
        )


def test_confirmed_headers() -> None:
    assert confirmed_headers() == {"X-Primitive-Confirmed": "true"}


def test_download_helpers(valid_payload: dict[str, Any]) -> None:
    event = valid_payload
    future_now = 1734177600000
    assert is_download_expired(event, future_now) is False
    assert get_download_time_remaining(event, future_now) > 0


def test_download_helpers_handle_exact_and_past_expiration() -> None:
    event = {
        "email": {
            "content": {
                "download": {
                    "url": "https://example.com",
                    "expires_at": "2025-01-01T00:00:00.000Z",
                }
            }
        }
    }
    exact_ms = 1735689600000
    past_ms = exact_ms + 1
    assert is_download_expired(event, exact_ms) is True
    assert get_download_time_remaining(event, past_ms) == 0


def test_raw_email_helpers(valid_payload: dict[str, Any]) -> None:
    event = valid_payload
    assert is_raw_included(event) is True
    assert decode_raw_email(event) == b"Hello World"
    downloaded = b"Hello World"
    assert verify_raw_email_download(downloaded, event) == downloaded


def test_decode_raw_email_skips_verification_when_requested(
    valid_payload: dict[str, Any],
) -> None:
    event = valid_payload
    event["email"]["content"]["raw"]["sha256"] = hashlib.sha256(b"other").hexdigest()
    assert decode_raw_email(event, verify=False) == b"Hello World"


def test_raw_email_hash_mismatch(valid_payload: dict[str, Any]) -> None:
    event = valid_payload
    event["email"]["content"]["raw"]["sha256"] = hashlib.sha256(b"other").hexdigest()
    with pytest.raises(RawEmailDecodeError):
        decode_raw_email(event)


def test_decode_raw_email_rejects_download_only_content() -> None:
    event = {
        "email": {
            "content": {
                "raw": {
                    "included": False,
                    "reason_code": "size_exceeded",
                    "size_bytes": 500000,
                    "max_inline_bytes": 262144,
                    "sha256": "abc",
                },
                "download": {
                    "url": "https://example.com",
                    "expires_at": "2025-01-01T00:00:00Z",
                },
            }
        }
    }
    with pytest.raises(RawEmailDecodeError):
        decode_raw_email(event)


def test_verify_raw_email_download_accepts_empty_and_binary_content() -> None:
    empty = b""
    empty_sha = hashlib.sha256(empty).hexdigest()
    empty_event = {
        "email": {
            "content": {
                "raw": {
                    "included": False,
                    "reason_code": "size_exceeded",
                    "size_bytes": 0,
                    "max_inline_bytes": 262144,
                    "sha256": empty_sha,
                }
            }
        }
    }
    assert verify_raw_email_download(empty, empty_event) == empty

    binary = bytes([0x00, 0x01, 0x02, 0xFF, 0xFE, 0xFD, 0x89, 0x50, 0x4E, 0x47])
    binary_sha = hashlib.sha256(binary).hexdigest()
    binary_event = {
        "email": {
            "content": {
                "raw": {
                    "included": False,
                    "reason_code": "size_exceeded",
                    "size_bytes": len(binary),
                    "max_inline_bytes": 262144,
                    "sha256": binary_sha,
                }
            }
        }
    }
    assert verify_raw_email_download(memoryview(binary), binary_event) == binary


def test_validate_email_auth(valid_payload: dict[str, Any]) -> None:
    result = validate_email_auth(valid_payload["email"]["auth"])
    assert result.verdict == "legit"
    assert result.confidence == "high"
    assert any("DKIM alignment" in reason for reason in result.reasons)


def test_error_hierarchy() -> None:
    error = RawEmailDecodeError("NOT_INCLUDED")
    assert isinstance(error, PrimitiveWebhookError)
