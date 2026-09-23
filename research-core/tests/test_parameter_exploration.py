"""`.set` schema parsing, parameter studies, and evaluation (PX-001–PX-007)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from trading_research_core.errors import CoreError
from trading_research_core.mt5_optimisation import intake_parameter_grid
from trading_research_core.mt5_set import decode_set_bytes, intake_parameter_schema, parse_set_text
from trading_research_core.parameter_exploration import create_study, evaluate
from trading_research_core.worker import Worker

SET_TEXT = """; saved automatically on 2026.09.21
InpMode=2||0||0||3||Y
InpLot=0.02||0.01||0.01||0.05||Y
InpPeriod=20||10||5||30||N
InpComment=DCA-EA
InpUseFilter=true||false||0||true||N
"""


def _xml(rows: list[tuple[str, str, str, str, str, str]], params: tuple[str, str] = ("InpMode", "InpLot")) -> str:
    header = ["Pass", "Profit", "Equity DD %", "Trades", *params]
    cells = lambda values: "".join(f'<Cell><Data ss:Type="String">{value}</Data></Cell>' for value in values)
    body = "".join(f"<Row>{cells(row)}</Row>" for row in rows)
    return f'<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office"><o:DocumentProperties><o:Title>EA EURUSD,H4</o:Title><o:Deposit>10000 USD</o:Deposit></o:DocumentProperties><Worksheet ss:Name="Tester Optimizator Results"><Table><Row>{cells(header)}</Row>{body}</Table></Worksheet></Workbook>'


ROWS = [
    ("1", "100", "10", "30", "2", "0.02"),   # the default signature (2, 0.02)
    ("2", "150", "20", "25", "1", "0.03"),
    ("3", "90", "12", "40", "3", "0.02"),    # dominated by 1
    ("4", "300", "35", "10", "0", "0.05"),   # fails trades >= 20
]


def _study(tmp_path: Path, rows: list[tuple[str, ...]] = ROWS, set_text: str | None = SET_TEXT, encoding: str = "utf-16") -> dict[str, object]:
    workspace = tmp_path / "workspace"
    xml = tmp_path / "opt.xml"
    xml.write_text(_xml(rows), encoding="utf-8")
    optimisation = intake_parameter_grid(workspace, str(xml), "1-minute OHLC")
    schema_ref = None
    if set_text is not None:
        set_path = tmp_path / "ea.set"
        set_path.write_bytes(set_text.encode(encoding) if encoding != "utf-16" else "﻿".encode("utf-16-le") + set_text.encode("utf-16-le"))
        schema_ref = intake_parameter_schema(workspace, str(set_path))["schema_ref"]
    return create_study(workspace, str(optimisation["optimisation_ref"]), schema_ref)


def test_set_parser_kinds_ranges_and_defaults() -> None:
    parameters = {item["name"]: item for item in parse_set_text(SET_TEXT)}
    assert parameters["InpMode"] | {} == {"name": "InpMode", "value": "2", "start": "0", "step": "0", "stop": "3", "optimise": True, "kind": "NUMERIC", "ordinal": False, "value_count": 4}
    assert parameters["InpLot"]["ordinal"] is True and parameters["InpLot"]["value_count"] == 5
    assert parameters["InpPeriod"]["optimise"] is False and parameters["InpPeriod"]["value_count"] == 5
    assert parameters["InpComment"]["kind"] == "TEXT" and parameters["InpComment"]["start"] is None
    assert parameters["InpUseFilter"]["kind"] == "BOOLEAN" and parameters["InpUseFilter"]["value_count"] == 2


@pytest.mark.parametrize("raw,encoding", [
    ("﻿A=1".encode("utf-16-le"), "UTF-16"),
    ("A=1".encode("utf-16-le"), "UTF-16-LE"),
    (b"\xef\xbb\xbfA=1", "UTF-8-BOM"),
    (b"A=1", "UTF-8"),
])
def test_set_encodings(raw: bytes, encoding: str) -> None:
    text, detected = decode_set_bytes(raw)
    assert detected == encoding and parse_set_text(text)[0]["value"] == "1"


@pytest.mark.parametrize("text", ["", "; only a comment", "novalue", "A=1||0||1||5", "A=1||0||1||5||maybe", "A=1\nA=2"])
def test_set_layout_errors(text: str) -> None:
    with pytest.raises(CoreError) as error:
        parse_set_text(text)
    assert error.value.code == "E_SET_LAYOUT_UNSUPPORTED"


def test_schema_intake_is_immutable_and_reports_grid(tmp_path: Path) -> None:
    source = tmp_path / "ea.set"
    source.write_text(SET_TEXT, encoding="utf-8")
    first = intake_parameter_schema(tmp_path / "ws", str(source))
    second = intake_parameter_schema(tmp_path / "ws", str(source))
    assert first["optimised_parameters"] == ["InpMode", "InpLot"]
    assert first["full_grid_size"] == "20"
    assert first["default"]["InpLot"] == "0.02"
    assert (first["intake_status"], second["intake_status"]) == ("SNAPSHOT_CREATED", "REUSED_IDENTICAL_SOURCE")
    assert first["schema_ref"] == second["schema_ref"]


def test_study_finds_default_and_maps_metrics(tmp_path: Path) -> None:
    study = _study(tmp_path)
    assert study["status"] == "READY"
    assert study["default"]["status"] == "IN_OPTIMISATION"
    assert {metric["id"]: metric["default_direction"] for metric in study["metrics"]} == {"net_profit": "MAX", "equity_drawdown_pct": "MIN", "trades": None}
    assert [finding["code"] for finding in study["findings"]] == ["FIXED_INPUTS_UNVERIFIABLE"]
    lot = next(parameter for parameter in study["parameters"] if parameter["name"] == "InpLot")
    assert lot["ordinal"] is True and lot["tested_values"] == ["0.02", "0.03", "0.05"] and lot["default"] == "0.02"


def test_default_matches_numerically_equal_text(tmp_path: Path) -> None:
    rows = [("1", "100", "10", "30", "2", "0.020"), ("2", "150", "20", "25", "1", "0.03")]
    assert _study(tmp_path, rows)["default"]["status"] == "IN_OPTIMISATION"


def test_default_not_tested_and_off_grid_warnings(tmp_path: Path) -> None:
    rows = [("1", "100", "10", "30", "1", "0.04"), ("2", "150", "20", "25", "1", "0.045")]
    study = _study(tmp_path, rows)
    codes = [finding["code"] for finding in study["findings"]]
    assert study["default"] == {"signature": {"InpMode": "2", "InpLot": "0.02"}, "pass_id": None, "status": "NOT_TESTED"}
    assert "DEFAULT_NOT_TESTED" in codes and "VALUES_OFF_SCHEMA_GRID" in codes
    assert study["status"] == "READY"


def test_parameter_missing_from_schema_blocks(tmp_path: Path) -> None:
    study = _study(tmp_path, set_text="InpMode=2||0||0||3||Y\n")
    assert study["status"] == "BLOCKED"
    assert any(finding["code"] == "PARAMETER_NOT_IN_SCHEMA" and finding["subjects"] == ["InpLot"] for finding in study["findings"])
    with pytest.raises(CoreError) as error:
        evaluate(tmp_path / "workspace", str(study["study_ref"]), [{"metric": "net_profit", "direction": "MAX"}])
    assert error.value.code == "E_STUDY_BLOCKED"


def test_study_without_schema(tmp_path: Path) -> None:
    study = _study(tmp_path, set_text=None)
    assert study["status"] == "READY" and study["default"]["status"] == "NO_SCHEMA"
    assert [finding["code"] for finding in study["findings"]] == ["NO_SCHEMA"]


def test_evaluate_constraints_pareto_and_default_flag(tmp_path: Path) -> None:
    study = _study(tmp_path)
    result = evaluate(tmp_path / "workspace", str(study["study_ref"]), [{"metric": "net_profit", "direction": "MAX"}, {"metric": "equity_drawdown_pct", "direction": "MIN"}], [{"metric": "trades", "operator": ">=", "threshold": "20"}])
    by_pass = {candidate["pass"]: candidate for candidate in result["candidates"]}
    assert [by_pass[key]["pareto"]["status"] for key in "1234"] == ["PARETO", "PARETO", "DOMINATED", "CONSTRAINED"]
    assert by_pass["1"]["is_default"] is True and not any(by_pass[key]["is_default"] for key in "234")
    assert by_pass["3"]["pareto"]["dominated_by_example"] == by_pass["1"]["id"]
    assert by_pass["4"]["pareto"]["violations"][0]["value"] == "10"
    assert by_pass["2"]["parameters"] == {"InpMode": "1", "InpLot": "0.03"}
    assert result["counts"] == {"PARETO": 2, "DOMINATED": 1, "CONSTRAINED": 1, "INCOMPLETE": 0}


def test_evaluate_rejects_unknown_metrics_and_is_deterministic(tmp_path: Path) -> None:
    study = _study(tmp_path)
    workspace = tmp_path / "workspace"
    with pytest.raises(CoreError) as error:
        evaluate(workspace, str(study["study_ref"]), [{"metric": "cagr", "direction": "MAX"}])
    assert error.value.code == "E_STUDY_METRIC_UNKNOWN"
    objectives = [{"metric": "net_profit", "direction": "MAX"}, {"metric": "equity_drawdown_pct", "direction": "MIN"}]
    assert json.dumps(evaluate(workspace, str(study["study_ref"]), objectives), sort_keys=True) == json.dumps(evaluate(workspace, str(study["study_ref"]), objectives), sort_keys=True)


def test_worker_exploration_methods(tmp_path: Path) -> None:
    xml, set_path = tmp_path / "opt.xml", tmp_path / "ea.set"
    xml.write_text(_xml(ROWS), encoding="utf-8")
    set_path.write_text(SET_TEXT, encoding="utf-8")
    worker = Worker(tmp_path / "ws")
    call = lambda method, **params: worker.dispatch({"method": method, "params": params})
    methods = call("core.capabilities")["methods"]
    assert {"exploration.intake_parameter_schema", "exploration.create_study", "exploration.evaluate"} <= set(methods)
    optimisation = call("optimisation.intake_parameter_grid", source_path=str(xml), modelling_mode="1-minute OHLC")
    schema = call("exploration.intake_parameter_schema", source_path=str(set_path))
    study = call("exploration.create_study", optimisation_ref=optimisation["optimisation_ref"], schema_ref=schema["schema_ref"])
    result = call("exploration.evaluate", study_ref=study["study_ref"], objectives=[{"metric": "net_profit", "direction": "MAX"}])
    assert result["counts"]["PARETO"] == 1


def test_render_choice_is_core_derived_and_quotes_reason(tmp_path: Path) -> None:
    from trading_research_core.parameter_exploration import render_choice
    study = _study(tmp_path)
    workspace = tmp_path / "workspace"
    objectives = [{"metric": "net_profit", "direction": "MAX"}, {"metric": "equity_drawdown_pct", "direction": "MIN"}]
    evaluation = evaluate(workspace, str(study["study_ref"]), objectives)
    candidate = next(item for item in evaluation["candidates"] if item["pass"] == "2")
    rendered = render_choice(workspace, str(study["study_ref"]), objectives, [], candidate["id"], "Lower drawdown matters more.\nAccept less profit.")
    markdown = rendered["markdown"]
    assert rendered["evaluation_id"] == evaluation["evaluation_id"]
    assert "MT5 pass 2 — on the Pareto frontier" in markdown
    assert "| InpLot | 0.03 | 0.02 |" in markdown
    assert "| Net profit | 150 |" in markdown
    assert "> Lower drawdown matters more.\n> Accept less profit." in markdown
    assert "not a recommendation" in markdown
    with pytest.raises(CoreError) as error:
        render_choice(workspace, str(study["study_ref"]), objectives, [], "not-a-pass", "x")
    assert error.value.code == "E_STUDY_CANDIDATE_UNKNOWN"
