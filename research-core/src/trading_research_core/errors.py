"""Protocol-safe errors raised by the research core."""

from __future__ import annotations


class CoreError(Exception):
    """An expected error that can safely cross the NDJSON boundary."""

    def __init__(self, code: str, message: str, *, details: dict[str, object] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}


class RequestValidationError(CoreError):
    """Raised when an IPC request does not meet the versioned contract."""

    def __init__(self, message: str, *, details: dict[str, object] | None = None) -> None:
        super().__init__("E_REQUEST_INVALID", message, details=details)
