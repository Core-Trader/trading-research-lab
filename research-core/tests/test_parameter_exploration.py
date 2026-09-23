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


def _single_report(path: Path, inputs: dict[str, str], *, period: str = "H4 (2026.01.01 - 2026.05.19)", expert: str = "ExampleEA") -> None:
    from openpyxl import Workbook
    from trading_research_core.mt5_excel import REQUIRED_DEAL_HEADERS
    workbook = Workbook()
    sheet = workbook.active
    rows: list[list[object]] = [["Strategy Tester Report"], ["Settings"], ["Expert:", None, None, expert], ["Symbol:", None, None, "EURUSD"], ["Period:", None, None, period]]
    for index, (name, value) in enumerate(inputs.items()):
        rows.append(["Inputs:" if index == 0 else None, None, None, f"{name}={value}"])
    rows += [["Currency:", None, None, "USD"], ["Initial Deposit:", None, None, 10000], ["Leverage:", None, None, "1:100"], ["Results"],
             ["Total Net Profit:", None, None, 120.5, "Equity Drawdown Absolute:", 3],
             ["Gross Profit:", None, None, 200, "Equity Drawdown Relative:", "8.25% (80.00)"],
             ["Profit Factor:", None, None, 2.5, "Expected Payoff:", 4.1],
             ["Recovery Factor:", None, None, 1.5, "Sharpe Ratio:", 1.2, "OnTester result:", "7"],
             ["Total Trades:", None, None, 29], ["Deals"], list(REQUIRED_DEAL_HEADERS),
             ["2026.01.01 00:00:00", "1", None, "Balance", None, None, None, None, 0, 0, 0, 10000, "Opening balance"],
             ["2026.01.02 00:00:00", "2", "EURUSD", "Buy", "Out", 0.1, 1.1, "10", 0, 0, 120.5, 10120.5, "Close"]]
    for row in rows:
        sheet.append(row)
    workbook.save(path)


def _study_with_title(tmp_path: Path) -> tuple[Path, dict[str, object]]:
    workspace = tmp_path / "workspace"
    xml = tmp_path / "opt.xml"
    xml.write_text(_xml(ROWS).replace("<o:Title>EA EURUSD,H4</o:Title>", "<o:Title>ExampleEA EURUSD,H4 2026.01.01-2026.05.19</o:Title>"), encoding="utf-8")
    optimisation = intake_parameter_grid(workspace, str(xml), "1-minute OHLC")
    set_path = tmp_path / "ea.set"
    set_path.write_text(SET_TEXT, encoding="utf-8")
    schema_ref = intake_parameter_schema(workspace, str(set_path))["schema_ref"]
    return workspace, create_study(workspace, str(optimisation["optimisation_ref"]), schema_ref)


def _attach(tmp_path: Path, workspace: Path, study: dict[str, object], name: str, inputs: dict[str, str], **kwargs: str) -> dict[str, object]:
    from trading_research_core.intake import intake_mt5_excel
    from trading_research_core.parameter_exploration import add_single_test
    report = tmp_path / f"{name}.xlsx"
    _single_report(report, inputs, **kwargs)
    dataset_ref = str(intake_mt5_excel(workspace, str(report))["dataset_ref"])
    return add_single_test(workspace, str(study["study_ref"]), dataset_ref)


DEFAULT_INPUTS = {"InpMode": "2", "InpLot": "0.02", "InpPeriod": "20", "InpComment": "DCA-EA", "InpUseFilter": "true"}


def test_report_summary_maps_results_to_study_metric_ids(tmp_path: Path) -> None:
    from trading_research_core.mt5_report_summary import read_report_summary
    report = tmp_path / "single.xlsx"
    _single_report(report, DEFAULT_INPUTS)
    summary = read_report_summary(report)
    assert (summary["expert"], summary["symbol"], summary["timeframe"], summary["start"], summary["end"]) == ("ExampleEA", "EURUSD", "H4", "2026.01.01", "2026.05.19")
    assert summary["inputs"]["InpLot"] == "0.02" and summary["initial_deposit"] == "10000"
    assert summary["metrics"] == {"net_profit": "120.5", "profit_factor": "2.5", "recovery_factor": "1.5", "expected_payoff": "4.1", "mt5_sharpe": "1.2", "trades": "29", "mt5_custom": "7", "equity_drawdown_pct": "8.25"}


def test_single_test_with_all_default_inputs_becomes_the_default(tmp_path: Path) -> None:
    rows = [row for row in ROWS if row[0] != "1"]  # remove the default pass from the optimisation
    workspace = tmp_path / "workspace"
    xml = tmp_path / "opt.xml"
    xml.write_text(_xml(rows).replace("<o:Title>EA EURUSD,H4</o:Title>", "<o:Title>ExampleEA EURUSD,H4 2026.01.01-2026.05.19</o:Title>"), encoding="utf-8")
    optimisation = intake_parameter_grid(workspace, str(xml), "1-minute OHLC")
    set_path = tmp_path / "ea.set"
    set_path.write_text(SET_TEXT, encoding="utf-8")
    study = create_study(workspace, str(optimisation["optimisation_ref"]), intake_parameter_schema(workspace, str(set_path))["schema_ref"])
    assert study["default"]["status"] == "NOT_TESTED"
    attached = _attach(tmp_path, workspace, study, "default", DEFAULT_INPUTS)
    assert attached["status"] == "READY" and attached["is_default"] is True
    assert [finding["code"] for finding in attached["findings"]] == []
    result = evaluate(workspace, str(study["study_ref"]), [{"metric": "net_profit", "direction": "MAX"}, {"metric": "equity_drawdown_pct", "direction": "MIN"}])
    single = next(candidate for candidate in result["candidates"] if candidate["source"] == "SINGLE_TEST")
    assert single["is_default"] is True and single["pass"] is None and single["metrics"]["equity_drawdown_pct"] == "8.25"
    assert result["study"]["default"]["status"] == "SINGLE_TEST"
    assert single["pareto"]["status"] in {"PARETO", "DOMINATED"}
    assert result["configuration"]["single_tests"] == [[single["id"], "mt5-report-summary-1"]] or result["configuration"]["single_tests"] == [(single["id"], "mt5-report-summary-1")]


def test_fixed_input_difference_is_reported_and_not_default(tmp_path: Path) -> None:
    workspace, study = _study_with_title(tmp_path)
    attached = _attach(tmp_path, workspace, study, "changed", {**DEFAULT_INPUTS, "InpPeriod": "25"})
    assert attached["is_default"] is False
    assert any(finding["code"] == "FIXED_INPUTS_DIFFER" and finding["subjects"] == ["InpPeriod"] for finding in attached["findings"])
    assert any(finding["code"] == "MATCHES_PASS" for finding in attached["findings"])


def test_context_mismatch_blocks_the_single_test(tmp_path: Path) -> None:
    workspace, study = _study_with_title(tmp_path)
    attached = _attach(tmp_path, workspace, study, "other_period", DEFAULT_INPUTS, period="H4 (2025.01.01 - 2025.12.31)")
    assert attached["status"] == "BLOCKED"
    finding = next(finding for finding in attached["findings"] if finding["code"] == "CONTEXT_DIFFERS")
    assert finding["subjects"] == ["start", "end"]
    result = evaluate(workspace, str(study["study_ref"]), [{"metric": "net_profit", "direction": "MAX"}])
    assert all(candidate["source"] == "OPTIMISATION" for candidate in result["candidates"])


def test_missing_optimised_input_blocks(tmp_path: Path) -> None:
    workspace, study = _study_with_title(tmp_path)
    attached = _attach(tmp_path, workspace, study, "no_lot", {"InpMode": "2", "InpPeriod": "20"})
    assert attached["status"] == "BLOCKED"
    assert any(finding["code"] == "INPUT_MISSING" and finding["subjects"] == ["InpLot"] for finding in attached["findings"])


def _titled(tmp_path: Path, name: str, rows: list[tuple[str, ...]], title: str, params: tuple[str, str] = ("InpMode", "InpLot")) -> str:
    xml = tmp_path / f"{name}.xml"
    xml.write_text(_xml(rows, params).replace("<o:Title>EA EURUSD,H4</o:Title>", f"<o:Title>{title}</o:Title>"), encoding="utf-8")
    return str(intake_parameter_grid(tmp_path / "workspace", str(xml), "1-minute OHLC")["optimisation_ref"])


def test_forward_join_by_normalised_signature_with_contiguous_periods(tmp_path: Path) -> None:
    from trading_research_core.parameter_exploration import attach_forward
    in_ref = _titled(tmp_path, "is", ROWS, "ExampleEA EURUSD,H4 2020.01.01-2024.12.31")
    forward_rows = [("7", "40", "15", "12", "2", "0.020"), ("8", "-10", "30", "9", "1", "0.03"), ("9", "5", "3", "4", "0", "0.01")]
    out_ref = _titled(tmp_path, "fw", forward_rows, "ExampleEA EURUSD,H4 2025.01.01-2025.12.31")
    study = create_study(tmp_path / "workspace", in_ref)
    attached = attach_forward(tmp_path / "workspace", str(study["study_ref"]), out_ref)
    assert attached["status"] == "READY" and attached["findings"] == []
    assert (attached["matched_count"], attached["in_sample_only_count"], attached["forward_only_count"]) == (2, 2, 1)
    assert attached["period"] == {"in_sample": ["2020.01.01", "2024.12.31"], "forward": ["2025.01.01", "2025.12.31"], "source": "MT5_TITLE"}
    result = evaluate(tmp_path / "workspace", str(study["study_ref"]), [{"metric": "net_profit", "direction": "MAX"}])
    by_pass = {candidate["pass"]: candidate for candidate in result["candidates"]}
    assert by_pass["1"]["forward"] == {"pass": "7", "metrics": {"net_profit": "40", "equity_drawdown_pct": "15", "trades": "12"}}
    assert by_pass["2"]["forward"]["metrics"]["net_profit"] == "-10"
    assert by_pass["3"]["forward"] is None
    assert result["forward"]["matched_count"] == 2 and result["configuration"]["forward"] == out_ref


def test_forward_overlap_and_parameter_mismatch(tmp_path: Path) -> None:
    from trading_research_core.parameter_exploration import attach_forward
    in_ref = _titled(tmp_path, "is", ROWS, "ExampleEA EURUSD,H4 2020.01.01-2025.12.31")
    same_period = _titled(tmp_path, "fw", ROWS, "ExampleEA EURUSD,H4 2020.01.01-2025.12.31")
    study = create_study(tmp_path / "workspace", in_ref)
    overlap = attach_forward(tmp_path / "workspace", str(study["study_ref"]), same_period)
    assert overlap["status"] == "READY" and [finding["code"] for finding in overlap["findings"]] == ["PERIODS_OVERLAP"]
    other_params = _titled(tmp_path, "fw2", [("1", "1", "1", "1", "2", "5")], "ExampleEA EURUSD,H4 2026.01.01-2026.03.31", ("InpMode", "InpPeriod"))
    blocked = attach_forward(tmp_path / "workspace", str(study["study_ref"]), other_params)
    assert blocked["status"] == "BLOCKED" and any(finding["code"] == "PARAMETERS_DIFFER" for finding in blocked["findings"])
    result = evaluate(tmp_path / "workspace", str(study["study_ref"]), [{"metric": "net_profit", "direction": "MAX"}])
    assert [finding["code"] for finding in result["forward"]["findings"]] == ["PERIODS_OVERLAP"]


def test_blocked_forward_is_not_used(tmp_path: Path) -> None:
    from trading_research_core.parameter_exploration import attach_forward
    in_ref = _titled(tmp_path, "is", ROWS, "ExampleEA EURUSD,H4 2020.01.01-2024.12.31")
    other_symbol = _titled(tmp_path, "fw", ROWS, "ExampleEA GBPUSD,H4 2025.01.01-2025.12.31")
    study = create_study(tmp_path / "workspace", in_ref)
    blocked = attach_forward(tmp_path / "workspace", str(study["study_ref"]), other_symbol)
    assert blocked["status"] == "BLOCKED" and blocked["findings"][0]["code"] == "CONTEXT_DIFFERS"
    result = evaluate(tmp_path / "workspace", str(study["study_ref"]), [{"metric": "net_profit", "direction": "MAX"}])
    assert result["forward"] is None and all(candidate["forward"] is None for candidate in result["candidates"])
