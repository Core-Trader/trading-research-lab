from __future__ import annotations

from pathlib import Path

from trading_research_core.time_risk import equity_availability, realised_balance_daily_drawdown, validate_time_profile, write_daily_drawdown_artifact


def _dataset() -> dict[str, object]:
    return {
        "metadata": {"dataset_ref": "mt5:" + "C" * 64, "settings": {"Currency": "USD"}},
        "events": [
            {"source_sequence": 1, "source_timestamp": "2026-01-01T09:00:00", "reported_balance": "1000"},
            {"source_sequence": 2, "source_timestamp": "2026-01-01T10:00:00", "reported_balance": "1050"},
            {"source_sequence": 3, "source_timestamp": "2026-01-01T11:00:00", "reported_balance": "1020"},
            {"source_sequence": 4, "source_timestamp": "2026-01-02T09:00:00", "reported_balance": "1100"},
            {"source_sequence": 5, "source_timestamp": "2026-01-02T10:00:00", "reported_balance": "1080"},
        ],
    }


def test_default_profile_uses_source_reported_clock_without_timezone_claim() -> None:
    result = validate_time_profile()
    assert result["time_basis"] == "SOURCE_REPORTED_CLOCK"
    assert result["profile"] is None
    assert "UTC" in result["warnings"][0]


def test_daily_drawdown_uses_report_clock_dates_and_realised_balance_only() -> None:
    result, rows = realised_balance_daily_drawdown(_dataset())
    assert [row["date"] for row in rows] == ["2026-01-01", "2026-01-02"]
    assert rows[0]["maximum_drawdown"] == "30"
    assert rows[0]["maximum_drawdown_percent"] == "3.00"
    assert rows[1]["maximum_drawdown"] == "20"
    assert result["analysis_basis"] == "REALISED_BALANCE_ONLY"
    assert result["worst_day"]["date"] == "2026-01-01"


def test_equity_is_explicitly_unavailable_for_deals_only_input() -> None:
    result = equity_availability(_dataset())
    assert result["status"] == "UNAVAILABLE"
    assert "floating P/L" in result["reason"]


def test_daily_artifact_identity_and_contents_are_stable(tmp_path: Path) -> None:
    result, rows = realised_balance_daily_drawdown(_dataset())
    first = write_daily_drawdown_artifact(tmp_path, str(result["dataset_ref"]), result, rows)
    first_bytes = next((tmp_path / "datasets").rglob("daily-realised-balance-drawdown.parquet")).read_bytes()
    second = write_daily_drawdown_artifact(tmp_path, str(result["dataset_ref"]), result, rows)
    second_bytes = next((tmp_path / "datasets").rglob("daily-realised-balance-drawdown.parquet")).read_bytes()
    assert first["analysis_id"] == second["analysis_id"]
    assert first_bytes == second_bytes
