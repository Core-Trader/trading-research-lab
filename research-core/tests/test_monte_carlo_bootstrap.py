from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from trading_research_core.dataset_store import write_dataset
from trading_research_core.errors import CoreError
from trading_research_core.monte_carlo import _Pcg32
from trading_research_core.monte_carlo_bootstrap import bootstrap_scenario, draw_path
from trading_research_core.worker import Worker
from test_monte_carlo import _imported


def _ref(tmp_path: Path, values: list[str]) -> str:
    return str(write_dataset(tmp_path, _imported(values))["dataset_ref"])


def test_same_seed_same_paths_and_result(tmp_path: Path) -> None:
    ref = _ref(tmp_path, ["5", "-3", "8", "-6", "2", "-1", "4"])
    first = bootstrap_scenario(tmp_path, ref, "7", 200, "RESAMPLE")
    second = bootstrap_scenario(tmp_path, ref, "7", 200, "RESAMPLE")
    assert first["final_summary"] == second["final_summary"]
    assert first["analysis_id"] == second["analysis_id"]
    assert first["configuration"]["sampling_method"] == "RESAMPLE_WITH_REPLACEMENT"
    assert bootstrap_scenario(tmp_path, ref, "8", 200, "RESAMPLE")["final_summary"] != first["final_summary"]


def test_resampling_changes_the_total_where_reordering_cannot(tmp_path: Path) -> None:
    ref = _ref(tmp_path, ["10", "-9", "3", "-4"])  # total 0
    result = bootstrap_scenario(tmp_path, ref, "3", 500, "RESAMPLE")
    summary = result["final_summary"]
    assert Decimal(summary["minimum"]) < 0 < Decimal(summary["maximum"])
    assert 0 < Decimal(result["below_zero"]["percent"]) < 100
    assert result["source_total_close_event_pnl"] == "0"


def test_all_winning_trades_never_end_below_zero(tmp_path: Path) -> None:
    ref = _ref(tmp_path, ["1", "2", "3"])
    result = bootstrap_scenario(tmp_path, ref, "1", 100, "RESAMPLE")
    assert result["below_zero"] == {"count": 0, "percent": "0.00000000"}
    other = tmp_path / "losing"  # a separate workspace: the synthetic reports share one source hash
    all_losing = bootstrap_scenario(other, _ref(other, ["-1", "-2", "-3"]), "1", 100, "RESAMPLE")
    assert Decimal(all_losing["below_zero"]["percent"]) == 100


def test_blocks_keep_consecutive_trades_together() -> None:
    population = [Decimal(value) for value in range(1, 11)]  # 1..10
    path = draw_path(population, "BLOCK_RESAMPLE", 3, _Pcg32(11))
    assert len(path) == 10
    for start in range(0, 9, 3):  # each full block is 3 consecutive values of the source
        block = path[start:start + 3]
        if len(block) == 3:
            assert block[1] - block[0] == 1 and block[2] - block[1] == 1


def test_drawdown_limit_share_and_percentiles(tmp_path: Path) -> None:
    ref = _ref(tmp_path, ["4", "-6", "5", "-7", "3", "-2", "6", "-5"])
    result = bootstrap_scenario(tmp_path, ref, "5", 300, "BLOCK_RESAMPLE", 2, "8")
    over = result["over_limit"]
    assert over["limit"] == "8" and 0 <= over["count"] <= 300
    percentiles = [Decimal(item["maximum_drawdown"]) for item in result["drawdown_percentiles"]]
    assert percentiles == sorted(percentiles)
    assert result["tail_values"] == ["p99", "minimum", "maximum"]
    assert result["configuration"]["block_length"] == 2


@pytest.mark.parametrize("method,block,limit", [("OTHER", None, None), ("BLOCK_RESAMPLE", None, None), ("BLOCK_RESAMPLE", 1, None), ("BLOCK_RESAMPLE", 4, None), ("RESAMPLE", None, "-5"), ("RESAMPLE", None, "abc")])
def test_invalid_configuration(tmp_path: Path, method: str, block: int | None, limit: str | None) -> None:
    ref = _ref(tmp_path, ["1", "-2", "3", "-1"])
    with pytest.raises(CoreError) as error:
        bootstrap_scenario(tmp_path, ref, "1", 10, method, block, limit)
    assert error.value.code == "E_MONTE_CARLO_CONFIG_INVALID"


def test_worker_runs_and_records_from_the_stored_result(tmp_path: Path) -> None:
    ref = _ref(tmp_path, ["5", "-3", "8", "-6", "2"])
    worker = Worker(tmp_path)
    result = worker.dispatch({"method": "scenario.monte_carlo_bootstrap", "params": {"dataset_ref": ref, "seed": "9", "path_count": 50, "method": "RESAMPLE"}})
    note = worker.dispatch({"method": "scenario.render_bootstrap_note", "params": {"dataset_ref": ref, "analysis_id": result["analysis_id"], "reason": "fine"}})
    assert note["markdown"].startswith("### Monte Carlo checked")
    assert "Paths ending below zero" in note["markdown"] and "Your conclusion: fine" in note["markdown"]
    with pytest.raises(CoreError):
        worker.dispatch({"method": "scenario.render_bootstrap_note", "params": {"dataset_ref": ref, "analysis_id": "missing", "reason": ""}})
