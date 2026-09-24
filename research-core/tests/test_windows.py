"""Per-window comparison of fixed settings (PROPOSAL_WINDOWS_AND_NOTES.md W1–W6)."""

from __future__ import annotations

from pathlib import Path

import pytest

from trading_research_core.errors import CoreError
from trading_research_core.intake import intake_mt5_report
from trading_research_core.windows import render_windows_note, separate_windows, split_windows
from trading_research_core.worker import Worker

HEADERS = ["Time", "Deal", "Symbol", "Type", "Direction", "Volume", "Price", "Order", "Commission", "Swap", "Profit", "Balance", "Comment"]


def report(folder: Path, closes: list[tuple[str, str]], period: str, expert: str = "WinEA", symbol: str = "EURUSD", deposit: str = "10 000.00", inputs: str = "InpLots=0.1") -> Path:
    """An MT5 HTML report: opening balance, then one buy/sell pair per (date, profit)."""

    def row(cells: list[tuple[str, int]]) -> str:
        return "<tr>" + "".join(f'<td colspan="{span}">{value}</td>' for value, span in cells) + "</tr>"
    body = row([("Settings", 13)])
    for label, value in [("Expert", expert), ("Symbol", symbol), ("Period", period), ("Inputs", inputs), ("Currency", "USD"), ("Initial Deposit", deposit), ("Leverage", "1:100")]:
        body += row([(f"{label}:", 3), (value, 10)])
    body += row([("Results", 13)]) + row([("Total Net Profit:", 3), ("0.00", 10)])  # real MT5 reports always have Results
    body += row([("Deals", 13)]) + "<tr>" + "".join(f"<th>{header}</th>" for header in HEADERS) + "</tr>"
    start = period.split("(")[1].split(" - ")[0]
    balance = float(deposit.replace(" ", ""))
    deals = [[f"{start} 00:00:00", "1", "", "balance", "", "", "", "", "0.00", "0.00", f"{balance:.2f}", f"{balance:.2f}", ""]]
    number = 2
    for day, profit in closes:
        deals.append([f"{day} 09:00:00", str(number), symbol, "buy", "in", "0.10", "1.10000", str(number), "0.00", "0.00", "0.00", f"{balance:.2f}", ""])
        balance += float(profit)
        deals.append([f"{day} 15:00:00", str(number + 1), symbol, "sell", "out", "0.10", "1.10100", str(number + 1), "0.00", "0.00", profit, f"{balance:.2f}", ""])
        number += 2
    for deal in deals:
        body += "<tr>" + "".join(f"<td>{value}</td>" for value in deal) + "</tr>"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / "report.htm"
    path.write_bytes(("﻿<html><body><table>" + body + "</table></body></html>").encode("utf-16-le"))
    return path


def test_split_counts_trades_in_their_closing_window_and_measures_drawdown_from_each_start(tmp_path: Path) -> None:
    closes = [("2026.01.10", "100.00"), ("2026.02.10", "-50.00"), ("2026.03.10", "-80.00"), ("2026.04.10", "30.00"), ("2026.05.10", "200.00")]
    workspace = tmp_path / "ws"
    ref = str(intake_mt5_report(workspace, str(report(tmp_path / "a", closes, "H1 (2026.01.01 - 2026.06.01)")))["dataset_ref"])
    result = split_windows(workspace, ref, 2)
    rows = [(w["start"], w["end"], w["trades"], w["net_pnl"], w["maximum_drawdown"]) for w in result["windows"]]
    assert rows == [
        ("2026-01-01", "2026-02-28", 2, "50.00", "50.00"),
        ("2026-03-01", "2026-04-30", 2, "-50.00", "80.00"),  # drawdown from the window's own starting balance 10 050
        ("2026-05-01", "2026-06-30", 1, "200.00", "0"),
    ]
    assert [w["partial"] for w in result["windows"]] == [False, False, True]  # the test period ends 2026-06-01 (exclusive)
    assert sum(float(w["net_pnl"]) for w in result["windows"]) == 200.0  # windows add up to the whole run
    summary = result["summary"]
    assert (summary["windows"], summary["profitable"], summary["losing"], summary["worst"]["index"]) == (3, 2, 1, 2)
    assert summary["net_pnl_spread"] == {"minimum": "-50.00", "median": "50.00", "maximum": "200.00"}
    assert summary["within_losing_allowance"] is None
    strict = split_windows(workspace, ref, 2, min_trades=2, max_losing_windows=0)
    assert strict["summary"]["within_losing_allowance"] is False and strict["summary"]["below_min_trades"] == [3]
    assert split_windows(workspace, ref, 2)["evaluation_id"] == result["evaluation_id"]
    for bad in (0, 25, True):
        with pytest.raises(CoreError):
            split_windows(workspace, ref, bad)


def test_separate_reports_are_ordered_checked_and_compared_side_by_side(tmp_path: Path) -> None:
    workspace = tmp_path / "ws"
    refs = []
    for name, period, closes in (("h2", "H1 (2025.07.01 - 2026.01.01)", [("2025.08.01", "40.00")]), ("h1", "H1 (2025.01.01 - 2025.07.01)", [("2025.02.01", "-10.00"), ("2025.03.01", "25.00")])):
        refs.append(str(intake_mt5_report(workspace, str(report(tmp_path / name, closes, period)))["dataset_ref"]))
    result = separate_windows(workspace, refs)
    assert [(w["start"], w["end"], w["trades"], w["net_pnl"]) for w in result["windows"]] == [("2025-01-01", "2025-06-30", 2, "15.00"), ("2025-07-01", "2025-12-31", 1, "40.00")]
    assert result["findings"] == [] and result["summary"]["profitable"] == 2
    note = render_windows_note(result, "Both halves profitable")
    assert "- Profitable windows: 2 of 2" in note["markdown"] and note["record_id"] == result["evaluation_id"]


def test_separate_reports_must_share_settings_and_not_overlap(tmp_path: Path) -> None:
    workspace = tmp_path / "ws"
    base = str(intake_mt5_report(workspace, str(report(tmp_path / "base", [("2025.02.01", "10.00")], "H1 (2025.01.01 - 2025.07.01)")))["dataset_ref"])
    cases = {
        "other_inputs": dict(period="H1 (2025.07.01 - 2026.01.01)", inputs="InpLots=0.2"),
        "other_symbol": dict(period="H1 (2025.07.01 - 2026.01.01)", symbol="GBPUSD"),
        "overlap": dict(period="H1 (2025.06.01 - 2025.12.01)"),
    }
    for name, overrides in cases.items():
        period = overrides.pop("period")
        other = str(intake_mt5_report(workspace, str(report(tmp_path / name, [("2025.09.01", "5.00")], period, **overrides)))["dataset_ref"])
        with pytest.raises(CoreError) as error:
            separate_windows(workspace, [base, other])
        assert error.value.code == "E_WINDOWS_NOT_COMPARABLE", name
    gap = str(intake_mt5_report(workspace, str(report(tmp_path / "gap", [("2025.09.01", "5.00")], "H1 (2025.08.01 - 2026.01.01)")))["dataset_ref"])
    assert [item["code"] for item in separate_windows(workspace, [base, gap])["findings"]] == ["WINDOWS_GAP"]
    with pytest.raises(CoreError):
        separate_windows(workspace, [base])


def test_worker_methods(tmp_path: Path) -> None:
    workspace = tmp_path / "ws"
    ref = str(intake_mt5_report(workspace, str(report(tmp_path / "a", [("2026.01.10", "10.00"), ("2026.02.10", "20.00")], "H1 (2026.01.01 - 2026.03.01)")))["dataset_ref"])
    worker = Worker(workspace)
    split = worker.dispatch({"method": "windows.split", "params": {"dataset_ref": ref, "months": 1}})
    assert split["summary"]["windows"] == 2
    note = worker.dispatch({"method": "windows.render_note", "params": {"mode": "SPLIT", "dataset_ref": ref, "months": 1, "reason": "ok"}})
    assert note["record_id"] == split["evaluation_id"]
