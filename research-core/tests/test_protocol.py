from __future__ import annotations

import io
import json
from pathlib import Path

from trading_research_core.protocol import parse_request
from trading_research_core.dataset_store import write_dataset
from trading_research_core.worker import Worker, serve


def test_rejects_unversioned_request() -> None:
    try:
        parse_request('{"request_id":"r1","method":"core.capabilities","params":{}}')
    except Exception as error:
        assert getattr(error, "code") == "E_REQUEST_INVALID"
    else:
        raise AssertionError("Expected versioned request validation failure")


def test_capabilities_response_is_one_protocol_line(tmp_path: Path) -> None:
    input_stream = io.StringIO('{"protocol":1,"request_id":"r1","method":"core.capabilities","params":{}}\n')
    output_stream = io.StringIO()
    assert serve(tmp_path, input_stream=input_stream, output_stream=output_stream) == 0
    response = json.loads(output_stream.getvalue())
    assert response["success"] is True
    assert response["request_id"] == "r1"
    assert "dataset.import_mt5_excel" in response["result"]["methods"]
    assert "dataset.intake_mt5_excel" in response["result"]["methods"]
    assert "dataset.list_registry" in response["result"]["methods"]
    assert "dataset.get_evidence" in response["result"]["methods"]
    assert "dataset.verify_raw_snapshot" in response["result"]["methods"]
    assert "portfolio.preflight_mt5_excel_batch" in response["result"]["methods"]
    assert "portfolio.create_combined_realised_balance" in response["result"]["methods"]
    assert "portfolio.combined_daily_drawdown" in response["result"]["methods"]
    assert "analysis.close_event_summary" in response["result"]["methods"]
    assert "analysis.reconstruct_lifecycles" in response["result"]["methods"]
    assert "analysis.lifecycle_summary" in response["result"]["methods"]
    assert "time.validate_profile" in response["result"]["methods"]
    assert "analysis.realised_balance_daily_drawdown" in response["result"]["methods"]
    assert "analysis.equity_availability" in response["result"]["methods"]
    assert "scenario.fixed_close_event_cost" in response["result"]["methods"]
    assert "scenario.monte_carlo_order_permutation" in response["result"]["methods"]
    assert "optimisation.intake_parameter_grid" in response["result"]["methods"]
    assert "optimisation.intake_paired_forward_grid" in response["result"]["methods"]
    assert "report.prepare_payload" in response["result"]["methods"]
    assert "report.commit_revision_manifest" in response["result"]["methods"]


def test_cancel_is_structured_when_no_operation_is_active(tmp_path: Path) -> None:
    input_stream = io.StringIO('{"protocol":1,"request_id":"r2","method":"core.cancel","params":{"target_request_id":"r1"}}\n')
    output_stream = io.StringIO()
    assert serve(tmp_path, input_stream=input_stream, output_stream=output_stream) == 0
    response = json.loads(output_stream.getvalue())
    assert response["success"] is True
    assert response["result"]["status"] == "NO_ACTIVE_OPERATION"


def test_m2_worker_methods_write_compact_artifacts_only(tmp_path: Path) -> None:
    source_sha256 = "B" * 64
    imported = {
        "source": {"sha256": source_sha256, "filename": "synthetic.xlsx", "byte_count": 1, "worksheet_name": "Report"},
        "settings": {"Currency": "USD"},
        "events": [
            {"source_sequence": 1, "source_timestamp": "2026-01-01T00:00:00", "event_type": "POSITION_OPEN", "side": "BUY", "symbol": "EURUSD", "volume": "1", "source_profit": "0", "source_commission": "-1", "source_swap": "0", "reported_balance": "1000"},
            {"source_sequence": 2, "source_timestamp": "2026-01-02T00:00:00", "event_type": "POSITION_CLOSE", "side": "BUY", "symbol": "EURUSD", "volume": "1", "source_profit": "12", "source_commission": "-1", "source_swap": "0", "reported_balance": "1010"},
            {"source_sequence": 3, "source_timestamp": "2026-01-03T00:00:00", "event_type": "POSITION_CLOSE", "side": "BUY", "symbol": "EURUSD", "volume": "1", "source_profit": "0", "source_commission": "0", "source_swap": "0", "reported_balance": "1010"},
        ],
    }
    dataset_ref = str(write_dataset(tmp_path, imported)["dataset_ref"])
    worker = Worker(tmp_path)
    close_events = worker.dispatch({"method": "analysis.close_event_summary", "params": {"dataset_ref": dataset_ref}})
    lifecycles = worker.dispatch({"method": "analysis.reconstruct_lifecycles", "params": {"dataset_ref": dataset_ref, "account_mode": "HEDGING"}})
    daily_drawdown = worker.dispatch({"method": "analysis.realised_balance_daily_drawdown", "params": {"dataset_ref": dataset_ref}})
    equity = worker.dispatch({"method": "analysis.equity_availability", "params": {"dataset_ref": dataset_ref}})
    scenario = worker.dispatch({"method": "scenario.fixed_close_event_cost", "params": {"dataset_ref": dataset_ref, "additional_cost_per_close_event": "0.5"}})
    monte_carlo = worker.dispatch({"method": "scenario.monte_carlo_order_permutation", "params": {"dataset_ref": dataset_ref, "seed": "42", "path_count": 5}})
    report_payload = worker.dispatch({"method": "report.prepare_payload", "params": {"dataset_ref": dataset_ref, "analysis_run_id": "11111111-1111-7111-8111-111111111111", "report_id": "01234567-89ab-7cde-8123-456789abcdef"}})
    report_manifest = worker.dispatch({"method": "report.commit_revision_manifest", "params": {"payload": report_payload, "report_revision": 1, "prior_configuration_hash": None}})
    assert close_events["summary"]["net_pnl"] == "11"
    assert close_events["artifacts"]["table"].endswith(":close-events")
    assert lifecycles["quality_counts"]["INFERRED"] == 1
    assert lifecycles["artifacts"]["table"].endswith(":lifecycles")
    assert daily_drawdown["time_basis"] == "SOURCE_REPORTED_CLOCK"
    assert daily_drawdown["artifacts"]["table"].endswith(":daily-realised-balance-drawdown")
    assert equity["status"] == "UNAVAILABLE"
    assert scenario["analysis_basis"] == "MT5_VERIFIED_CLOSE_EVENTS"
    assert scenario["scenario_summary"]["net_pnl"] == "10.0"
    assert monte_carlo["population_count"] == 2
    assert len(str(report_payload["generated_block_hash"])) == 64
    assert report_manifest["manifest_ref"] == "report:01234567-89ab-7cde-8123-456789abcdef:revision:1"
