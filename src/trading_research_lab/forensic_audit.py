"""Read-only validation and binding for MT5 Position Audit Export v0.1."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from hashlib import sha256
import json
from pathlib import Path
from typing import Any

from trading_research_lab.mt5_excel import Mt5ExcelImport


AUDIT_SCHEMA_VERSION = "trading-research-lab.position-audit.v0.1"
PRIVACY_PROFILE = "comments_omitted_v0.1"
REQUIRED_AUDIT_HEADERS = (
    "schema_version",
    "audit_run_id",
    "deal_ticket",
    "order_ticket",
    "position_id",
    "time_server_text",
    "time_msc_epoch",
    "deal_type",
    "deal_entry",
    "symbol",
    "volume",
    "price",
    "commission",
    "swap",
    "profit",
    "fee",
    "magic",
    "reason",
    "comment_state",
    "comment_value",
)
REQUIRED_MANIFEST_FIELDS = (
    "schema_version",
    "audit_run_id",
    "created_at_utc",
    "exporter_name",
    "exporter_version",
    "terminal_build",
    "account_company",
    "terminal_server",
    "account_margin_mode",
    "account_hedge_allowed",
    "account_currency",
    "account_leverage",
    "test_symbol",
    "test_period",
    "deal_history_start",
    "deal_history_end",
    "ea_baseline_source_sha256",
    "privacy_profile",
    "csv_sha256",
)


class ForensicAuditValidationError(ValueError):
    """Raised when an audit artifact fails its strict source contract."""


@dataclass(frozen=True)
class ForensicArtifact:
    path: Path
    sha256: str
    byte_count: int


@dataclass(frozen=True)
class ForensicAuditDeal:
    audit_run_id: str
    deal_ticket: str
    order_ticket: str
    position_id: str
    time_server_text: str
    time_server: datetime
    time_msc_epoch: int
    deal_type: str
    deal_entry: str
    symbol: str
    volume: Decimal
    price: Decimal
    commission: Decimal
    swap: Decimal
    profit: Decimal
    fee: Decimal
    magic: str
    reason: str


@dataclass(frozen=True)
class ForensicAuditImport:
    csv_artifact: ForensicArtifact
    manifest_artifact: ForensicArtifact
    manifest: dict[str, Any]
    deals: tuple[ForensicAuditDeal, ...]


@dataclass(frozen=True)
class ForensicAuditBinding:
    """A derived, immutable link between an ordinary report and an audit export."""

    binding_id: str
    regular_report_sha256: str
    audit_csv_sha256: str
    audit_manifest_sha256: str
    audit_run_id: str
    account_margin_mode: str
    account_mode_evidence: str


def import_forensic_audit(
    csv_path: str | Path, manifest_path: str | Path
) -> ForensicAuditImport:
    """Load a UTF-8 audit CSV and manifest without changing either artifact."""

    resolved_csv = _resolve_file(csv_path)
    resolved_manifest = _resolve_file(manifest_path)
    csv_artifact = _artifact(resolved_csv)
    manifest_artifact = _artifact(resolved_manifest)
    manifest = _read_manifest(resolved_manifest)
    _validate_manifest(manifest, csv_artifact.sha256)
    deals = _read_deals(resolved_csv, manifest["audit_run_id"])
    return ForensicAuditImport(
        csv_artifact=csv_artifact,
        manifest_artifact=manifest_artifact,
        manifest=manifest,
        deals=tuple(deals),
    )


def bind_audit_to_mt5_report(
    audit: ForensicAuditImport, report: Mt5ExcelImport
) -> ForensicAuditBinding:
    """Create a deterministic local binding after structural compatibility checks."""

    if audit.manifest["test_symbol"] != report.settings["Symbol"]:
        raise ForensicAuditValidationError(
            "Audit test_symbol does not match the regular report Symbol."
        )
    if audit.manifest["account_margin_mode"] != "RETAIL_HEDGING":
        raise ForensicAuditValidationError(
            "The current pairing reference contract supports only RETAIL_HEDGING audits."
        )
    binding_material = "|".join(
        (
            "forensic-audit-binding-v0.1",
            report.artifact.sha256,
            audit.csv_artifact.sha256,
            audit.manifest_artifact.sha256,
            audit.manifest["audit_run_id"],
        )
    )
    return ForensicAuditBinding(
        binding_id=sha256(binding_material.encode("utf-8")).hexdigest().upper(),
        regular_report_sha256=report.artifact.sha256,
        audit_csv_sha256=audit.csv_artifact.sha256,
        audit_manifest_sha256=audit.manifest_artifact.sha256,
        audit_run_id=audit.manifest["audit_run_id"],
        account_margin_mode=audit.manifest["account_margin_mode"],
        account_mode_evidence="VERIFIED_TEST_RUN",
    )


def _resolve_file(path: str | Path) -> Path:
    resolved = Path(path).expanduser().resolve()
    if not resolved.is_file():
        raise FileNotFoundError(resolved)
    return resolved


def _artifact(path: Path) -> ForensicArtifact:
    return ForensicArtifact(
        path=path,
        sha256=_file_sha256(path),
        byte_count=path.stat().st_size,
    )


def _file_sha256(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def _read_manifest(path: Path) -> dict[str, Any]:
    try:
        with path.open(encoding="utf-8") as source:
            manifest = json.load(source)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ForensicAuditValidationError("Audit manifest is not valid UTF-8 JSON.") from error
    if not isinstance(manifest, dict):
        raise ForensicAuditValidationError("Audit manifest must be a JSON object.")
    return manifest


def _validate_manifest(manifest: dict[str, Any], csv_sha256: str) -> None:
    missing = [field for field in REQUIRED_MANIFEST_FIELDS if field not in manifest]
    if missing:
        raise ForensicAuditValidationError(
            f"Audit manifest is missing required fields: {', '.join(missing)}"
        )
    if manifest["schema_version"] != AUDIT_SCHEMA_VERSION:
        raise ForensicAuditValidationError("Unsupported audit manifest schema version.")
    if manifest["privacy_profile"] != PRIVACY_PROFILE:
        raise ForensicAuditValidationError("Unsupported audit privacy profile.")
    if manifest["csv_sha256"] != csv_sha256:
        raise ForensicAuditValidationError("Audit CSV SHA-256 does not match its manifest.")
    if manifest["account_margin_mode"] not in {
        "RETAIL_HEDGING",
        "RETAIL_NETTING",
        "EXCHANGE",
    }:
        raise ForensicAuditValidationError("Unsupported account_margin_mode value.")
    if not isinstance(manifest["account_hedge_allowed"], bool):
        raise ForensicAuditValidationError("account_hedge_allowed must be a JSON boolean.")
    _parse_timestamp(manifest["created_at_utc"], "created_at_utc")
    _parse_timestamp(manifest["deal_history_start"], "deal_history_start")
    _parse_timestamp(manifest["deal_history_end"], "deal_history_end")


def _read_deals(path: Path, manifest_run_id: str) -> list[ForensicAuditDeal]:
    try:
        with path.open(encoding="utf-8", newline="") as source:
            reader = csv.DictReader(source)
            if tuple(reader.fieldnames or ()) != REQUIRED_AUDIT_HEADERS:
                raise ForensicAuditValidationError("Unsupported forensic audit CSV headers.")
            rows = list(reader)
    except UnicodeDecodeError as error:
        raise ForensicAuditValidationError("Audit CSV is not valid UTF-8.") from error
    if not rows:
        raise ForensicAuditValidationError("Audit CSV contains no Deal rows.")
    return [_parse_deal(row, manifest_run_id, index) for index, row in enumerate(rows, start=2)]


def _parse_deal(
    row: dict[str, str], manifest_run_id: str, source_row: int
) -> ForensicAuditDeal:
    if row["schema_version"] != AUDIT_SCHEMA_VERSION:
        raise ForensicAuditValidationError(f"CSV row {source_row} has unsupported schema_version.")
    if row["audit_run_id"] != manifest_run_id:
        raise ForensicAuditValidationError(f"CSV row {source_row} has a mismatched audit_run_id.")
    if row["comment_state"] != "OMITTED" or row["comment_value"]:
        raise ForensicAuditValidationError(
            f"CSV row {source_row} violates the approved comment privacy profile."
        )
    return ForensicAuditDeal(
        audit_run_id=row["audit_run_id"],
        deal_ticket=_required_integer_text(row["deal_ticket"], "deal_ticket", source_row),
        order_ticket=_integer_text_or_empty(row["order_ticket"], "order_ticket", source_row),
        position_id=_integer_text_or_empty(row["position_id"], "position_id", source_row),
        time_server_text=row["time_server_text"],
        time_server=_parse_timestamp(row["time_server_text"], "time_server_text"),
        time_msc_epoch=_parse_int(row["time_msc_epoch"], "time_msc_epoch", source_row),
        deal_type=_required_text(row["deal_type"], "deal_type", source_row),
        deal_entry=row["deal_entry"],
        symbol=row["symbol"],
        volume=_parse_decimal(row["volume"], "volume", source_row),
        price=_parse_decimal(row["price"], "price", source_row),
        commission=_parse_decimal(row["commission"], "commission", source_row),
        swap=_parse_decimal(row["swap"], "swap", source_row),
        profit=_parse_decimal(row["profit"], "profit", source_row),
        fee=_parse_decimal(row["fee"], "fee", source_row),
        magic=_integer_text_or_empty(row["magic"], "magic", source_row),
        reason=row["reason"],
    )


def _parse_timestamp(value: Any, field: str) -> datetime:
    if not isinstance(value, str):
        raise ForensicAuditValidationError(f"{field} must be an MT5 timestamp string.")
    try:
        return datetime.strptime(value, "%Y.%m.%d %H:%M:%S")
    except ValueError as error:
        raise ForensicAuditValidationError(f"Unsupported {field}: {value!r}") from error


def _parse_decimal(value: str, field: str, source_row: int) -> Decimal:
    try:
        return Decimal(value)
    except (InvalidOperation, ValueError) as error:
        raise ForensicAuditValidationError(
            f"CSV row {source_row} has invalid {field}: {value!r}"
        ) from error


def _parse_int(value: str, field: str, source_row: int) -> int:
    try:
        return int(value)
    except ValueError as error:
        raise ForensicAuditValidationError(
            f"CSV row {source_row} has invalid {field}: {value!r}"
        ) from error


def _required_integer_text(value: str, field: str, source_row: int) -> str:
    parsed = _integer_text_or_empty(value, field, source_row)
    if not parsed:
        raise ForensicAuditValidationError(f"CSV row {source_row} is missing {field}.")
    return parsed


def _integer_text_or_empty(value: str, field: str, source_row: int) -> str:
    if value == "":
        return ""
    _parse_int(value, field, source_row)
    return value


def _required_text(value: str, field: str, source_row: int) -> str:
    if not value:
        raise ForensicAuditValidationError(f"CSV row {source_row} is missing {field}.")
    return value


def _main() -> None:
    import argparse

    parser = argparse.ArgumentParser(
        description="Validate a read-only MT5 Position Audit Export v0.1."
    )
    parser.add_argument("audit_csv", type=Path)
    parser.add_argument("audit_manifest", type=Path)
    parser.add_argument(
        "--report",
        type=Path,
        help="Optional regular MT5 Excel report to validate and bind by hashes.",
    )
    args = parser.parse_args()
    audit = import_forensic_audit(args.audit_csv, args.audit_manifest)
    print(f"audit_run_id={audit.manifest['audit_run_id']}")
    print(f"audit_csv_sha256={audit.csv_artifact.sha256}")
    print(f"audit_manifest_sha256={audit.manifest_artifact.sha256}")
    print(f"audit_deals={len(audit.deals)}")
    print(f"account_margin_mode={audit.manifest['account_margin_mode']}")
    if args.report is not None:
        from trading_research_lab.mt5_excel import import_mt5_excel_report

        binding = bind_audit_to_mt5_report(
            audit, import_mt5_excel_report(args.report)
        )
        print(f"binding_id={binding.binding_id}")
        print(f"account_mode_evidence={binding.account_mode_evidence}")


if __name__ == "__main__":
    _main()
