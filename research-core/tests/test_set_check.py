"""A .set file checked against the inputs a report actually ran with (playbook §3.2)."""

from __future__ import annotations

from pathlib import Path

from trading_research_core.intake import get_evidence, intake_mt5_report
from trading_research_core.set_check import check_set_against_report
from trading_research_core.worker import Worker

HEADERS = ["Time", "Deal", "Symbol", "Type", "Direction", "Volume", "Price", "Order", "Commission", "Swap", "Profit", "Balance", "Comment"]


def _report(tmp_path: Path, inputs: list[str]) -> Path:
    row = lambda cells: "<tr>" + "".join(f"<td colspan=\"{span}\">{value or ''}</td>" for value, span in cells) + "</tr>"
    body = row([("Settings", 13)])
    for label, value in [("Expert", "EA"), ("Symbol", "EURUSD"), ("Period", "H1 (2026.01.01 - 2026.01.31)")]:
        body += row([(f"{label}:", 3), (value, 10)])
    body += row([("Inputs:", 3), (inputs[0], 10)]) + "".join(row([(None, 3), (value, 10)]) for value in inputs[1:])
    for label, value in [("Currency", "USD"), ("Initial Deposit", "1000.00"), ("Leverage", "1:100")]:
        body += row([(f"{label}:", 3), (value, 10)])
    body += row([("Results", 13)]) + row([("Total Net Profit:", 3), ("10.00", 10)])
    body += row([("Deals", 13)]) + "<tr>" + "".join(f"<th>{header}</th>" for header in HEADERS) + "</tr>"
    body += "<tr>" + "".join(f"<td>{value}</td>" for value in ["2026.01.01 00:00:00", "1", "", "balance", "", "", "", "", "0.00", "0.00", "1000.00", "1000.00", ""]) + "</tr>"
    body += "<tr>" + "".join(f"<td>{value}</td>" for value in ["2026.01.02 00:00:00", "2", "EURUSD", "buy", "in", "0.10", "1.10000", "2", "0.00", "0.00", "0.00", "1000.00", ""]) + "</tr>"
    path = tmp_path / "report.htm"
    path.write_bytes(("﻿<html><table>" + body + "</table></html>").encode("utf-16-le"))
    return path


def _set(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "intended.set"
    path.write_bytes("﻿".encode("utf-16-le") + text.encode("utf-16-le"))
    return path


def test_differences_are_listed_value_by_value(tmp_path: Path) -> None:
    workspace = tmp_path / "ws"
    ref = str(intake_mt5_report(workspace, str(_report(tmp_path, ["InpLot=0.1", "InpMode=2", "InpFlag=true", "InpOther=1"])))["dataset_ref"])
    result = check_set_against_report(workspace, ref, str(_set(tmp_path, "InpLot=0.10||0.01||0.01||1||N\nInpMode=3\nInpFlag=true||false||0||true||N\nInpExtra=5\n")))
    assert result["status"] == "DIFFERS" and result["compared"] == 3
    assert result["differences"] == [{"name": "InpMode", "report_value": "2", "set_value": "3"}]  # 0.1 == 0.10 numerically
    assert (result["only_in_set"], result["only_in_report"]) == (["InpExtra"], ["InpOther"])
    assert get_evidence(workspace, ref)["set_check"] == {"schema_ref": result["schema_ref"], "set_filename": "intended.set", "status": "DIFFERS", "compared": 3, "difference_count": 1}


def test_matching_set_and_worker_method(tmp_path: Path) -> None:
    workspace = tmp_path / "ws"
    worker = Worker(workspace)
    ref = worker.dispatch({"method": "dataset.intake_mt5_report", "params": {"source_path": str(_report(tmp_path, ["InpLot=0.1", "InpMode=2"]))}})["dataset_ref"]
    result = worker.dispatch({"method": "dataset.check_set", "params": {"dataset_ref": ref, "source_path": str(_set(tmp_path, "InpLot=0.1\nInpMode=2\n"))}})
    assert result["status"] == "MATCH" and result["differences"] == [] and result["notes"] == []
