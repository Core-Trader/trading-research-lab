"""Stable, source-derived identifiers for reproducible canonical artefacts."""

from __future__ import annotations

import uuid


# This fixed namespace identifies Trading Research Lab canonical identities. It
# is not a secret and must never change: UUIDv5 derives the same identifier from
# the same namespace, identity kind, and normalized component sequence.
_CANONICAL_IDENTITY_NAMESPACE = uuid.UUID("7f53f83b-7ed1-5b63-8b71-c2795281ac4c")


def stable_uuid(kind: str, *components: str) -> str:
    """Return a UUIDv5 for a stable, domain-separated canonical identity.

    UUIDv5 is used as an identifier, not as a security checksum. Source content
    is independently identified by SHA-256 in the provenance metadata.
    """

    if not kind or any(not component for component in components):
        raise ValueError("Canonical identity kind and components must be non-empty.")
    value = "\x1f".join((kind, *components))
    return str(uuid.uuid5(_CANONICAL_IDENTITY_NAMESPACE, value))
