"""Source-preserving MT5 SpreadsheetML parameter-grid intake for M6."""

from __future__ import annotations

import json
import os
import shutil
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from hashlib import sha256
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

from . import CORE_VERSION
from .errors import CoreError
from .identities import stable_uuid


ADAPTER_ID = "mt5-optimisation-spreadsheetml"
ADAPTER_VERSION = "1"
TABLE_TYPE = "PARAMETER_GRID_IN_SAMPLE_OR_UNDECLARED"
NAMESPACE = "urn:schemas-microsoft-com:office:spreadsheet"


def intake_parameter_grid(workspace_root: Path, source_path: str, modelling_mode: str) -> dict[str, object]:
    """Snapshot and expose one explicit MT5 parameter-grid export without ranking it."""

    source = Path(source_path).expanduser().resolve()
    if source.suffix.lower() != ".xml" or not source.is_file():
        raise CoreError("E_OPTIMISATION_SOURCE_INVALID", "Select an existing MT5 optimisation .xml export.")
    mode = modelling_mode.strip()
    if not mode:
        raise CoreError("E_REQUEST_INVALID", "params.modelling_mode must be a non-empty user-supplied declaration.")
    raw = source.read_bytes()
    source_hash = sha256(raw).hexdigest().upper()
    parsed = _parse(source, source_hash)
    root = workspace_root.resolve()
    target = _bounded(root, "optimisations", source_hash)
    snapshot = _bounded(root, "optimisation-raw", source_hash, "source.xml")
    created = _ensure_snapshot(snapshot, source, source_hash)
    target.mkdir(parents=True, exist_ok=True)
    metadata_path = target / "manifest.json"
    table_path = target / "passes.parquet"
    ref = f"mt5-optimisation:{source_hash}"
    try:
        import pyarrow as pa
        import pyarrow.parquet as pq
    except ImportError as error:
        raise CoreError("E_DEPENDENCY_MISSING", "pyarrow is required for optimisation evidence storage.") from error
    configuration = {"adapter_id": ADAPTER_ID, "adapter_version": ADAPTER_VERSION, "modelling_mode": mode, "modelling_mode_source": "USER_SUPPLIED"}
    configuration_hash = sha256(json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode()).hexdigest().upper()
    manifest = {
        "schema_version": "1.0", "optimisation_ref": ref,
        "optimisation_id": stable_uuid("mt5-optimisation", source_hash),
        "source": {"filename": source.name, "sha256": source_hash, "byte_count": len(raw), "original_selected_path": str(source), "raw_snapshot_path": str(snapshot)},
        "adapter": configuration, "configuration_sha256": configuration_hash,
        "table_type": TABLE_TYPE, "worksheet_name": parsed["worksheet_name"],
        "report_metadata": parsed["report_metadata"], "headers": parsed["headers"],
        "parameter_columns": parsed["parameter_columns"], "metric_columns": parsed["metric_columns"],
        "pass_count": len(parsed["rows"]), "core_version": CORE_VERSION,
        "limitations": _limitations(),
    }
    if not (metadata_path.is_file() and table_path.is_file()):
        try:
            pq.write_table(pa.Table.from_pylist(parsed["rows"]), table_path, compression="zstd", use_dictionary=False, write_statistics=True)
            _atomic_json(metadata_path, manifest)
        except Exception:
            if created:
                snapshot.unlink(missing_ok=True)
            raise
    return {**manifest, "intake_status": "SNAPSHOT_CREATED" if created else "REUSED_IDENTICAL_SOURCE", "artifacts": {"table": f"{ref}:passes", "manifest": f"{ref}:manifest"}, "rows": parsed["rows"], "warnings": _limitations()}


def intake_paired_forward_grid(
    workspace_root: Path, in_sample_path: str, forward_path: str,
    in_sample_start: str, in_sample_end: str, forward_start: str,
    forward_end: str, modelling_mode: str,
) -> dict[str, object]:
    """Create strict, source-preserved paired forward evidence."""

    context = _validate_context(in_sample_start, in_sample_end, forward_start, forward_end, modelling_mode)
    left_path, left_hash = _source_file(in_sample_path)
    right_path, right_hash = _source_file(forward_path)
    if left_hash == right_hash:
        raise CoreError("E_FORWARD_SOURCES_IDENTICAL", "In-sample and forward sources must be different files.")
    left, right = _parse(left_path, left_hash), _parse(right_path, right_hash)
    if left["parameter_columns"] != right["parameter_columns"]:
        raise CoreError("E_FORWARD_PARAMETER_SCHEMA_MISMATCH", "In-sample and forward parameter columns differ.")
    parameters = list(left["parameter_columns"])
    left_index = _signature_index(left["rows"], parameters, "in-sample")
    right_index = _signature_index(right["rows"], parameters, "forward")
    if set(left_index) != set(right_index):
        raise CoreError("E_FORWARD_PAIRING_INCOMPLETE", "Every parameter signature must occur exactly once in both sources.", details={"in_sample_count": len(left_index), "forward_count": len(right_index)})
    root = workspace_root.resolve()
    _ensure_snapshot(_bounded(root, "optimisation-raw", left_hash, "source.xml"), left_path, left_hash)
    _ensure_snapshot(_bounded(root, "optimisation-raw", right_hash, "source.xml"), right_path, right_hash)
    pair_identity = sha256(json.dumps({"in_sample": left_hash, "forward": right_hash, "context": context}, sort_keys=True, separators=(",", ":")).encode()).hexdigest().upper()
    target = _bounded(root, "optimisation-pairs", pair_identity)
    target.mkdir(parents=True, exist_ok=True)
    table_path, manifest_path = target / "pairs.parquet", target / "manifest.json"
    metric_columns = sorted(set(left["metric_columns"]) & set(right["metric_columns"]))
    pair_rows: list[dict[str, str]] = []
    for signature in sorted(left_index):
        in_row, fw_row = left_index[signature], right_index[signature]
        pair_rows.append({
            "trl_parameter_signature": signature, "in_sample_pass": in_row["Pass"], "forward_pass": fw_row["Pass"],
            **{column: in_row[column] for column in parameters},
            **{f"in_sample__{column}": in_row[column] for column in metric_columns},
            **{f"forward__{column}": fw_row[column] for column in metric_columns},
        })
    ref = f"mt5-forward-pair:{pair_identity}"
    manifest = {"schema_version": "1.0", "pair_ref": ref, "pair_id": stable_uuid("mt5-forward-pair", pair_identity), "in_sample_source": _source_record(left_path, left_hash), "forward_source": _source_record(right_path, right_hash), "context": context, "parameter_columns": parameters, "metric_columns": metric_columns, "pair_count": len(pair_rows), "core_version": CORE_VERSION, "limitations": _pair_limitations()}
    if not (table_path.is_file() and manifest_path.is_file()):
        try:
            import pyarrow as pa
            import pyarrow.parquet as pq
            pq.write_table(pa.Table.from_pylist(pair_rows), table_path, compression="zstd", use_dictionary=False, write_statistics=True)
            _atomic_json(manifest_path, manifest)
        except ImportError as error:
            raise CoreError("E_DEPENDENCY_MISSING", "pyarrow is required for paired forward evidence storage.") from error
    return {**manifest, "artifacts": {"table": f"{ref}:pairs", "manifest": f"{ref}:manifest"}, "rows": pair_rows, "warnings": _pair_limitations()}


def _source_file(source_path: str) -> tuple[Path, str]:
    path = Path(source_path).expanduser().resolve()
    if path.suffix.lower() != ".xml" or not path.is_file():
        raise CoreError("E_OPTIMISATION_SOURCE_INVALID", "Select an existing MT5 optimisation .xml export.")
    return path, sha256(path.read_bytes()).hexdigest().upper()


def _source_record(path: Path, source_hash: str) -> dict[str, object]:
    return {"filename": path.name, "sha256": source_hash, "byte_count": path.stat().st_size, "original_selected_path": str(path), "managed_snapshot_ref": f"optimisation-raw:{source_hash}"}


def _signature_index(rows: list[dict[str, str]], parameters: list[str], label: str) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    for row in rows:
        signature = "|".join(f"{column}={row[column]}" for column in parameters)
        if signature in result:
            raise CoreError("E_FORWARD_SIGNATURE_DUPLICATE", f"Duplicate parameter signature in {label} source.")
        result[signature] = row
    return result


def _validate_context(in_start: str, in_end: str, fw_start: str, fw_end: str, modelling_mode: str) -> dict[str, str]:
    try:
        parsed = [date.fromisoformat(value) for value in (in_start, in_end, fw_start, fw_end)]
    except ValueError as error:
        raise CoreError("E_FORWARD_CONTEXT_INVALID", "Declared dates must use YYYY-MM-DD.") from error
    if parsed[0] > parsed[1] or parsed[2] > parsed[3] or parsed[1] + timedelta(days=1) != parsed[2]:
        raise CoreError("E_FORWARD_CONTEXT_INVALID", "In-sample and forward dates must be valid, non-overlapping, and contiguous.")
    mode = modelling_mode.strip()
    if not mode:
        raise CoreError("E_FORWARD_CONTEXT_INVALID", "A non-empty USER_SUPPLIED modelling mode is required.")
    return {"in_sample_start": in_start, "in_sample_end": in_end, "forward_start": fw_start, "forward_end": fw_end, "modelling_mode": mode, "modelling_mode_source": "USER_SUPPLIED"}


def _pair_limitations() -> list[str]:
    return ["Rows are paired source evidence only; TRL does not recompute MT5 metrics.", "No ranking, selection, threshold, robustness score, recommendation, or .set export is available.", "Date ranges and modelling mode are USER_SUPPLIED context; XML source values remain unchanged."]


def _parse(source: Path, source_hash: str) -> dict[str, Any]:
    try:
        root = ET.fromstring(source.read_bytes())
    except ET.ParseError as error:
        raise CoreError("E_OPTIMISATION_XML_INVALID", "The selected optimisation export is not valid XML.") from error
    ns = {"ss": NAMESPACE, "office": "urn:schemas-microsoft-com:office:office"}
    worksheet = root.find(".//ss:Worksheet[@ss:Name='Tester Optimizator Results']", ns)
    if worksheet is None:
        raise CoreError("E_OPTIMISATION_LAYOUT_UNSUPPORTED", "Expected MT5 'Tester Optimizator Results' worksheet was not found.")
    rows = worksheet.findall("./ss:Table/ss:Row", ns)
    if len(rows) < 2:
        raise CoreError("E_OPTIMISATION_LAYOUT_UNSUPPORTED", "The MT5 optimisation worksheet has no result rows.")
    headers = [_cell_text(cell, ns) for cell in rows[0].findall("./ss:Cell", ns)]
    if not headers or headers[0] != "Pass" or len(set(headers)) != len(headers):
        raise CoreError("E_OPTIMISATION_LAYOUT_UNSUPPORTED", "The MT5 optimisation header must begin with a unique Pass column.")
    parameter_columns = [header for header in headers if header.startswith("Inp")]
    if not parameter_columns:
        raise CoreError("E_OPTIMISATION_NOT_PARAMETER_GRID", "No MT5 EA input columns were found; this is not a parameter-grid export.")
    output_rows: list[dict[str, str]] = []
    seen_passes: set[str] = set()
    for source_sequence, row in enumerate(rows[1:], start=1):
        values = [_cell_text(cell, ns) for cell in row.findall("./ss:Cell", ns)]
        if len(values) != len(headers):
            raise CoreError("E_OPTIMISATION_LAYOUT_UNSUPPORTED", "An optimisation result row does not match the header width.", details={"source_sequence": source_sequence})
        item = {header: value for header, value in zip(headers, values, strict=True)}
        pass_id = item["Pass"]
        if not pass_id or pass_id in seen_passes:
            raise CoreError("E_OPTIMISATION_PASS_AMBIGUOUS", "Every optimisation Pass must be present and unique.", details={"pass": pass_id})
        seen_passes.add(pass_id)
        item["trl_source_sequence"] = str(source_sequence)
        item["trl_pass_id"] = stable_uuid("mt5-optimisation-pass", source_hash, pass_id)
        output_rows.append(item)
    properties = root.find(".//office:DocumentProperties", ns)
    metadata = {tag: (properties.findtext(f"office:{tag}", default="", namespaces=ns) if properties is not None else "") for tag in ("Title", "Created", "Server", "Deposit", "Leverage", "Build", "Version")}
    return {"worksheet_name": "Tester Optimizator Results", "headers": headers, "parameter_columns": parameter_columns, "metric_columns": [header for header in headers if header not in {"Pass", *parameter_columns}], "rows": output_rows, "report_metadata": metadata}


def _cell_text(cell: ET.Element, ns: dict[str, str]) -> str:
    data = cell.find("./ss:Data", ns)
    return "" if data is None or data.text is None else data.text


def _limitations() -> list[str]:
    return [
        "MT5-reported metrics and parameter values are preserved as source facts; TRL does not recompute them.",
        "Modelling mode is USER_SUPPLIED because this XML does not establish it.",
        "No forward/out-of-sample label is supplied; parameter selection, robustness claims, and recommendations are unavailable.",
        "Sorting and filtering are inspection only. This result is not portfolio, broker, prop-firm, or live-trading analysis.",
    ]


def _ensure_snapshot(target: Path, source: Path, expected_hash: str) -> bool:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_file():
        if sha256(target.read_bytes()).hexdigest().upper() != expected_hash:
            raise CoreError("E_RAW_SNAPSHOT_MISMATCH", "Existing optimisation snapshot hash does not match the selected source.")
        return False
    with NamedTemporaryFile(delete=False, dir=target.parent, prefix="snapshot-", suffix=".tmp") as temporary:
        temporary_path = Path(temporary.name)
    try:
        shutil.copyfile(source, temporary_path)
        if sha256(temporary_path.read_bytes()).hexdigest().upper() != expected_hash:
            raise CoreError("E_RAW_SNAPSHOT_MISMATCH", "Copied optimisation snapshot hash does not match the selected source.")
        os.replace(temporary_path, target)
    finally:
        temporary_path.unlink(missing_ok=True)
    return True


def _bounded(root: Path, *parts: str) -> Path:
    candidate = root.joinpath(*parts).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise CoreError("E_PATH_INVALID", "Optimisation path escapes the worker workspace.") from error
    return candidate


def _atomic_json(path: Path, value: object) -> None:
    with NamedTemporaryFile("w", delete=False, dir=path.parent, encoding="utf-8", prefix="manifest-", suffix=".tmp") as temporary:
        json.dump(value, temporary, ensure_ascii=False, indent=2, sort_keys=True)
        temporary.write("\n")
        temporary_path = Path(temporary.name)
    os.replace(temporary_path, path)
