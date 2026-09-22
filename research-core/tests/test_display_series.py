from __future__ import annotations

from pathlib import Path

import pytest

from trading_research_core import display_series
from trading_research_core.dataset_store import read_dataset, write_dataset
from trading_research_core.display_series import close_event_display_series
from trading_research_core.errors import CoreError
from trading_research_core.worker import Worker


def _event(sequence: int, timestamp: str, event_type: str, profit: str = "0", commission: str = "0", swap: str = "0") -> dict[str, object]:
    return {
        "source_sequence": sequence, "source_timestamp": timestamp, "event_type": event_type, "side": "BUY", "symbol": "EURUSD",
        "volume": "1", "source_profit": profit, "source_commission": commission, "source_swap": swap,
        "reported_balance": "1000", "source_deal_id": str(sequence),
    }


def _imported(events: list[dict[str, object]]) -> dict[str, object]:
    return {
        "source": {"sha256": "E" * 64, "filename": "synthetic.xlsx", "byte_count": 1, "worksheet_name": "Report"},
        "settings": {"Currency": "USD"},
        "events": events,
    }


def _fixture() -> list[dict[str, object]]:
    # 2024-12-30 (Monday) belongs to ISO week 2025-W01; 2024-12-29 (Sunday) to 2024-W52.
    return [
        _event(1, "2024-12-01T00:00:00", "OPENING_BALANCE"),
        _event(2, "2024-12-29T09:00:00", "POSITION_OPEN"),
        _event(3, "2024-12-29T10:00:00", "POSITION_CLOSE", "0.10", "-0.02", "0.00"),
        _event(4, "2024-12-29T23:59:59", "POSITION_CLOSE", "0.20"),
        _event(5, "2024-12-30T00:00:00", "POSITION_CLOSE", "-5.00", "-0.50", "-0.25"),
        _event(6, "2025-01-02T12:00:00", "POSITION_CLOSE", "0"),
        _event(7, "2025-01-02T13:00:00", "POSITION_CLOSE", "12.34"),
    ]


def test_groups_exact_close_event_net_pnl_by_report_clock(tmp_path: Path) -> None:
    dataset_ref = str(write_dataset(tmp_path, _imported(_fixture()))["dataset_ref"])
    result = close_event_display_series(read_dataset(tmp_path, dataset_ref))

    assert result["time_basis"] == "SOURCE_REPORTED_CLOCK"
    assert result["close_event_count"] == 5
    assert [event["net_pnl"] for event in result["events"]] == ["0.08", "0.20", "-5.75", "0", "12.34"]
    # Exact Decimal: 0.08 + 0.20 is 0.28, not a binary-float approximation.
    assert result["daily"] == [
        {"date": "2024-12-29", "net_pnl": "0.28", "close_event_count": 2, "win_count": 2, "loss_count": 0},
        {"date": "2024-12-30", "net_pnl": "-5.75", "close_event_count": 1, "win_count": 0, "loss_count": 1},
        {"date": "2025-01-02", "net_pnl": "12.34", "close_event_count": 2, "win_count": 1, "loss_count": 0},
    ]
    assert [(week["iso_year"], week["iso_week"], week["net_pnl"]) for week in result["weekly"]] == [(2024, 52, "0.28"), (2025, 1, "6.59")]
    assert [(month["month"], month["net_pnl"]) for month in result["monthly"]] == [("2024-12", "-5.47"), ("2025-01", "12.34")]
    assert [(year["year"], year["net_pnl"], year["close_event_count"]) for year in result["yearly"]] == [(2024, "-5.47", 3), (2025, "12.34", 2)]


def test_grouped_totals_reconcile_with_close_event_summary(tmp_path: Path) -> None:
    dataset_ref = str(write_dataset(tmp_path, _imported(_fixture()))["dataset_ref"])
    dataset = read_dataset(tmp_path, dataset_ref)
    result = close_event_display_series(dataset)
    from decimal import Decimal
    from trading_research_core.trade_analysis import close_event_summary
    summary, _ = close_event_summary(dataset)
    for key in ("daily", "weekly", "monthly", "yearly"):
        assert sum(Decimal(row["net_pnl"]) for row in result[key]) == Decimal(summary["summary"]["net_pnl"])
        assert sum(row["close_event_count"] for row in result[key]) == summary["summary"]["count"]


def test_output_is_deterministic_and_does_not_modify_dataset(tmp_path: Path) -> None:
    dataset_ref = str(write_dataset(tmp_path, _imported(_fixture()))["dataset_ref"])
    before = read_dataset(tmp_path, dataset_ref)
    assert close_event_display_series(before) == close_event_display_series(read_dataset(tmp_path, dataset_ref))
    assert read_dataset(tmp_path, dataset_ref) == before


def test_per_event_bars_are_omitted_not_downsampled_above_the_bound(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(display_series, "MAX_EVENT_BARS", 3)
    dataset_ref = str(write_dataset(tmp_path, _imported(_fixture()))["dataset_ref"])
    result = close_event_display_series(read_dataset(tmp_path, dataset_ref))
    assert result["events"] is None
    assert "omitted rather than downsampled" in result["events_omitted_reason"]
    assert len(result["daily"]) == 3


def test_non_iso_timestamp_is_a_structured_error(tmp_path: Path) -> None:
    events = _fixture()
    events[2]["source_timestamp"] = "29/12/2024 10:00"
    dataset_ref = str(write_dataset(tmp_path, _imported(events))["dataset_ref"])
    with pytest.raises(CoreError) as error:
        close_event_display_series(read_dataset(tmp_path, dataset_ref))
    assert error.value.code == "E_DATASET_INVALID"


def test_worker_exposes_display_series(tmp_path: Path) -> None:
    dataset_ref = str(write_dataset(tmp_path, _imported(_fixture()))["dataset_ref"])
    worker = Worker(tmp_path)
    assert "analysis.close_event_display_series" in worker.dispatch({"method": "core.capabilities", "params": {}})["methods"]
    result = worker.dispatch({"method": "analysis.close_event_display_series", "params": {"dataset_ref": dataset_ref}})
    assert result["close_event_count"] == 5
