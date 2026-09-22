"""Restartable NDJSON subprocess worker for the Obsidian desktop plugin."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

from . import CORE_VERSION, PROTOCOL_MAJOR
from .analysis import basic_statistics, markdown_summary
from .dataset_store import read_dataset, write_dataset
from .errors import CoreError
from .mt5_excel import import_mt5_excel
from .intake import get_evidence, intake_mt5_excel, list_registry, verify_raw_snapshot
from .protocol import encode, failure, parse_request, success
from .reporting import prepare_report_payload, write_report_revision_manifest
from .trade_analysis import close_event_summary, reconstruct_lifecycles, write_trade_artifact
from .time_risk import equity_availability, realised_balance_daily_drawdown, validate_time_profile, write_daily_drawdown_artifact
from .portfolio_preflight import combined_daily_drawdown, create_combined_realised_balance, preflight_mt5_excel_batch
from .what_if import fixed_close_event_cost_scenario
from .monte_carlo import order_permutation_scenario
from .mt5_optimisation import intake_parameter_grid, intake_paired_forward_grid


class Worker:
    """Dispatch the small M0 method surface without writing diagnostic text to stdout."""

    def __init__(self, workspace_root: Path) -> None:
        self.workspace_root = workspace_root.resolve()
        self.workspace_root.mkdir(parents=True, exist_ok=True)

    def dispatch(self, request: dict[str, Any]) -> dict[str, Any]:
        method = request["method"]
        params = request["params"]
        if method == "core.capabilities":
            return {
                "core_version": CORE_VERSION,
                "protocol": PROTOCOL_MAJOR,
                "methods": [
                    "core.capabilities",
                    "dataset.import_mt5_excel",
                    "dataset.intake_mt5_excel",
                    "dataset.list_registry",
                    "dataset.get_evidence",
                    "dataset.verify_raw_snapshot",
                    "portfolio.preflight_mt5_excel_batch",
                    "portfolio.create_combined_realised_balance",
                    "portfolio.combined_daily_drawdown",
                    "analysis.basic_statistics",
                    "analysis.close_event_summary",
                    "analysis.reconstruct_lifecycles",
                    "analysis.lifecycle_summary",
                    "time.validate_profile",
                    "analysis.realised_balance_daily_drawdown",
                    "analysis.equity_availability",
                    "scenario.fixed_close_event_cost",
                    "scenario.monte_carlo_order_permutation",
                    "optimisation.intake_parameter_grid",
                    "optimisation.intake_paired_forward_grid",
                    "report.prepare_payload",
                    "report.commit_revision_manifest",
                    "experiment.render_payload",
                    "core.cancel",
                    "core.shutdown",
                ],
                "storage": {"canonical_events": "Parquet", "metadata": "JSON"},
            }
        if method == "dataset.import_mt5_excel":
            source_path = _required_string(params, "source_path")
            imported = import_mt5_excel(source_path)
            return write_dataset(self.workspace_root, imported)
        if method == "dataset.intake_mt5_excel":
            return intake_mt5_excel(self.workspace_root, _required_string(params, "source_path"))
        if method == "dataset.list_registry":
            return list_registry(self.workspace_root)
        if method == "dataset.get_evidence":
            return get_evidence(self.workspace_root, _required_string(params, "dataset_ref"))
        if method == "dataset.verify_raw_snapshot":
            return verify_raw_snapshot(self.workspace_root, _required_string(params, "dataset_ref"))
        if method == "portfolio.preflight_mt5_excel_batch":
            paths = params.get("source_paths")
            if not isinstance(paths, list) or not all(isinstance(path, str) and path.strip() for path in paths):
                raise CoreError("E_REQUEST_INVALID", "params.source_paths must be a list of non-empty strings.")
            return preflight_mt5_excel_batch(self.workspace_root, paths)
        if method == "portfolio.create_combined_realised_balance":
            paths = params.get("source_paths")
            if not isinstance(paths, list) or not all(isinstance(path, str) and path.strip() for path in paths):
                raise CoreError("E_REQUEST_INVALID", "params.source_paths must be a list of non-empty strings.")
            return create_combined_realised_balance(self.workspace_root, paths)
        if method == "portfolio.combined_daily_drawdown":
            paths = params.get("source_paths")
            if not isinstance(paths, list) or not all(isinstance(path, str) and path.strip() for path in paths):
                raise CoreError("E_REQUEST_INVALID", "params.source_paths must be a list of non-empty strings.")
            return combined_daily_drawdown(self.workspace_root, paths)
        if method == "analysis.basic_statistics":
            dataset_ref = _required_string(params, "dataset_ref")
            return basic_statistics(read_dataset(self.workspace_root, dataset_ref))
        if method == "analysis.close_event_summary":
            dataset_ref = _required_string(params, "dataset_ref")
            result, rows = close_event_summary(read_dataset(self.workspace_root, dataset_ref))
            return write_trade_artifact(self.workspace_root, dataset_ref, "close-events", result, rows)
        if method in {"analysis.reconstruct_lifecycles", "analysis.lifecycle_summary"}:
            dataset_ref = _required_string(params, "dataset_ref")
            account_mode = _required_string(params, "account_mode")
            result, rows = reconstruct_lifecycles(read_dataset(self.workspace_root, dataset_ref), account_mode=account_mode)
            return write_trade_artifact(self.workspace_root, dataset_ref, "lifecycles", result, rows)
        if method == "time.validate_profile":
            return validate_time_profile()
        if method == "analysis.realised_balance_daily_drawdown":
            dataset_ref = _required_string(params, "dataset_ref")
            result, rows = realised_balance_daily_drawdown(read_dataset(self.workspace_root, dataset_ref))
            return write_daily_drawdown_artifact(self.workspace_root, dataset_ref, result, rows)
        if method == "analysis.equity_availability":
            dataset_ref = _required_string(params, "dataset_ref")
            return equity_availability(read_dataset(self.workspace_root, dataset_ref))
        if method == "scenario.fixed_close_event_cost":
            return fixed_close_event_cost_scenario(
                self.workspace_root,
                _required_string(params, "dataset_ref"),
                _required_string(params, "additional_cost_per_close_event"),
            )
        if method == "scenario.monte_carlo_order_permutation":
            path_count = params.get("path_count")
            if isinstance(path_count, bool) or not isinstance(path_count, int):
                raise CoreError("E_REQUEST_INVALID", "params.path_count must be an integer.")
            return order_permutation_scenario(
                self.workspace_root,
                _required_string(params, "dataset_ref"),
                _required_string(params, "seed"),
                path_count,
            )
        if method == "optimisation.intake_parameter_grid":
            return intake_parameter_grid(
                self.workspace_root,
                _required_string(params, "source_path"),
                _required_string(params, "modelling_mode"),
            )
        if method == "optimisation.intake_paired_forward_grid":
            return intake_paired_forward_grid(
                self.workspace_root,
                _required_string(params, "in_sample_path"), _required_string(params, "forward_path"),
                _required_string(params, "in_sample_start"), _required_string(params, "in_sample_end"),
                _required_string(params, "forward_start"), _required_string(params, "forward_end"),
                _required_string(params, "modelling_mode"),
            )
        if method == "report.prepare_payload":
            dataset_ref = _required_string(params, "dataset_ref")
            return prepare_report_payload(
                read_dataset(self.workspace_root, dataset_ref),
                analysis_run_id=_required_string(params, "analysis_run_id"),
                report_id=_required_string(params, "report_id"),
            )
        if method == "report.commit_revision_manifest":
            payload = params.get("payload")
            revision = params.get("report_revision")
            prior_hash = params.get("prior_configuration_hash")
            if not isinstance(payload, dict) or not isinstance(revision, int) or (prior_hash is not None and not isinstance(prior_hash, str)):
                raise CoreError("E_REQUEST_INVALID", "report commit requires payload, integer report_revision, and optional prior_configuration_hash.")
            return write_report_revision_manifest(self.workspace_root, payload, report_revision=revision, prior_configuration_hash=prior_hash)
        if method == "experiment.render_payload":
            dataset_ref = _required_string(params, "dataset_ref")
            analysis_run_id = _required_string(params, "analysis_run_id")
            statistics = basic_statistics(read_dataset(self.workspace_root, dataset_ref), analysis_run_id=analysis_run_id)
            return {
                "dataset_ref": dataset_ref,
                "dataset_id": statistics["dataset_id"],
                "source_import_id": statistics["source_import_id"],
                "analysis_run_id": analysis_run_id,
                "core_version": statistics["core_version"],
                "markdown": markdown_summary(statistics),
            }
        if method == "core.cancel":
            target_request_id = _required_string(params, "target_request_id")
            return {
                "target_request_id": target_request_id,
                "status": "NO_ACTIVE_OPERATION",
                "message": "M0 operations are synchronous and no cancellable operation is active.",
            }
        if method == "core.shutdown":
            return {"shutdown": True}
        raise CoreError("E_METHOD_UNKNOWN", "Unknown worker method.", details={"method": method})


def serve(workspace_root: Path, input_stream: Any = sys.stdin, output_stream: Any = sys.stdout) -> int:
    """Serve requests until stdin closes or a successful shutdown request arrives."""

    worker = Worker(workspace_root)
    for raw_line in input_stream:
        request_id: str | None = None
        try:
            request = parse_request(raw_line)
            request_id = request["request_id"]
            result = worker.dispatch(request)
            response = success(request_id, result)
        except CoreError as error:
            response = failure(request_id, error.code, error.message, error.details)
        except Exception as error:  # Do not disclose stack traces through the UI protocol.
            response = failure(request_id, "E_INTERNAL", "Unexpected worker failure.", {"type": type(error).__name__})
        output_stream.write(encode(response) + "\n")
        output_stream.flush()
        if response.get("success") and response.get("result", {}).get("shutdown") is True:
            return 0
    return 0


def _required_string(params: dict[str, Any], key: str) -> str:
    value = params.get(key)
    if not isinstance(value, str) or not value.strip():
        raise CoreError("E_REQUEST_INVALID", f"params.{key} must be a non-empty string.")
    return value


def main() -> int:
    # The IPC specification requires UTF-8 NDJSON. Windows console defaults can
    # otherwise encode Unicode Markdown as a local code page while Node reads
    # the child pipe as UTF-8.
    sys.stdout.reconfigure(encoding="utf-8", errors="strict")
    sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")
    parser = argparse.ArgumentParser(description="Trading Research Lab local research worker")
    parser.add_argument("--workspace-root", type=Path, required=True)
    args = parser.parse_args()
    return serve(args.workspace_root)


if __name__ == "__main__":
    raise SystemExit(main())
