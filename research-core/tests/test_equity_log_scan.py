from __future__ import annotations

import os
from pathlib import Path

import pytest

from trading_research_core.equity_log import attach_equity_log
from trading_research_core.equity_log_scan import default_logger_folder, scan_equity_logs
from trading_research_core.errors import CoreError
from trading_research_core.worker import Worker
from test_equity_log import LOG_ROWS, _log, _setup


def test_scan_finds_the_matching_log_and_explains_the_others(tmp_path: Path) -> None:
    workspace, ref = _setup(tmp_path)
    folder = tmp_path / "TRL"
    folder.mkdir()
    _log(folder, name="TRL_equity_LoggedEA_EURUSD_H1_20260101.csv")                                   # the right one
    _log(folder, expert="OtherEA", name="TRL_equity_OtherEA_EURUSD_H1_20260101.csv")                  # another EA
    other_run = [row.replace("9899.50,9899.50", "9899.40,9899.40") for row in LOG_ROWS]
    _log(folder, rows=other_run, name="TRL_equity_LoggedEA_EURUSD_H1_20260101_2.csv")                 # same test, other run
    (folder / "notes.csv").write_text("a,b\n1,2\n", encoding="utf-8")                                  # not a TRL log
    result = scan_equity_logs(workspace, ref, str(folder))
    by_name = {item["name"]: item for item in result["candidates"]}
    assert result["matches"] == 1 and result["candidates"][0]["status"] == "MATCHES"
    assert by_name["TRL_equity_LoggedEA_EURUSD_H1_20260101.csv"]["status"] == "MATCHES"
    assert by_name["TRL_equity_OtherEA_EURUSD_H1_20260101.csv"]["status"] == "OTHER_TEST" and "expert" in by_name["TRL_equity_OtherEA_EURUSD_H1_20260101.csv"]["reason"]
    assert by_name["TRL_equity_LoggedEA_EURUSD_H1_20260101_2.csv"]["status"] == "OTHER_RUN"
    assert by_name["notes.csv"]["status"] == "NOT_A_TRL_LOG"
    # A MATCHES result attaches (same check as attaching).
    assert attach_equity_log(workspace, ref, result["candidates"][0]["path"], "Every tick based on real ticks")["status"] == "LINKED_VERIFIED"


def test_missing_folder_and_default_location(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    workspace, ref = _setup(tmp_path)
    with pytest.raises(CoreError) as error:
        scan_equity_logs(workspace, ref, str(tmp_path / "nowhere"))
    assert error.value.code == "E_SOURCE_NOT_FOUND"
    monkeypatch.setenv("APPDATA", str(tmp_path / "AppData"))
    expected = tmp_path / "AppData" / "MetaQuotes" / "Terminal" / "Common" / "Files" / "TRL"
    assert default_logger_folder() == {"folder": str(expected), "exists": False}
    expected.mkdir(parents=True)
    _log(expected, name="TRL_equity_LoggedEA_EURUSD_H1_20260101.csv")
    assert Worker(workspace).dispatch({"method": "equity.scan_logs", "params": {"dataset_ref": ref}})["matches"] == 1
    assert Worker(workspace).dispatch({"method": "equity.logger_folder", "params": {}})["exists"] is True
