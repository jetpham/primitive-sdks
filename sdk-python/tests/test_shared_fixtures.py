from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from primitive_sdk import (
    RawEmailDecodeError,
    WebhookValidationError,
    WebhookVerificationError,
    decode_raw_email,
    is_raw_included,
    safe_validate_email_received_event,
    sign_webhook_payload,
    validate_email_auth,
    validate_email_received_event,
    verify_raw_email_download,
    verify_webhook_signature,
)

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "test-fixtures"


def _load_json(*parts: str) -> Any:
    return json.loads((FIXTURES.joinpath(*parts)).read_text())


def test_shared_webhook_validation_cases() -> None:
    fixtures = _load_json("webhook", "validation-cases.json")["cases"]
    for case in fixtures:
        if case["expected"]["valid"]:
            event = validate_email_received_event(case["payload"])
            assert event.id == case["expected"]["id"]
            safe_result = safe_validate_email_received_event(case["payload"])
            assert safe_result.success is True
        else:
            with pytest.raises(WebhookValidationError) as error:
                validate_email_received_event(case["payload"])
            assert error.value.code == case["expected"]["error_code"]
            safe_result = safe_validate_email_received_event(case["payload"])
            assert safe_result.success is False
            assert safe_result.error.code == case["expected"]["error_code"]


def test_shared_signing_vectors() -> None:
    fixtures = _load_json("signing", "vectors.json")["cases"]
    for case in fixtures:
        signed = sign_webhook_payload(
            case["raw_body"], case["secret"], case["timestamp"]
        )
        assert signed["v1"] == case["expected_v1"]
        verify_secret = case.get("verify_secret", case["secret"])
        now_seconds = case.get("now_seconds", case["timestamp"])
        if case["expected_valid"]:
            assert (
                verify_webhook_signature(
                    raw_body=case["raw_body"],
                    signature_header=signed["header"],
                    secret=verify_secret,
                    now_seconds=now_seconds,
                )
                is True
            )
        else:
            with pytest.raises(WebhookVerificationError) as error:
                verify_webhook_signature(
                    raw_body=case["raw_body"],
                    signature_header=signed["header"],
                    secret=verify_secret,
                    now_seconds=now_seconds,
                )
            assert error.value.code == case["expected_error_code"]


def test_shared_auth_cases() -> None:
    fixtures = _load_json("auth", "cases.json")["cases"]
    for case in fixtures:
        result = validate_email_auth(case["input"])
        assert result.verdict == case["expected"]["verdict"]
        assert result.confidence == case["expected"]["confidence"]


def test_shared_raw_cases() -> None:
    fixtures = _load_json("raw", "cases.json")["cases"]
    for case in fixtures:
        event = case["event"]
        assert is_raw_included(event) is case["expected"]["included"]
        if "decoded_utf8" in case["expected"]:
            assert decode_raw_email(event).decode("utf-8") == case["expected"]["decoded_utf8"]
        if "decode_error_code" in case["expected"]:
            with pytest.raises(RawEmailDecodeError) as error:
                decode_raw_email(event)
            assert error.value.code == case["expected"]["decode_error_code"]
        if case["expected"].get("verify_download"):
            downloaded = case["download_bytes_utf8"].encode("utf-8")
            assert verify_raw_email_download(downloaded, event) == downloaded
