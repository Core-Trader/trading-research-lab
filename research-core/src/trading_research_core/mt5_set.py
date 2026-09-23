"""MT5 `.set` files as the MT5-verified parameter schema and default (PX-004).

Line format written by MetaTrader 5 for EA inputs:

    name=value||start||step||stop||Y|N     (optimisable inputs)
    name=value                              (inputs without a range)

Lines starting with ';' are comments. MT5 writes UTF-16 LE with a BOM; UTF-8
is also accepted. The value column is the EA's configured (default) setting.
Nothing is inferred beyond the file: kind and ordinal status follow from the
text, and the owner may override ordinal later (PX-005).
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from hashlib import sha256
import json
import os
from pathlib import Path
import shutil
from tempfile import NamedTemporaryFile
from typing import Any

from .errors import CoreError
from .identities import stable_uuid


PARSER_VERSION = "mt5-set-parser-1"
MAX_GRID_SIZE_REPORTED = 10 ** 15


def parse_set_text(text: str) -> list[dict[str, Any]]:
    """Parse `.set` text into ordered parameter definitions."""

    parameters: list[dict[str, Any]] = []
    seen: set[str] = set()
    for number, raw_line in enumerate(text.splitlines(), start=1):
        line = raw_line.strip().lstrip("﻿")
        if not line or line.startswith(";"):
            continue
        name, separator, rest = line.partition("=")
        name = name.strip()
        if not separator or not name:
            raise CoreError("E_SET_LAYOUT_UNSUPPORTED", "A .set line is not in name=value form.", details={"line": number})
        if name in seen:
            raise CoreError("E_SET_LAYOUT_UNSUPPORTED", "A parameter appears twice in the .set file.", details={"line": number, "name": name})
        seen.add(name)
        fields = rest.split("||")
        value = fields[0]
        if len(fields) == 1:
            parameters.append(_definition(name, value, None, None, None, False))
            continue
        if len(fields) != 5 or fields[4].strip().upper() not in {"Y", "N"}:
            raise CoreError("E_SET_LAYOUT_UNSUPPORTED", "An optimisable .set line needs value||start||step||stop||Y/N.", details={"line": number, "name": name})
        parameters.append(_definition(name, value, fields[1], fields[2], fields[3], fields[4].strip().upper() == "Y"))
    if not parameters:
        raise CoreError("E_SET_LAYOUT_UNSUPPORTED", "The .set file contains no parameters.")
    return parameters


def decode_set_bytes(raw: bytes) -> tuple[str, str]:
    """Return (text, encoding). MT5 normally writes UTF-16 LE with a BOM."""

    if raw.startswith(b"\xff\xfe") or raw.startswith(b"\xfe\xff"):
        return raw.decode("utf-16"), "UTF-16"
    if raw.startswith(b"\xef\xbb\xbf"):
        return raw[3:].decode("utf-8"), "UTF-8-BOM"
    if b"\x00" in raw[:200]:
        try:
            return raw.decode("utf-16-le"), "UTF-16-LE"
        except UnicodeDecodeError as error:
            raise CoreError("E_SET_ENCODING_UNSUPPORTED", "The .set file encoding could not be read.") from error
    try:
        return raw.decode("utf-8"), "UTF-8"
    except UnicodeDecodeError as error:
        raise CoreError("E_SET_ENCODING_UNSUPPORTED", "The .set file is neither UTF-16 nor UTF-8.") from error


def intake_parameter_schema(workspace_root: Path, source_path: str) -> dict[str, object]:
    """Snapshot one `.set` file immutably and return its parameter schema."""

    source = Path(source_path).expanduser().resolve()
    if source.suffix.lower() != ".set" or not source.is_file():
        raise CoreError("E_SET_SOURCE_INVALID", "Select an existing MT5 .set file.")
    raw = source.read_bytes()
    source_hash = sha256(raw).hexdigest().upper()
    text, encoding = decode_set_bytes(raw)
    parameters = parse_set_text(text)
    root = workspace_root.resolve()
    target = _bounded(root, "parameter-schemas", source_hash)
    target.mkdir(parents=True, exist_ok=True)
    snapshot = target / "source.set"
    created = _ensure_snapshot(snapshot, source, source_hash)
    schema = schema_document(parameters, source.name, source_hash, encoding)
    manifest_path = target / "schema.json"
    if not manifest_path.is_file():
        _atomic_json(manifest_path, schema)
    return {**schema, "intake_status": "SNAPSHOT_CREATED" if created else "REUSED_IDENTICAL_SOURCE"}


def schema_document(parameters: list[dict[str, Any]], filename: str, source_hash: str, encoding: str) -> dict[str, object]:
    optimised = [parameter for parameter in parameters if parameter["optimise"]]
    sizes = [parameter["value_count"] for parameter in optimised]
    grid = None
    if optimised and all(size is not None for size in sizes):
        grid = 1
        for size in sizes:
            grid *= size
    return {
        "schema_ref": f"mt5-set:{source_hash}",
        "schema_id": stable_uuid("mt5-set", source_hash, PARSER_VERSION),
        "parser_version": PARSER_VERSION,
        "source": {"filename": filename, "sha256": source_hash, "encoding": encoding},
        "parameter_count": len(parameters),
        "optimised_parameters": [parameter["name"] for parameter in optimised],
        "full_grid_size": None if grid is None else (str(grid) if grid <= MAX_GRID_SIZE_REPORTED else f">{MAX_GRID_SIZE_REPORTED}"),
        "parameters": parameters,
        "default": {parameter["name"]: parameter["value"] for parameter in parameters},
        "warnings": [
            "The value column is the EA's configured setting in this file; TRL treats it as the default reference point.",
            "Parameter kind and ordinal status are read from the file; the owner may mark a parameter categorical.",
        ],
    }


def read_schema(workspace_root: Path, schema_ref: str) -> dict[str, Any]:
    source_hash = _ref_hash(schema_ref, "mt5-set:")
    path = _bounded(workspace_root.resolve(), "parameter-schemas", source_hash, "schema.json")
    if not path.is_file():
        raise CoreError("E_SET_NOT_FOUND", "The parameter schema has not been imported.", details={"schema_ref": schema_ref})
    return json.loads(path.read_text(encoding="utf-8"))


def _definition(name: str, value: str, start: str | None, step: str | None, stop: str | None, optimise: bool) -> dict[str, Any]:
    numbers = [_number(item) for item in (value, start, step, stop)]
    ranged = start is not None
    numeric = numbers[0] is not None and (not ranged or all(number is not None for number in numbers[1:]))
    boolean = value.strip().lower() in {"true", "false"}
    kind = "BOOLEAN" if boolean else "NUMERIC" if numeric else "TEXT"
    value_count = None
    ordinal = False
    if kind == "NUMERIC" and ranged:
        begin, increment, end = numbers[1], numbers[2], numbers[3]
        assert begin is not None and increment is not None and end is not None
        if increment > 0 and end >= begin:
            value_count = int((end - begin) / increment) + 1
            ordinal = True
        elif increment == 0 and end >= begin and begin == begin.to_integral_value() and end == end.to_integral_value():
            # MT5 step 0 on an integer range: each integer is a mode/value (categorical by default).
            value_count = int(end - begin) + 1
    elif kind == "BOOLEAN" and ranged:
        value_count = 2
    return {
        "name": name,
        "value": value.strip(),
        "start": None if start is None else start.strip(),
        "step": None if step is None else step.strip(),
        "stop": None if stop is None else stop.strip(),
        "optimise": optimise,
        "kind": kind,
        "ordinal": ordinal,
        "value_count": value_count,
    }


def _number(text: str | None) -> Decimal | None:
    if text is None:
        return None
    try:
        value = Decimal(text.strip())
    except (InvalidOperation, ValueError):
        return None
    return value if value.is_finite() else None


def _ref_hash(ref: str, prefix: str) -> str:
    value = ref.removeprefix(prefix)
    if not ref.startswith(prefix) or len(value) != 64 or any(character not in "0123456789ABCDEF" for character in value):
        raise CoreError("E_REQUEST_INVALID", f"Expected a {prefix}<SHA256> reference.", details={"ref": ref})
    return value


def _ensure_snapshot(target: Path, source: Path, expected_hash: str) -> bool:
    if target.is_file():
        if sha256(target.read_bytes()).hexdigest().upper() != expected_hash:
            raise CoreError("E_RAW_SNAPSHOT_MISMATCH", "Existing .set snapshot hash does not match the selected source.")
        return False
    with NamedTemporaryFile(delete=False, dir=target.parent, prefix="snapshot-", suffix=".tmp") as temporary:
        temporary_path = Path(temporary.name)
    try:
        shutil.copyfile(source, temporary_path)
        if sha256(temporary_path.read_bytes()).hexdigest().upper() != expected_hash:
            raise CoreError("E_RAW_SNAPSHOT_MISMATCH", "Copied .set snapshot hash does not match the selected source.")
        os.replace(temporary_path, target)
    finally:
        temporary_path.unlink(missing_ok=True)
    return True


def _bounded(root: Path, *parts: str) -> Path:
    candidate = root.joinpath(*parts).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise CoreError("E_PATH_INVALID", "Schema path escapes the worker workspace.") from error
    return candidate


def _atomic_json(path: Path, value: object) -> None:
    with NamedTemporaryFile("w", delete=False, dir=path.parent, encoding="utf-8", prefix="schema-", suffix=".tmp") as temporary:
        json.dump(value, temporary, ensure_ascii=False, indent=2, sort_keys=True)
        temporary.write("\n")
        temporary_path = Path(temporary.name)
    os.replace(temporary_path, path)
