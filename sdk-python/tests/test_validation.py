from __future__ import annotations

from typing import Any

import pytest

from primitive_sdk import (
    ValidationFailure,
    WebhookValidationError,
    safe_validate_email_received_event,
    validate_email_received_event,
)


def test_validate_email_received_event_accepts_valid_payload(
    valid_payload: dict[str, Any],
) -> None:
    event = validate_email_received_event(valid_payload)
    assert event.id == "evt_abc123"


def test_validate_email_received_event_rejects_invalid_payload() -> None:
    with pytest.raises(WebhookValidationError):
        validate_email_received_event({})


def test_safe_validate_email_received_event_returns_failure_shape() -> None:
    result = safe_validate_email_received_event({"event": "email.received"})
    assert isinstance(result, ValidationFailure)
    assert result.error.code == "SCHEMA_VALIDATION_FAILED"


def test_validate_email_received_event_accepts_date_formatted_version(
    valid_payload: dict[str, Any],
) -> None:
    event = validate_email_received_event({**valid_payload, "version": "2030-12-31"})
    assert event.version.root == "2030-12-31"


def test_validate_email_received_event_accepts_extra_unknown_fields(
    valid_payload: dict[str, Any],
) -> None:
    event = validate_email_received_event(
        {
            **valid_payload,
            "extra_field": "ok",
            "delivery": {**valid_payload["delivery"], "extra_delivery": True},
            "email": {
                **valid_payload["email"],
                "auth": {**valid_payload["email"]["auth"], "extra_auth": "ok"},
            },
        }
    )
    assert event.id == "evt_abc123"


def test_validate_email_received_event_rejects_javascript_download_url(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(WebhookValidationError):
        validate_email_received_event(
            {
                **valid_payload,
                "email": {
                    **valid_payload["email"],
                    "content": {
                        **valid_payload["email"]["content"],
                        "download": {
                            **valid_payload["email"]["content"]["download"],
                            "url": "javascript:alert(1)",
                        },
                    },
                },
            }
        )


def test_validate_email_received_event_rejects_http_attachments_download_url(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(WebhookValidationError):
        validate_email_received_event(
            {
                **valid_payload,
                "email": {
                    **valid_payload["email"],
                    "parsed": {
                        **valid_payload["email"]["parsed"],
                        "attachments_download_url": "http://example.com/attachments",
                    },
                },
            }
        )


def test_validate_email_received_event_accepts_https_attachments_download_url(
    valid_payload: dict[str, Any],
) -> None:
    event = validate_email_received_event(
        {
            **valid_payload,
            "email": {
                **valid_payload["email"],
                "parsed": {
                    **valid_payload["email"]["parsed"],
                    "attachments_download_url": (
                        "https://api.primitive.dev/v1/downloads/attachments/token456"
                    ),
                },
            },
        }
    )
    assert event.id == "evt_abc123"


def test_validate_email_received_event_rejects_fractional_dkim_key_bits(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(WebhookValidationError):
        validate_email_received_event(
            {
                **valid_payload,
                "email": {
                    **valid_payload["email"],
                    "auth": {
                        **valid_payload["email"]["auth"],
                        "dkimSignatures": [
                            {
                                **valid_payload["email"]["auth"]["dkimSignatures"][0],
                                "keyBits": 1024.5,
                            }
                        ],
                    },
                },
            }
        )


def test_validate_email_received_event_rejects_oversized_dkim_key_bits(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(WebhookValidationError):
        validate_email_received_event(
            {
                **valid_payload,
                "email": {
                    **valid_payload["email"],
                    "auth": {
                        **valid_payload["email"]["auth"],
                        "dkimSignatures": [
                            {
                                **valid_payload["email"]["auth"]["dkimSignatures"][0],
                                "keyBits": 20000,
                            }
                        ],
                    },
                },
            }
        )


def test_validate_email_received_event_rejects_negative_forward_attachment_counters(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(WebhookValidationError):
        validate_email_received_event(
            {
                **valid_payload,
                "email": {
                    **valid_payload["email"],
                    "analysis": {
                        "forward": {
                            "detected": False,
                            "results": [],
                            "attachments_found": -1,
                            "attachments_analyzed": 0,
                            "attachments_limit": None,
                        }
                    },
                },
            }
        )


def test_validate_email_received_event_rejects_zero_forward_attachments_limit(
    valid_payload: dict[str, Any],
) -> None:
    with pytest.raises(WebhookValidationError):
        validate_email_received_event(
            {
                **valid_payload,
                "email": {
                    **valid_payload["email"],
                    "analysis": {
                        "forward": {
                            "detected": False,
                            "results": [],
                            "attachments_found": 0,
                            "attachments_analyzed": 0,
                            "attachments_limit": 0,
                        }
                    },
                },
            }
        )


def test_validate_email_received_event_accepts_valid_forward_attachment_counters(
    valid_payload: dict[str, Any],
) -> None:
    event = validate_email_received_event(
        {
            **valid_payload,
            "email": {
                **valid_payload["email"],
                "analysis": {
                    "forward": {
                        "detected": True,
                        "results": [],
                        "attachments_found": 2,
                        "attachments_analyzed": 1,
                        "attachments_limit": 10,
                    }
                },
            },
        }
    )
    assert event.id == "evt_abc123"
