from __future__ import annotations

import csv
from hashlib import sha256
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from trading_research_lab.forensic_audit import (
    AUDIT_SCHEMA_VERSION,
    ForensicAuditValidationError,
    bind_audit_to_mt5_report,
    import_forensic_audit,
)
from trading_research_lab.mt5_excel import import_mt5_excel_report

from test_mt5_excel import write_report


HEADERS = (
    "schema_version", "audit_run_id", "deal_ticket", "order_ticket", "position_id",
    "time_server_text", "time_msc_epoch", "deal_type", "deal_entry", "symbol",
    "volume", "price", "commission", "swap", "profit", "fee", "magic", "reason",
    "comment_state", "comment_value",
)


def write_audit(directory: Path, *, comment_value: str = "", valid_hash: bool = True) -> tuple[Path, Path]:
    csv_path = directory / "audit.csv"
    manifest_path = directory / "audit.manifest.json"
    with csv_path.open("w", encoding="utf-8", newline="") as source:
        writer = csv.writer(source)
        writer.writerow(HEADERS)
        writer.writerow(
            [
                AUDIT_SCHEMA_VERSION, "eurusd-2025-audit", "1001", "9001", "8001",
                "2025.01.10 16:00:00", "1736524800000", "SELL", "OUT", "USDJPY",
                "0.01000000", "158.552", "-0.10", "-0.20", "0.80", "0.00", "123456",
                "EXPERT", "OMITTED", comment_value,
            ]
        )
    csv_hash = sha256(csv_path.read_bytes()).hexdigest().upper()
    manifest = {
        "schema_version": AUDIT_SCHEMA_VERSION,
        "audit_run_id": "eurusd-2025-audit",
        "created_at_utc": "2025.01.10 16:01:00",
        "exporter_name": "TRL Position Audit Export",
        "exporter_version": "0.1",
        "terminal_build": 5000,
        "account_company": "Example Broker",
        "terminal_server": "Example-Live",
        "account_margin_mode": "RETAIL_HEDGING",
        "account_hedge_allowed": True,
        "account_currency": "USD",
        "account_leverage": 1000,
        "test_symbol": "USDJPY",
        "test_period": "PERIOD_H4",
        "deal_history_start": "2025.01.10 16:00:00",
        "deal_history_end": "2025.01.10 16:00:00",
        "ea_baseline_source_sha256": "A" * 64,
        "privacy_profile": "comments_omitted_v0.1",
        "csv_sha256": csv_hash if valid_hash else "B" * 64,
    }
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    return csv_path, manifest_path


class ForensicAuditTests(unittest.TestCase):
    def test_validates_and_deterministically_binds_audit_to_regular_report(self) -> None:
        with TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            csv_path, manifest_path = write_audit(directory)
            report_path = directory / "EURUSD.xlsx"
            write_report(report_path, price=1.08543, price_format="0.00000")

            audit = import_forensic_audit(csv_path, manifest_path)
            binding = bind_audit_to_mt5_report(audit, import_mt5_excel_report(report_path))

        self.assertEqual(len(audit.deals), 1)
        self.assertEqual(str(audit.deals[0].commission), "-0.10")
        self.assertEqual(audit.deals[0].position_id, "8001")
        self.assertEqual(binding.account_mode_evidence, "VERIFIED_TEST_RUN")
        self.assertEqual(len(binding.binding_id), 64)

    def test_rejects_raw_comment_in_omitted_privacy_profile(self) -> None:
        with TemporaryDirectory() as temporary_directory:
            csv_path, manifest_path = write_audit(Path(temporary_directory), comment_value="private")

            with self.assertRaises(ForensicAuditValidationError):
                import_forensic_audit(csv_path, manifest_path)

    def test_rejects_manifest_with_csv_hash_mismatch(self) -> None:
        with TemporaryDirectory() as temporary_directory:
            csv_path, manifest_path = write_audit(Path(temporary_directory), valid_hash=False)

            with self.assertRaises(ForensicAuditValidationError):
                import_forensic_audit(csv_path, manifest_path)


if __name__ == "__main__":
    unittest.main()
