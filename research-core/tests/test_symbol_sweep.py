"""MT5 symbol sweeps (SYMBOL_SWEEP_SPEC.md S1–S9)."""

from __future__ import annotations

from pathlib import Path

import pytest

from trading_research_core.errors import CoreError
from trading_research_core.mt5_optimisation import intake_parameter_grid
from trading_research_core.pareto import evaluate as pareto_evaluate
from trading_research_core.symbol_sweep import MAX_COMPARE, compare_symbol_sweeps, delete_symbol_sweep, evaluate_symbol_sweep, intake_symbol_sweep, list_symbol_sweeps, parse_symbol_sweep, render_symbol_shortlist
from trading_research_core.worker import Worker

HEADERS = ["Symbol", "Pass", "Result", "Profit", "Expected Payoff", "Profit Factor", "Recovery Factor", "Sharpe Ratio", "Custom", "Equity DD %", "Trades"]
OWNER_FILES = sorted((Path(__file__).resolve().parents[2] / "data" / "raw").glob("SYMBOL-SWEEP-*.xml"))


def sweep_xml(rows: list[list[str]], title: str = "My EA CADCHF,H4 2025.03.01-2026.03.01", deposit: str = "15000 USD", headers: list[str] = HEADERS) -> bytes:
    def cell(value: str) -> str:
        return f'<Cell><Data ss:Type="String">{value}</Data></Cell>'
    body = "<Row>" + "".join(cell(h) for h in headers) + "</Row>" + "".join("<Row>" + "".join(cell(v) for v in item) + "</Row>" for item in rows)
    return (
        '<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'
        f'<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Title>{title}</Title><Server>Demo</Server><Deposit>{deposit}</Deposit><Leverage>100</Leverage><Build>64</Build></DocumentProperties>'
        f'<Worksheet ss:Name="Tester Optimizator Results"><Table>{body}</Table></Worksheet></Workbook>'
    ).encode("utf-8")


def row(symbol: str, profit: str, dd: str, trades: str = "50", pf: str = "1.5") -> list[str]:
    return [symbol, "1", str(10000 + float(profit)), profit, "1.0", pf, "1.0", "0.5", "0", dd, trades]


def write(tmp_path: Path, name: str, data: bytes) -> str:
    path = tmp_path / name
    path.write_bytes(data)
    return str(path)


@pytest.mark.skipif(not OWNER_FILES, reason="owner sweep files are local (data/raw is git-ignored)")
def test_owner_files_parse_exactly() -> None:
    experts = []
    for path in OWNER_FILES:
        parsed = parse_symbol_sweep(path.read_bytes())
        assert len(parsed["rows"]) == 20 and len({item["symbol"] for item in parsed["rows"]}) == 20
        assert parsed["context"]["timeframe"] == "H4" and (parsed["context"]["start"], parsed["context"]["end"]) == ("2025.03.01", "2026.03.01")
        assert parsed["context"]["deposit"] == "15000 USD" and parsed["context"]["server"] == "RoboForex-Pro"
        assert [metric["id"] for metric in parsed["metrics"]][:3] == ["mt5_result", "net_profit", "expected_payoff"]
        experts.append(parsed["context"]["expert"])
    assert experts == ["EA_DCA_CENT_V1", "Jagfx-DCA_V2.0.4", "DCA_EA"]
    first = parse_symbol_sweep(OWNER_FILES[0].read_bytes())["rows"][0]
    assert (first["symbol"], first["net_profit"], first["profit_factor"], first["equity_drawdown_pct"], first["trades"]) == ("GBPCHF", "522.86", "1.593727", "14.2414", "114")


def test_the_two_importers_send_each_other_s_files_to_the_right_page(tmp_path: Path) -> None:
    sweep = write(tmp_path, "sweep.xml", sweep_xml([row("EURUSD", "10", "1")]))
    with pytest.raises(CoreError) as wrong_page:
        intake_parameter_grid(tmp_path / "ws", sweep, "declared")
    assert wrong_page.value.code == "E_OPTIMISATION_IS_SYMBOL_SWEEP" and "Symbol scan" in wrong_page.value.message
    grid = write(tmp_path, "grid.xml", sweep_xml([["1", "10", "10", "1"]], headers=["Pass", "Result", "Profit", "InpLots"]))
    with pytest.raises(CoreError) as grid_error:
        intake_symbol_sweep(tmp_path / "ws", grid, "Every tick")
    assert grid_error.value.code == "E_SWEEP_IS_PARAMETER_GRID"
    with_inputs = write(tmp_path, "inputs.xml", sweep_xml([["EURUSD", "1", "10", "10", "0.1"]], headers=["Symbol", "Pass", "Result", "Profit", "InpLots"]))
    with pytest.raises(CoreError) as inputs:
        intake_symbol_sweep(tmp_path / "ws", with_inputs, "Every tick")
    assert inputs.value.code == "E_SWEEP_HAS_INPUT_COLUMNS"
    duplicated = write(tmp_path, "dup.xml", sweep_xml([row("EURUSD", "10", "1"), row("EURUSD", "11", "1")]))
    with pytest.raises(CoreError) as dup:
        intake_symbol_sweep(tmp_path / "ws", duplicated, "Every tick")
    assert dup.value.code == "E_SWEEP_SYMBOL_AMBIGUOUS"
    with pytest.raises(CoreError):
        intake_symbol_sweep(tmp_path / "ws", sweep, "  ")


def test_intake_is_immutable_idempotent_and_keeps_zero_trade_rows(tmp_path: Path) -> None:
    source = write(tmp_path, "sweep.xml", sweep_xml([row("EURUSD", "10.50", "2.1"), row("GBPUSD", "0.00", "0.0", trades="0")]))
    first = intake_symbol_sweep(tmp_path / "ws", source, "1 minute OHLC")
    assert first["created"] and first["zero_trade_symbols"] == ["GBPUSD"] and first["declared_set"] is None
    again = intake_symbol_sweep(tmp_path / "ws", source, "1 minute OHLC")
    assert not again["created"] and again["sweep_ref"] == first["sweep_ref"]
    snapshot = tmp_path / "ws" / "raw" / first["source"]["sha256"] / "source.xml"
    assert snapshot.read_bytes() == Path(source).read_bytes()
    evaluation = evaluate_symbol_sweep(tmp_path / "ws", first["sweep_ref"])
    assert [(item["symbol"], item["net_profit"], item["zero_trades"]) for item in evaluation["rows"]] == [("EURUSD", "10.50", False), ("GBPUSD", "0.00", True)]


def test_declared_set_is_recorded_but_labelled_unverifiable(tmp_path: Path) -> None:
    set_file = tmp_path / "inputs.set"
    set_file.write_text("InpLots=0.10||0.10||0.01||1.00||N\nInpMode=1||1||1||3||N\n", encoding="utf-8")
    result = intake_symbol_sweep(tmp_path / "ws", write(tmp_path, "sweep.xml", sweep_xml([row("EURUSD", "10", "1")])), "Every tick", str(set_file))
    assert result["declared_set"]["status"] == "DECLARED_NOT_VERIFIABLE" and result["declared_set"]["inputs"]["InpLots"] == "0.10"


def test_frontier_and_constraints_match_the_shared_pareto_layer(tmp_path: Path) -> None:
    rows = [row("AAA", "300", "30"), row("BBB", "200", "10"), row("CCC", "100", "20"), row("DDD", "50", "5", trades="8")]
    ref = intake_symbol_sweep(tmp_path / "ws", write(tmp_path, "s.xml", sweep_xml(rows)), "Every tick")["sweep_ref"]
    constraints = [{"metric": "trades", "operator": ">=", "threshold": "10"}]
    result = evaluate_symbol_sweep(tmp_path / "ws", ref, constraints=constraints)
    status = {item["symbol"]: item["pareto"]["status"] for item in result["rows"]}
    assert status == {"AAA": "PARETO", "BBB": "PARETO", "CCC": "DOMINATED", "DDD": "CONSTRAINED"}
    brute = pareto_evaluate([{"id": r[0], "values": {"net_profit": r[3], "equity_drawdown_pct": r[9], "trades": r[10]}} for r in rows],
                            [{"metric": "net_profit", "direction": "MAX"}, {"metric": "equity_drawdown_pct", "direction": "MIN"}], constraints)
    assert status == {item["id"]: item["status"] for item in brute["candidates"]}
    with pytest.raises(CoreError):
        evaluate_symbol_sweep(tmp_path / "ws", ref, objectives=[{"metric": "not_a_metric", "direction": "MAX"}])


def test_compare_lists_differences_marks_untested_and_caps_at_six(tmp_path: Path) -> None:
    ws = tmp_path / "ws"
    a = intake_symbol_sweep(ws, write(tmp_path, "a.xml", sweep_xml([row("EURUSD", "10", "1"), row("GBPUSD", "20", "2")], title="EA One CADCHF,H4 2025.03.01-2026.03.01")), "Every tick")["sweep_ref"]
    b = intake_symbol_sweep(ws, write(tmp_path, "b.xml", sweep_xml([row("EURUSD", "-5", "3")], title="EA Two CADCHF,H4 2025.03.01-2026.03.01")), "Every tick")["sweep_ref"]
    c = intake_symbol_sweep(ws, write(tmp_path, "c.xml", sweep_xml([row("EURUSD", "7", "1")], title="EA Three CADCHF,H1 2024.01.01-2025.01.01", deposit="10000 USD")), "1 minute OHLC")["sweep_ref"]
    same = compare_symbol_sweeps(ws, [a, b], "net_profit")
    assert same["comparable"] and same["differences"] == []
    assert same["matrix"] == [{"symbol": "EURUSD", "values": ["10", "-5"], "tested": [True, True]}, {"symbol": "GBPUSD", "values": ["20", None], "tested": [True, False]}]
    mixed = compare_symbol_sweeps(ws, [a, c], "net_profit")
    assert not mixed["comparable"] and {item["field"] for item in mixed["differences"]} == {"period", "timeframe", "deposit", "modelling mode"}
    assert MAX_COMPARE == 6
    with pytest.raises(CoreError):
        compare_symbol_sweeps(ws, [a], "net_profit")
    with pytest.raises(CoreError):
        compare_symbol_sweeps(ws, [a] * 7, "net_profit")


def test_shortlist_markdown_list_delete_and_worker(tmp_path: Path) -> None:
    ws = tmp_path / "ws"
    ref = intake_symbol_sweep(ws, write(tmp_path, "s.xml", sweep_xml([row("EURUSD", "10", "1"), row("GBPUSD", "20", "2")])), "Every tick")["sweep_ref"]
    shortlist = render_symbol_shortlist(ws, [ref], ["GBPUSD", "EURUSD"], "Lowest drawdown for the profit")
    assert "- Symbols: EURUSD, GBPUSD" in shortlist["markdown"] and "Every tick based on real ticks" in shortlist["markdown"]
    assert shortlist["shortlist_id"] == render_symbol_shortlist(ws, [ref], ["EURUSD", "GBPUSD"], "other words")["shortlist_id"]
    with pytest.raises(CoreError):
        render_symbol_shortlist(ws, [ref], ["USDJPY"], "")
    worker = Worker(ws)
    assert worker.dispatch({"method": "sweep.list", "params": {}})["sweeps"][0]["sweep_ref"] == ref
    assert worker.dispatch({"method": "sweep.delete", "params": {"sweep_ref": ref}})["deleted"] is True
    assert list_symbol_sweeps(ws)["sweeps"] == []
    with pytest.raises(CoreError):
        delete_symbol_sweep(ws, ref)
