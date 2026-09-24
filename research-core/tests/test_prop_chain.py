"""Chained challenge phases from every start day (P8 follow-up)."""

from __future__ import annotations

from pathlib import Path

import pytest

from trading_research_core.errors import CoreError
from trading_research_core.intake import intake_mt5_report
from trading_research_core.prop_check import save_profile
from trading_research_core.prop_rolling import chain_starts
from trading_research_core.worker import Worker
from test_equity_log import _report


def _steady_report(tmp_path: Path) -> tuple[Path, str]:
    """+60 closed each day from 2026-01-02 to 2026-01-11 (one position opened and closed per day)."""

    deals = [["2026.01.01 00:00:00", "1", None, "balance", None, None, None, None, "0.00", "0.00", "10000.00", "10000.00", None]]
    balance, deal = 10000, 2
    for day in range(2, 12):
        deals.append([f"2026.01.{day:02d} 09:00:00", str(deal), "EURUSD", "buy", "in", "0.10", "1.10000", str(deal), "0.00", "0.00", "0.00", f"{balance:.2f}", None])
        balance += 60
        deals.append([f"2026.01.{day:02d} 15:00:00", str(deal + 1), "EURUSD", "sell", "out", "0.10", "1.10600", str(deal + 1), "0.00", "0.00", "60.00", f"{balance:.2f}", None])
        deal += 2
    workspace = tmp_path / "workspace"
    return workspace, str(intake_mt5_report(workspace, str(_report(tmp_path, deals=deals)))["dataset_ref"])


def _save(workspace: Path, name: str, **rules: object) -> str:
    return str(save_profile(workspace, {"name": name, "account_size": "10000", **rules})["profile"]["profile_id"])


def test_two_phases_and_a_funded_phase_complete_in_order(tmp_path: Path) -> None:
    workspace, ref = _steady_report(tmp_path)
    one = _save(workspace, "Phase 1", profit_target={"kind": "AMOUNT", "value": "100"})
    two = _save(workspace, "Phase 2", profit_target={"kind": "AMOUNT", "value": "100"})
    funded = _save(workspace, "Funded", overall_loss_limit={"kind": "PERCENT", "value": "10"})
    result = chain_starts(workspace, [one, two, funded], {"kind": "DATASET", "dataset_ref": ref}, survival_days=3)
    first = result["starts"][0]
    assert [(step["phase"], step["outcome"], step["decided_day"]) for step in first["phases"]] == [
        (1, "PASSED", "2026-01-03"),  # +60, +60
        (2, "PASSED", "2026-01-05"),  # a fresh account from 01-04: +60, +60
        (3, "SURVIVED", "2026-01-08"),  # from 01-06, three calendar days with no breach
    ]
    assert first["outcome"] == "COMPLETED" and first["calendar_days"] == 8
    assert result["summary"]["counts"]["COMPLETED"] >= 1 and result["summary"]["completed_share_percent"] == "100.00000000"


def test_a_failing_phase_is_named(tmp_path: Path) -> None:
    workspace, ref = _steady_report(tmp_path)
    one = _save(workspace, "Phase 1", profit_target={"kind": "AMOUNT", "value": "100"})
    slow = _save(workspace, "Phase 2, one day", profit_target={"kind": "AMOUNT", "value": "100"}, maximum_calendar_days=1)
    result = chain_starts(workspace, [one, slow], {"kind": "DATASET", "dataset_ref": ref})
    first = result["starts"][0]
    assert first["outcome"] == "FAILED" and first["failed_phase"] == 2 and first["phases"][1]["outcome"] == "OUT_OF_TIME"
    assert result["summary"]["failed_by_phase"]["2"] >= 1


def test_chain_validation(tmp_path: Path) -> None:
    workspace, ref = _steady_report(tmp_path)
    target = {"kind": "DATASET", "dataset_ref": ref}
    one = _save(workspace, "Phase 1", profit_target={"kind": "AMOUNT", "value": "100"})
    funded = _save(workspace, "Funded", overall_loss_limit={"kind": "PERCENT", "value": "10"})
    other_size = str(save_profile(workspace, {"name": "20k", "account_size": "20000", "profit_target": {"kind": "AMOUNT", "value": "1"}})["profile"]["profile_id"])
    for ids in ([one], [funded, one], [one, other_size], [one, one, one, one]):
        with pytest.raises(CoreError) as error:
            chain_starts(workspace, ids, target)
        assert error.value.code == "E_PROP_CHAIN_INVALID"
    result = Worker(workspace).dispatch({"method": "prop.chain_starts", "params": {"profile_ids": [one, funded], "target": target, "survival_days": 2}})
    assert result["calculation_version"] == "prop-chain-1" and len(result["profiles"]) == 2
