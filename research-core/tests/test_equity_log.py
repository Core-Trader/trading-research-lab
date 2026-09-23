"""TRL tester equity logs (PL-006, EQUITY_LOGGER_SPEC.md): link, cross-check, metrics."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from trading_research_core.equity_log import attach_equity_log, equity_drawdown, equity_metrics, parse_equity_log
from trading_research_core.errors import CoreError
from trading_research_core.intake import get_evidence, intake_mt5_report
from trading_research_core.worker import Worker

HEADERS = ["Time", "Deal", "Symbol", "Type", "Direction", "Volume", "Price", "Order", "Commission", "Swap", "Profit", "Balance", "Comment"]
DEALS = [
    ["2026.01.01 00:00:00", "1", None, "balance", None, None, None, None, "0.00", "0.00", "10000.00", "10000.00", None],
    ["2026.01.02 10:00:00", "2", "EURUSD", "buy", "in", "0.10", "1.10000", "2", "-0.50", "0.00", "0.00", "9999.50", None],
    ["2026.01.03 10:00:00", "3", "EURUSD", "sell", "out", "0.10", "1.09000", "3", "0.00", "0.00", "-100.00", "9899.50", None],
    ["2026.01.04 10:00:00", "4", "EURUSD", "buy", "in", "0.10", "1.09000", "4", "-0.50", "0.00", "0.00", "9899.00", None],
    ["2026.01.05 10:00:00", "5", "EURUSD", "sell", "out", "0.10", "1.12000", "5", "0.00", "0.00", "300.00", "10199.00", None],
]
LOG_ROWS = [
    "START,2026.01.01 00:00:00,10000.00,10000.00,10000.00,2026.01.01 00:00:00,10000.00,0.00,0,1",
    "BALANCE,2026.01.02 10:00:00,9999.50,9999.50,9999.50,2026.01.02 10:00:00,9999.50,110.00,1,2",
    "INTERVAL,2026.01.02 10:04:59,9999.50,9950.00,9900.00,2026.01.02 10:03:10,10010.00,110.00,1,2",
    "BALANCE,2026.01.03 10:00:00,9899.50,9899.50,9899.50,2026.01.03 10:00:00,9899.50,0.00,0,3",
    "BALANCE,2026.01.04 10:00:00,9899.00,9899.00,9899.00,2026.01.04 10:00:00,9899.00,110.00,1,4",
    "INTERVAL,2026.01.04 10:04:59,9899.00,9950.00,9860.00,2026.01.04 10:02:00,9960.00,110.00,1,4",
    "BALANCE,2026.01.05 10:00:00,10199.00,10199.00,10199.00,2026.01.05 10:00:00,10199.00,0.00,0,5",
    "END,2026.01.31 23:59:00,10199.00,10199.00,10199.00,2026.01.31 23:59:00,10199.00,0.00,0,5",
]


def _report(tmp_path: Path, deals: list[list[str | None]] = DEALS, equity_dd: str = "150.00 (1.50%)", expert: str = "LoggedEA") -> Path:
    row = lambda cells: "<tr>" + "".join(f"<td colspan=\"{span}\">{value or ''}</td>" for value, span in cells) + "</tr>"
    body = row([("Settings", 13)])
    for label, value in [("Expert", expert), ("Symbol", "EURUSD"), ("Period", "H1 (2026.01.01 - 2026.01.31)"), ("Currency", "USD"), ("Initial Deposit", "10 000.00"), ("Leverage", "1:100")]:
        body += row([(f"{label}:", 3), (value, 10)])
    body += row([("Results", 13)]) + row([("Equity Drawdown Maximal:", 3), (equity_dd, 10)])
    body += row([("Deals", 13)]) + "<tr>" + "".join(f"<th>{header}</th>" for header in HEADERS) + "</tr>"
    for deal in deals:
        body += "<tr>" + "".join(f"<td>{value or ''}</td>" for value in deal) + "</tr>"
    path = tmp_path / "report.htm"
    path.write_bytes(("﻿<html><body><table>" + body + "</table></body></html>").encode("utf-16-le"))
    return path


def _log(tmp_path: Path, rows: list[str] = LOG_ROWS, expert: str = "LoggedEA", name: str = "equity.csv") -> Path:
    header = [f"# format: trl-equity-log-1", "# logger_version: 1.0.0", f"# expert: {expert}", "# symbol: EURUSD", "# timeframe: H1", "# currency: USD",
              "# initial_deposit: 10000.00", "# leverage: 1:100", "# server: Demo-Server", "# interval: M5", "# test_start: 2026.01.01 00:00:00",
              "kind,time,balance,equity_close,equity_min,equity_min_time,equity_max,margin_max,positions_max,deals_total"]
    path = tmp_path / name
    path.write_text("\r\n".join([*header, *rows, "# test_end: 2026.01.31 23:59:00"]) + "\r\n", encoding="utf-8")
    return path


def _setup(tmp_path: Path, **report: object) -> tuple[Path, str]:
    workspace = tmp_path / "workspace"
    return workspace, str(intake_mt5_report(workspace, str(_report(tmp_path, **report)))["dataset_ref"])  # type: ignore[arg-type]


def test_log_links_cross_checks_and_becomes_evidence(tmp_path: Path) -> None:
    workspace, ref = _setup(tmp_path)
    result = attach_equity_log(workspace, ref, str(_log(tmp_path)), "Every tick based on real ticks")
    assert result["status"] == "LINKED_VERIFIED" and result["findings"] == []
    assert (result["maximum_equity_drawdown"], result["mt5_reported_equity_drawdown"]) == ("150.00", "150.00")
    equity = get_evidence(workspace, ref)["equity"]
    assert equity["status"] == "LINKED_VERIFIED" and equity["interval"] == "M5" and equity["row_count"] == 8
    availability = Worker(workspace).dispatch({"method": "analysis.equity_availability", "params": {"dataset_ref": ref}})
    assert availability["status"] == "AVAILABLE" and availability["source"] == "MT5_TESTER_LOGGED"
    assert (workspace / "raw" / str(result["log_sha256"]) / "source.csv").read_bytes() == _log(tmp_path).read_bytes()


def test_equity_metrics_daily_loss_uses_previous_sample_reference(tmp_path: Path) -> None:
    workspace, ref = _setup(tmp_path)
    attach_equity_log(workspace, ref, str(_log(tmp_path)), "Every tick based on real ticks")
    metrics = equity_metrics(workspace, ref)
    by_day = {item["date"]: item for item in metrics["daily"]}
    assert (by_day["2026-01-02"]["start_of_day_reference"], by_day["2026-01-02"]["lowest_equity"], by_day["2026-01-02"]["loss"]) == ("10000.00", "9900.00", "100.00")
    assert (by_day["2026-01-04"]["start_of_day_reference"], by_day["2026-01-04"]["loss"]) == ("9899.50", "39.50")
    assert by_day["2026-01-03"]["loss"] == "100.00"  # a realised loss counts toward the daily loss too
    assert metrics["worst_day"]["date"] == "2026-01-02" and metrics["worst_day"]["loss_percent_of_initial"] == "1.00000000"  # ties: earliest day
    assert metrics["maximum_equity_drawdown"] == "150.00" and metrics["row_count"] == 8 and len(metrics["display_series"]) == 8


def test_display_series_buckets_keep_extremes(tmp_path: Path) -> None:
    from trading_research_core.equity_log import display_series
    _, rows = parse_equity_log(_log(tmp_path).read_bytes())
    points = display_series(rows, limit=3)
    assert len(points) == 3 and min(float(point["equity_min"]) for point in points) == 9860.0 and max(float(point["equity_max"]) for point in points) == 10199.0
    assert points[-1]["balance"] == "10199.00"


def test_edited_balance_or_other_run_is_blocked(tmp_path: Path) -> None:
    workspace, ref = _setup(tmp_path)
    edited = [row.replace("2026.01.03 10:00:00,9899.50,", "2026.01.03 10:00:00,9950.00,") for row in LOG_ROWS]  # balance column only
    assert [item["code"] for item in attach_equity_log(workspace, ref, str(_log(tmp_path, edited, name="edited.csv")), "real ticks")["findings"]][0] == "BALANCE_PATH_DIFFERS"
    other = attach_equity_log(workspace, ref, str(_log(tmp_path, expert="OtherEA", name="other.csv")), "real ticks")
    assert other["status"] == "BLOCKED" and other["findings"][0]["code"] == "LOG_CONTEXT_DIFFERS"
    assert "equity" not in get_evidence(workspace, ref)  # nothing recorded for blocked logs


@pytest.mark.parametrize("mt5_figure,code", [("50.00 (0.50%)", "LOG_DEEPER_THAN_MT5"), ("300.00 (3.00%)", "EQUITY_DRAWDOWN_DIFFERS")])
def test_drawdown_disagreement_is_reported_never_blocking(tmp_path: Path, mt5_figure: str, code: str) -> None:
    workspace, ref = _setup(tmp_path, equity_dd=mt5_figure)
    result = attach_equity_log(workspace, ref, str(_log(tmp_path)), "1 minute OHLC")
    assert result["status"] == "LINKED_VERIFIED"
    assert [item["code"] for item in result["findings"]] == [code, "SYNTHETIC_INTRABAR_PATH"]
    assert result["findings"][0]["severity"] == ("NOTE" if code == "LOG_DEEPER_THAN_MT5" else "WARNING")


def test_end_of_test_closes_after_the_last_logged_row(tmp_path: Path) -> None:
    deals = [*DEALS[:4], ["2026.01.31 23:59:00", "5", "EURUSD", "sell", "out", "0.10", "1.12000", "5", "0.00", "0.00", "300.00", "10199.00", "end of test"]]
    workspace, ref = _setup(tmp_path, deals=deals)
    rows = [*LOG_ROWS[:6], "END,2026.01.31 23:59:00,9899.00,10199.00,9860.00,2026.01.04 10:02:00,10199.00,110.00,1,4"]
    result = attach_equity_log(workspace, ref, str(_log(tmp_path, rows)), "real ticks")
    assert result["status"] == "LINKED_VERIFIED" and [item["code"] for item in result["findings"]] == ["END_OF_TEST_CLOSES"]


@pytest.mark.parametrize("rows,message", [(LOG_ROWS[:-1], "END"), (LOG_ROWS[1:], "START"), ([LOG_ROWS[0], LOG_ROWS[2], LOG_ROWS[1], *LOG_ROWS[3:]], "time order")])
def test_malformed_logs_are_rejected(tmp_path: Path, rows: list[str], message: str) -> None:
    with pytest.raises(CoreError) as error:
        parse_equity_log(_log(tmp_path, rows).read_bytes())
    assert error.value.code == "E_EQUITY_LOG_INVALID" and message in error.value.message


def test_peak_and_trough_in_one_interval_are_not_combined(tmp_path: Path) -> None:
    _, rows = parse_equity_log(_log(tmp_path).read_bytes())
    same = [dict(rows[0]), dict(rows[1])]
    same[1].update({"equity_min": same[0]["equity_max"] - 10, "equity_max": same[0]["equity_max"] + 500})
    assert equity_drawdown(same)["maximum"] == 10  # the +500 peak in the same interval is not assumed to precede its low


def test_worker_methods_and_unavailable_metrics(tmp_path: Path) -> None:
    workspace, ref = _setup(tmp_path)
    worker = Worker(workspace)
    methods = worker.dispatch({"method": "core.capabilities", "params": {}})["methods"]
    assert {"dataset.attach_equity_log", "analysis.equity_metrics"} <= set(methods)
    with pytest.raises(CoreError) as error:
        equity_metrics(workspace, ref)
    assert error.value.code == "E_EQUITY_UNAVAILABLE"
    attached = worker.dispatch({"method": "dataset.attach_equity_log", "params": {"dataset_ref": ref, "source_path": str(_log(tmp_path)), "modelling_mode": "Every tick based on real ticks"}})
    assert attached["status"] == "LINKED_VERIFIED" and json.dumps(worker.dispatch({"method": "analysis.equity_metrics", "params": {"dataset_ref": ref}})["worst_day"])
