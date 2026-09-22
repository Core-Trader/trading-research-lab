"""Versioned JSON request and response helpers for the local worker."""

from __future__ import annotations

import json
from typing import Any

from . import CORE_VERSION, PROTOCOL_MAJOR
from .errors import RequestValidationError


def parse_request(line: str) -> dict[str, Any]:
    """Validate one NDJSON request without accepting unversioned input."""

    try:
        value = json.loads(line)
    except json.JSONDecodeError as error:
        raise RequestValidationError("Request is not valid JSON.") from error
    if not isinstance(value, dict):
        raise RequestValidationError("Request must be a JSON object.")
    if value.get("protocol") != PROTOCOL_MAJOR:
        raise RequestValidationError(
            "Unsupported protocol major version.",
            details={"expected": PROTOCOL_MAJOR, "received": value.get("protocol")},
        )
    request_id = value.get("request_id")
    method = value.get("method")
    params = value.get("params")
    if not isinstance(request_id, str) or not request_id.strip():
        raise RequestValidationError("request_id must be a non-empty string.")
    if not isinstance(method, str) or not method.strip():
        raise RequestValidationError("method must be a non-empty string.")
    if params is None:
        value["params"] = {}
    elif not isinstance(params, dict):
        raise RequestValidationError("params must be a JSON object.")
    return value


def success(request_id: str, result: dict[str, Any]) -> dict[str, Any]:
    return {
        "protocol": PROTOCOL_MAJOR,
        "request_id": request_id,
        "success": True,
        "result": result,
        "engine_version": CORE_VERSION,
    }


def failure(
    request_id: str | None, code: str, message: str, details: dict[str, object] | None = None
) -> dict[str, Any]:
    return {
        "protocol": PROTOCOL_MAJOR,
        "request_id": request_id,
        "success": False,
        "error": {"code": code, "message": message, "details": details or {}},
        "engine_version": CORE_VERSION,
    }


def encode(message: dict[str, Any]) -> str:
    """Encode compact stable JSON suitable for one UTF-8 NDJSON line."""

    return json.dumps(message, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
