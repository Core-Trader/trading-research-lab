from __future__ import annotations

from pathlib import Path

from trading_research_core.trade_analysis import (
    POLICY_ID,
    close_event_summary,
    reconstruct_lifecycles,
    write_trade_artifact,
)


def _event(sequence: int, event_type: str, *, side: str = "BUY", volume: str = "1", profit: str = "0", commission: str = "0", swap: str = "0") -> dict[str, object]:
    return {
        "source_sequence": sequence,
        "source_timestamp": f"2026-01-{sequence:02d}T00:00:00",
        "event_type": event_type,
        "side": side,
        "symbol": "EURUSD",
        "volume": volume,
        "source_profit": profit,
        "source_commission": commission,
        "source_swap": swap,
        "source_deal_id": str(sequence),
    }


def _dataset(events: list[dict[str, object]]) -> dict[str, object]:
    return {"metadata": {"dataset_ref": "mt5:" + "A" * 64, "settings": {"Currency": "USD"}}, "events": events}


def test_close_events_remain_verified_and_separate_from_lifecycles() -> None:
    result, rows = close_event_summary(_dataset([_event(1, "POSITION_CLOSE", profit="12", commission="-1", swap="-1")]))
    assert rows[0]["source_quality"] == "MT5_VERIFIED"
    assert rows[0]["net_pnl"] == "10"
    assert result["summary"]["net_pnl"] == "10"
    assert result["quality_counts"]["INFERRED"] == 0


def test_hedging_fifo_partial_close_allocates_open_and_close_economics_exactly() -> None:
    dataset = _dataset([
        _event(1, "POSITION_OPEN", volume="1", commission="-3"),
        _event(2, "POSITION_CLOSE", volume="0.4", profit="8", commission="-1"),
        _event(3, "POSITION_CLOSE", volume="0.6", profit="12", commission="-2"),
    ])
    result, rows = reconstruct_lifecycles(dataset, account_mode="HEDGING")
    inferred = [row for row in rows if row["source_quality"] == "INFERRED"]
    assert result["eligible"] is True
    assert result["policy"]["policy_id"] == POLICY_ID
    assert result["policy"]["account_mode_source"] == "USER_SUPPLIED"
    assert [row["allocated_volume"] for row in inferred] == ["0.4", "0.6"]
    assert [row["net_pnl"] for row in inferred] == ["5.8", "8.2"]
    assert result["summary"]["net_pnl"] == "14.0"
    assert result["quality_counts"] == {"MT5_VERIFIED": 0, "INFERRED": 2, "UNPAIRED": 0, "AMBIGUOUS": 0}


def test_fifo_order_and_unpaired_events_are_deterministic_without_guessed_economics() -> None:
    dataset = _dataset([
        _event(1, "POSITION_OPEN", volume="1"),
        _event(2, "POSITION_OPEN", volume="1"),
        _event(3, "POSITION_CLOSE", volume="1.5", profit="15"),
        _event(4, "POSITION_CLOSE", volume="1", profit="10"),
    ])
    result, rows = reconstruct_lifecycles(dataset, account_mode="HEDGING")
    inferred = [row for row in rows if row["source_quality"] == "INFERRED"]
    unpaired = [row for row in rows if row["source_quality"] == "UNPAIRED"]
    assert [(row["open_source_sequence"], row["close_source_sequence"], row["allocated_volume"]) for row in inferred] == [(1, 3, "1"), (2, 3, "0.5"), (2, 4, "0.5")]
    assert len(unpaired) == 1
    assert unpaired[0]["close_source_sequence"] == 4
    assert unpaired[0]["net_pnl"] is None
    assert result["summary"]["net_pnl"] == "20.0"


def test_unknown_or_netting_account_mode_never_creates_inferred_lifecycles() -> None:
    result, rows = reconstruct_lifecycles(_dataset([_event(1, "POSITION_OPEN"), _event(2, "POSITION_CLOSE", profit="10")]), account_mode="NETTING")
    assert rows == []
    assert result["eligible"] is False
    assert result["quality_counts"]["INFERRED"] == 0
    assert "HEDGING" in result["warnings"][0]


def test_same_policy_writes_stable_m2_artifact_identity(tmp_path: Path) -> None:
    dataset = _dataset([_event(1, "POSITION_OPEN"), _event(2, "POSITION_CLOSE", profit="10")])
    result, rows = reconstruct_lifecycles(dataset, account_mode="HEDGING")
    first = write_trade_artifact(tmp_path, str(result["dataset_ref"]), "lifecycles", result, rows)
    first_bytes = next((tmp_path / "datasets").rglob("lifecycles.parquet")).read_bytes()
    second = write_trade_artifact(tmp_path, str(result["dataset_ref"]), "lifecycles", result, rows)
    second_bytes = next((tmp_path / "datasets").rglob("lifecycles.parquet")).read_bytes()
    assert first["analysis_id"] == second["analysis_id"]
    assert first["artifacts"]["table"] == second["artifacts"]["table"]
    assert first_bytes == second_bytes
