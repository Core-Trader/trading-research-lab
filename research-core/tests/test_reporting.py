from __future__ import annotations

from pathlib import Path

from trading_research_core.reporting import prepare_report_payload, write_report_revision_manifest


REPORT_ID = "01234567-89ab-7cde-8123-456789abcdef"
ANALYSIS_ID = "11111111-1111-7111-8111-111111111111"


def _dataset() -> dict[str, object]:
    return {
        "metadata": {
            "dataset_ref": "mt5:" + "D" * 64,
            "dataset_id": "22222222-2222-7222-8222-222222222222",
            "source_import_id": "33333333-3333-7333-8333-333333333333",
            "source": {"sha256": "D" * 64},
            "settings": {"Currency": "USD"},
        },
        "events": [
            {"source_sequence": 1, "source_timestamp": "2026-01-01T00:00:00", "event_type": "OPENING_BALANCE", "reported_balance": "1000", "source_profit": "0", "source_commission": "0", "source_swap": "0"},
            {"source_sequence": 2, "source_timestamp": "2026-01-02T00:00:00", "event_type": "POSITION_CLOSE", "reported_balance": "1010", "source_profit": "12", "source_commission": "-1", "source_swap": "-1"},
        ],
    }


def test_report_payload_is_deterministic_and_contains_reproducibility_identity() -> None:
    first = prepare_report_payload(_dataset(), analysis_run_id=ANALYSIS_ID, report_id=REPORT_ID)
    second = prepare_report_payload(_dataset(), analysis_run_id=ANALYSIS_ID, report_id=REPORT_ID)
    assert first["generated_block_hash"] == second["generated_block_hash"]
    assert first["configuration_hash"] == second["configuration_hash"]
    assert first["dataset_id"] == "22222222-2222-7222-8222-222222222222"
    assert "Trading Research Lab" in str(first["markdown"])


def test_changed_report_revision_writes_a_controlled_manifest(tmp_path: Path) -> None:
    payload = prepare_report_payload(_dataset(), analysis_run_id=ANALYSIS_ID, report_id=REPORT_ID)
    result = write_report_revision_manifest(tmp_path, payload, report_revision=1, prior_configuration_hash=None)
    manifest = tmp_path / "reports" / REPORT_ID / "revisions" / "000001.json"
    assert manifest.is_file()
    assert result["manifest_ref"] == f"report:{REPORT_ID}:revision:1"
    assert len(str(result["manifest_sha256"])) == 64
