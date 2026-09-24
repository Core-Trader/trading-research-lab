from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from trading_research_core.cost_breakdown import cost_breakdown
from trading_research_core.dataset_store import read_dataset, write_dataset
from trading_research_core.worker import Worker

D = Decimal


def _event(sequence: int, day: str, kind: str, symbol: str, volume: str, profit: str, commission: str, swap: str, balance: str) -> dict:
    return {"source_sequence": sequence, "source_timestamp": f"2026-{day}T10:00:00", "event_type": kind, "side": "BUY", "symbol": symbol, "volume": volume,
            "source_profit": profit, "source_commission": commission, "source_swap": swap, "reported_balance": balance, "source_deal_id": str(sequence)}


def _dataset(tmp_path: Path, final_balance: str = "1068.00") -> dict:
    events = [
        {"source_sequence": 0, "source_timestamp": "2026-01-01T00:00:00", "event_type": "OPENING_BALANCE", "side": None, "symbol": None, "volume": None,
         "source_profit": "1000", "source_commission": "0", "source_swap": "0", "reported_balance": "1000", "source_deal_id": "0"},
        _event(1, "01-05", "POSITION_OPEN", "EURUSD", "0.10", "0", "-3.50", "0", "996.50"),
        _event(2, "01-06", "POSITION_CLOSE", "EURUSD", "0.10", "50", "-3.50", "-2.00", "1041.00"),       # +50 -3.50 -2.00
        _event(3, "02-02", "POSITION_OPEN", "USDJPY", "0.20", "0", "-7.00", "0", "1034.00"),
        _event(4, "02-03", "POSITION_CLOSE", "USDJPY", "0.20", "30", "-7.00", "4.00", final_balance),    # +30 -7 +4
    ]
    # the consistent final balance is 1000 - 3.50 + 50 - 3.50 - 2 - 7 + 30 - 7 + 4 = 1061.00
    imported = {"source": {"sha256": "E" * 64, "filename": "costs.xlsx", "byte_count": 1, "worksheet_name": "Report"}, "settings": {"Currency": "USD"}, "events": events}
    return read_dataset(tmp_path, str(write_dataset(tmp_path, imported)["dataset_ref"]))


def test_components_split_and_reconcile_exactly(tmp_path: Path) -> None:
    result = cost_breakdown(_dataset(tmp_path, "1061.00"))
    summary = result["summary"]
    assert D(summary["trade_result_before_costs"]) == D("80")
    assert (D(summary["commission_open"]), D(summary["commission_close"])) == (D("-10.50"), D("-10.50"))
    assert (D(summary["swap_charged"]), D(summary["swap_credited"])) == (D("-2.00"), D("4.00"))
    assert D(summary["net"]) == D("61.00") and D(summary["costs"]) == D("19.00")
    assert (D(summary["commissions"]), D(summary["swaps"])) == (D("-21.00"), D("2.00"))
    assert result["reconciliation"]["status"] == "MATCHES" and D(result["reconciliation"]["difference"]) == 0
    assert result["currency"] == "USD"


def test_a_mismatch_with_the_final_balance_is_reported_not_hidden(tmp_path: Path) -> None:
    result = cost_breakdown(_dataset(tmp_path, "1068.00"))
    assert result["reconciliation"]["status"] == "DIFFERS" and D(result["reconciliation"]["difference"]) == D("7.00")


def test_per_trade_exclusion_and_intensity_by_hand(tmp_path: Path) -> None:
    result = cost_breakdown(_dataset(tmp_path, "1061.00"))
    assert D(result["per_trade_exclusion"]["amount"]) == D("-10.50")                 # opening commissions only
    assert D(result["per_trade_exclusion"]["per_closed_trade"]) == D("-5.25")
    assert D(result["intensity"]["cost_per_closed_trade"]) == D("9.50")              # 19 / 2
    assert D(result["intensity"]["commission_per_lot"]) == D("35")                   # 21 / (0.1+0.1+0.2+0.2)
    assert D(result["intensity"]["cost_share_percent"]) == D("23.75")                # 19 / 80


def test_net_swap_credit_has_no_cost_share(tmp_path: Path) -> None:
    events = [
        {"source_sequence": 0, "source_timestamp": "2026-01-01T00:00:00", "event_type": "OPENING_BALANCE", "side": None, "symbol": None, "volume": None,
         "source_profit": "1000", "source_commission": "0", "source_swap": "0", "reported_balance": "1000", "source_deal_id": "0"},
        _event(1, "01-05", "POSITION_OPEN", "USDJPY", "0.10", "0", "0", "0", "1000"),
        _event(2, "01-09", "POSITION_CLOSE", "USDJPY", "0.10", "40", "-1", "6", "1045"),   # swap +6 exceeds commission -1
    ]
    imported = {"source": {"sha256": "F" * 64, "filename": "carry.xlsx", "byte_count": 1, "worksheet_name": "Report"}, "settings": {"Currency": "USD"}, "events": events}
    result = cost_breakdown(read_dataset(tmp_path, str(write_dataset(tmp_path, imported)["dataset_ref"])))
    assert D(result["summary"]["costs"]) == D("-5") and result["intensity"]["cost_share_percent"] is None
    assert result["reconciliation"]["status"] == "MATCHES"


def test_breakdowns_add_up_to_the_total(tmp_path: Path) -> None:
    result = cost_breakdown(_dataset(tmp_path, "1061.00"))
    for key in ("by_symbol", "by_month"):
        assert sum(D(row["net"]) for row in result[key]) == D(result["summary"]["net"])
    assert [row["symbol"] for row in result["by_symbol"]] == ["EURUSD", "USDJPY"]
    assert [row["month"] for row in result["by_month"]] == ["2026-01", "2026-02"]


def test_worker_and_note(tmp_path: Path) -> None:
    ref = str(_dataset(tmp_path, "1061.00")["metadata"]["dataset_ref"])
    worker = Worker(tmp_path)
    result = worker.dispatch({"method": "analysis.cost_breakdown", "params": {"dataset_ref": ref}})
    assert result["reconciliation"]["status"] == "MATCHES"
    note = worker.dispatch({"method": "analysis.render_cost_note", "params": {"dataset_ref": ref, "reason": "fine"}})
    assert note["markdown"].startswith("### Costs checked") and "opening -10.50" in note["markdown"] and "matches" in note["markdown"]
