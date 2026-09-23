"""Parameter neighbourhood analysis (PARAMETER_NEIGHBOURHOOD_SPEC.md, N1–N7)."""

from __future__ import annotations

from itertools import product
from pathlib import Path

import pytest

from trading_research_core.errors import CoreError
from trading_research_core.mt5_optimisation import intake_parameter_grid
from trading_research_core.mt5_set import decode_set_bytes, intake_parameter_schema, parse_set_text
from trading_research_core.neighbourhood import _box, _grid, attach_neighbourhood_run, neighbourhood, render_neighbourhood_set, write_neighbourhood_set
from trading_research_core.parameter_exploration import create_study, evaluate, render_choice
from trading_research_core.worker import Worker

SET_TEXT = """InpMode=0||0||0||1||Y
InpA=3||1||1||5||Y
InpB=30||10||10||50||Y
InpLot=0.02||0.01||0.01||0.03||Y
InpComment=DCA
InpPeriod=14||7||7||28||N
"""
PARAMS = ("InpMode", "InpA", "InpB", "InpLot")
TITLE = "ExampleEA EURUSD,H4 2020.01.01-2024.12.31"
HELD_LOT = {"InpLot": "HELD_FIXED"}
PROFIT = [{"metric": "net_profit", "direction": "MAX"}]


def _xml(rows: list[tuple[str, ...]], params: tuple[str, ...] = PARAMS, title: str = TITLE) -> str:
    header = ["Pass", "Profit", "Equity DD %", "Trades", *params]
    cells = lambda values: "".join(f'<Cell><Data ss:Type="String">{value}</Data></Cell>' for value in values)
    body = "".join(f"<Row>{cells(row)}</Row>" for row in rows)
    return f'<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office"><o:DocumentProperties><o:Title>{title}</o:Title><o:Deposit>10000 USD</o:Deposit></o:DocumentProperties><Worksheet ss:Name="Tester Optimizator Results"><Table><Row>{cells(header)}</Row>{body}</Table></Worksheet></Workbook>'


def _rows(candidate_profit: str = "100", candidate_dd: str = "4", neighbours: int = 4) -> list[tuple[str, ...]]:
    # (pass, profit, equity DD %, trades, mode, A, B, lot)
    around = [("2", "10", "5", "20", "0", "2", "30", "0.02"), ("3", "20", "6", "20", "0", "4", "30", "0.020"), ("4", "30", "7", "20", "0", "3", "20", "0.02"), ("5", "40", "8", "20", "0", "3", "40", "0.02")]
    return [
        ("1", candidate_profit, candidate_dd, "20", "0", "3", "30", "0.02"),
        *around[:neighbours],
        ("6", "5", "9", "20", "0", "5", "50", "0.02"),    # two steps away
        ("7", "999", "1", "20", "1", "3", "40", "0.02"),  # other mode: never a neighbour
        ("8", "50", "3", "20", "0", "2", "20", "0.03"),   # neighbour only when lot is ordinal
        ("9", "1", "1", "20", "0", "1", "10", "0.02"),    # corner
    ]


def _study(tmp_path: Path, rows: list[tuple[str, ...]] | None = None) -> tuple[Path, str, dict[str, str]]:
    workspace = tmp_path / "workspace"
    xml = tmp_path / "opt.xml"
    xml.write_text(_xml(rows or _rows()), encoding="utf-8")
    optimisation = intake_parameter_grid(workspace, str(xml), "1-minute OHLC")
    set_path = tmp_path / "ea.set"
    set_path.write_bytes("﻿".encode("utf-16-le") + SET_TEXT.encode("utf-16-le"))
    schema_ref = intake_parameter_schema(workspace, str(set_path))["schema_ref"]
    study = create_study(workspace, str(optimisation["optimisation_ref"]), schema_ref)
    ids = {candidate["pass"]: candidate["id"] for candidate in evaluate(workspace, str(study["study_ref"]), PROFIT)["candidates"]}
    return workspace, str(study["study_ref"]), ids


def test_box_matches_brute_force_with_clipping(tmp_path: Path) -> None:
    workspace, study_ref, _ = _study(tmp_path)
    from trading_research_core.parameter_exploration import _read_study
    study = _read_study(workspace, study_ref)
    for roles, radius in [(HELD_LOT, 1), (HELD_LOT, 2), (None, 1)]:
        grid = _grid(study, roles, radius)
        lasts = grid["last"]
        for position in product(*[range(last + 1) for last in lasts]):
            expected = [offsets for offsets in product(*[range(last + 1) for last in lasts]) if offsets != position and max(abs(a - b) for a, b in zip(offsets, position)) <= radius]
            assert sorted(_box(grid, position, radius)) == sorted(expected)
    assert _grid(study, None, 1)["roles"] == {"InpMode": "CATEGORICAL", "InpA": "ORDINAL", "InpB": "ORDINAL", "InpLot": "ORDINAL"}


def test_coverage_numeric_signature_and_role_equality(tmp_path: Path) -> None:
    workspace, study_ref, ids = _study(tmp_path)
    held = neighbourhood(workspace, study_ref, ids["1"], PROFIT, HELD_LOT, 1)
    assert (held["coverage"]["possible"], held["coverage"]["tested"]) == (8, 4)  # "0.020" matched; other mode excluded
    assert held["coverage"]["held_equal"] == ["InpMode", "InpLot"]
    assert [item["label"] for item in held["neighbours"]] == ["Pass 2", "Pass 4", "Pass 5", "Pass 3"]
    assert held["neighbours"][0]["differs"] == {"InpA": "2"}
    ordinal_lot = neighbourhood(workspace, study_ref, ids["1"], PROFIT, None, 1)
    assert (ordinal_lot["coverage"]["possible"], ordinal_lot["coverage"]["tested"]) == (26, 5)
    wide = neighbourhood(workspace, study_ref, ids["1"], PROFIT, HELD_LOT, 2)
    assert (wide["coverage"]["possible"], wide["coverage"]["tested"]) == (24, 6)
    corner = neighbourhood(workspace, study_ref, ids["9"], PROFIT, HELD_LOT, 1)
    assert corner["coverage"]["possible"] == 3 and corner["boundaries"] == [{"name": "InpA", "steps_below": 0, "steps_above": 4}, {"name": "InpB", "steps_below": 0, "steps_above": 4}]


def test_statistics_need_four_tested_neighbours(tmp_path: Path) -> None:
    workspace, study_ref, ids = _study(tmp_path, _rows(neighbours=3))
    result = neighbourhood(workspace, study_ref, ids["1"], PROFIT, HELD_LOT, 1)
    assert result["coverage"]["sufficient"] is False and result["statistics"] is None and result["isolated_peak"] is None
    assert [item["distance"] for item in result["nearest"]] == [1, 1, 1, 2, 2]  # listed anyway, no statistics


def test_statistics_quartiles_and_isolated_peak(tmp_path: Path) -> None:
    workspace, study_ref, ids = _study(tmp_path)
    result = neighbourhood(workspace, study_ref, ids["1"], PROFIT, HELD_LOT, 1)
    assert result["statistics"]["net_profit"] | {} == {"direction": "MAX", "count": 4, "median": "25", "q1": "17.5", "q3": "32.5", "iqr": "15", "candidate_value": "100", "candidate_better_than": 4, "best_neighbour": "40", "margin_over_best": "60"}
    assert result["isolated_peak"]["flag"] is True
    assert result["context"] == {"profit_positive_share": "1", "worst_equity_drawdown_pct": "8"}
    both = neighbourhood(workspace, study_ref, ids["1"], [*PROFIT, {"metric": "equity_drawdown_pct", "direction": "MIN"}], HELD_LOT, 1)
    assert both["statistics"]["equity_drawdown_pct"]["iqr"] == "1.5" and both["statistics"]["equity_drawdown_pct"]["margin_over_best"] == "1"
    assert both["isolated_peak"]["flag"] is False  # must hold on every objective


@pytest.mark.parametrize("profit,flag", [("42", False), ("55", False), ("55.01", True)])
def test_isolated_peak_boundary(tmp_path: Path, profit: str, flag: bool) -> None:
    workspace, study_ref, ids = _study(tmp_path, _rows(candidate_profit=profit))
    assert neighbourhood(workspace, study_ref, ids["1"], PROFIT, HELD_LOT, 1)["isolated_peak"]["flag"] is flag


def test_slice_marks_candidate_and_untested_cells(tmp_path: Path) -> None:
    workspace, study_ref, ids = _study(tmp_path)
    grid = neighbourhood(workspace, study_ref, ids["1"], PROFIT, HELD_LOT, 1)["slice"]
    assert grid["axes"] == ["InpA", "InpB"] and grid["x_values"] == ["1", "2", "3", "4", "5"] and grid["y_values"] == ["10", "20", "30", "40", "50"]
    assert grid["cells"][2][2] == {"value": "100", "tested": True, "id": ids["1"], "is_candidate": True}
    assert grid["cells"][1][2]["value"] == "30" and grid["cells"][0][0]["value"] == "1"
    assert grid["cells"][3][0] == {"value": None, "tested": False, "id": None, "is_candidate": False}
    assert sum(cell["tested"] for row in grid["cells"] for cell in row) == 7  # pass 7 (other mode) and pass 8 (other lot) excluded
    assert neighbourhood(workspace, study_ref, ids["1"], PROFIT, None, 1)["slice"]["axes"] == ["InpA", "InpLot"]  # fewest grid values by default


def test_invalid_configuration(tmp_path: Path) -> None:
    workspace, study_ref, ids = _study(tmp_path)
    for roles, radius in [({"InpMode": "ORDINAL"}, 1), ({"Nope": "ORDINAL"}, 1), (HELD_LOT, 3), ({"InpA": "HELD_FIXED", "InpB": "HELD_FIXED", "InpLot": "HELD_FIXED"}, 1)]:
        with pytest.raises(CoreError) as error:
            neighbourhood(workspace, study_ref, ids["1"], PROFIT, roles, radius)
        assert error.value.code == "E_NEIGHBOURHOOD_CONFIG_INVALID"


def test_neighbourhood_set_round_trips_and_clips(tmp_path: Path) -> None:
    workspace, study_ref, ids = _study(tmp_path)
    rendered = render_neighbourhood_set(workspace, study_ref, ids["1"], HELD_LOT, 1)
    parsed = {item["name"]: item for item in parse_set_text(str(rendered["set_text"]))}
    assert [name for name, item in parsed.items() if item["optimise"]] == ["InpA", "InpB"]
    assert (parsed["InpA"]["start"], parsed["InpA"]["stop"], parsed["InpB"]["start"], parsed["InpB"]["stop"]) == ("2", "4", "20", "40")
    assert (parsed["InpMode"]["value"], parsed["InpLot"]["value"], parsed["InpComment"]["value"], parsed["InpPeriod"]["optimise"]) == ("0", "0.02", "DCA", False)
    assert rendered["runs"] == 9 and rendered["suggested_filename"] == "ExampleEA_neighbourhood_pass_1_r1.set"
    corner = render_neighbourhood_set(workspace, study_ref, ids["9"], HELD_LOT, 1)
    assert corner["varied"] == {"InpA": {"start": "1", "step": "1", "stop": "2"}, "InpB": {"start": "10", "step": "10", "stop": "20"}} and corner["runs"] == 4


def test_write_never_overwrites_and_writes_utf16(tmp_path: Path) -> None:
    workspace, study_ref, ids = _study(tmp_path)
    target = tmp_path / "out.set"
    written = write_neighbourhood_set(workspace, study_ref, ids["1"], str(target), HELD_LOT, 1)
    raw = target.read_bytes()
    assert raw.startswith(b"\xff\xfe") and decode_set_bytes(raw)[1] == "UTF-16" and written["runs"] == 9
    with pytest.raises(CoreError) as error:
        write_neighbourhood_set(workspace, study_ref, ids["1"], str(target), HELD_LOT, 1)
    assert error.value.code == "E_SET_TARGET_EXISTS" and target.read_bytes() == raw
    with pytest.raises(CoreError):
        write_neighbourhood_set(workspace, study_ref, ids["1"], str(tmp_path / "out.txt"), HELD_LOT, 1)


def _run(tmp_path: Path, workspace: Path, name: str, rows: list[tuple[str, ...]], title: str = TITLE) -> str:
    xml = tmp_path / f"{name}.xml"
    xml.write_text(_xml(rows, ("InpA", "InpB"), title), encoding="utf-8")
    return str(intake_parameter_grid(workspace, str(xml), "1-minute OHLC")["optimisation_ref"])


def test_attach_neighbourhood_run_fills_coverage(tmp_path: Path) -> None:
    workspace, study_ref, ids = _study(tmp_path, _rows(neighbours=2))
    before = neighbourhood(workspace, study_ref, ids["1"], PROFIT, HELD_LOT, 1)["coverage"]
    write_neighbourhood_set(workspace, study_ref, ids["1"], str(tmp_path / "n.set"), HELD_LOT, 1)
    grid_rows = [(str(index + 1), str(60 + index), "5", "20", str(a), str(b)) for index, (a, b) in enumerate(product(range(2, 5), range(20, 41, 10)))]
    grid_rows[0] = ("1", "999", "5", "20", "2", "20")
    grid_rows[1] = ("2", "11", "5", "20", "2", "30")  # study pass 2 has profit 10: results differ
    attached = attach_neighbourhood_run(workspace, study_ref, _run(tmp_path, workspace, "run", grid_rows))
    assert attached["status"] == "READY" and attached["run_count"] == 9
    assert [finding["code"] for finding in attached["findings"]] == ["RESULTS_DIFFER_FROM_STUDY"]
    after = neighbourhood(workspace, study_ref, ids["1"], PROFIT, HELD_LOT, 1)
    assert (before["tested"], after["coverage"]["tested"]) == (2, 8)
    assert after["coverage"]["by_source"] == {"OPTIMISATION": 2, "SINGLE_TEST": 0, "NEIGHBOURHOOD_RUN": 6}
    assert next(item for item in after["neighbours"] if item["differs"] == {"InpA": "2"})["metrics"]["net_profit"] == "10"  # the study's pass is kept
    assert after["configuration_hash"] != neighbourhood(workspace, study_ref, ids["1"], PROFIT, HELD_LOT, 2)["configuration_hash"]


def test_attach_blocks_on_context_or_unknown_box(tmp_path: Path) -> None:
    workspace, study_ref, ids = _study(tmp_path)
    rows = [("1", "60", "5", "20", "2", "20")]
    unmatched = attach_neighbourhood_run(workspace, study_ref, _run(tmp_path, workspace, "a", rows))
    assert unmatched["status"] == "BLOCKED" and unmatched["findings"][0]["code"] == "NO_MATCHING_NEIGHBOURHOOD_SET"
    write_neighbourhood_set(workspace, study_ref, ids["1"], str(tmp_path / "n.set"), HELD_LOT, 1)
    other_dates = attach_neighbourhood_run(workspace, study_ref, _run(tmp_path, workspace, "b", rows, "ExampleEA EURUSD,H4 2025.01.01-2025.12.31"))
    assert other_dates["status"] == "BLOCKED" and other_dates["findings"][0]["code"] == "CONTEXT_DIFFERS"
    assert neighbourhood(workspace, study_ref, ids["1"], PROFIT, HELD_LOT, 1)["coverage"]["by_source"]["NEIGHBOURHOOD_RUN"] == 0


def test_choice_block_records_neighbourhood(tmp_path: Path) -> None:
    workspace, study_ref, ids = _study(tmp_path)
    markdown = str(render_choice(workspace, study_ref, PROFIT, [], ids["1"], "plateau check", {"roles": HELD_LOT, "radius": 1})["markdown"])
    assert "- Neighbourhood (±1 step(s); held equal: InpMode, InpLot): 4 of 8 neighbouring settings tested; statistics shown; isolated peak: yes" in markdown
    assert "Neighbourhood" not in str(render_choice(workspace, study_ref, PROFIT, [], ids["1"], "no neighbourhood")["markdown"])


def test_worker_exposes_neighbourhood(tmp_path: Path) -> None:
    workspace, study_ref, ids = _study(tmp_path)
    worker = Worker(workspace)
    methods = worker.dispatch({"method": "core.capabilities", "params": {}})["methods"]
    assert {"exploration.neighbourhood", "exploration.render_neighbourhood_set", "exploration.write_neighbourhood_set", "exploration.attach_neighbourhood_run"} <= set(methods)
    result = worker.dispatch({"method": "exploration.neighbourhood", "params": {"study_ref": study_ref, "candidate_id": ids["1"], "objectives": PROFIT, "roles": HELD_LOT, "radius": 1}})
    assert result["coverage"]["tested"] == 4
    first = worker.dispatch({"method": "exploration.neighbourhood", "params": {"study_ref": study_ref, "candidate_id": ids["1"], "objectives": PROFIT, "roles": HELD_LOT, "radius": 1}})
    assert first == result  # deterministic
