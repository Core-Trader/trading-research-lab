from __future__ import annotations

import uuid

from trading_research_core.analysis import basic_statistics, markdown_summary


def test_balance_only_statistics_do_not_invent_equity() -> None:
    dataset = {
        "metadata": {
            "dataset_ref": "mt5:" + "A" * 64,
            "source": {"sha256": "A" * 64},
            "settings": {"Currency": "USD"},
        },
        "events": [
            {"source_sequence": 1, "source_timestamp": "2026-01-01T00:00:00", "event_type": "OPENING_BALANCE", "reported_balance": "1000", "source_profit": "0", "source_commission": "0", "source_swap": "0"},
            {"source_sequence": 2, "source_timestamp": "2026-01-02T00:00:00", "event_type": "POSITION_CLOSE", "reported_balance": "1010", "source_profit": "12", "source_commission": "-1", "source_swap": "-1"},
        ],
    }
    result = basic_statistics(dataset)
    assert result["reported_balance_change"] == "10"
    assert result["realised_net_from_closing_events"] == "10"
    assert result["equity_curve"]["status"] == "UNAVAILABLE"
    assert "UNAVAILABLE" in markdown_summary(result)
    assert uuid.UUID(str(result["analysis_run_id"])).version == 5
    assert result["analysis_run_id"] == basic_statistics(dataset)["analysis_run_id"]
