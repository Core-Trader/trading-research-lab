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
from .intake import delete_dataset, deletion_preview, get_evidence, intake_mt5_excel, intake_mt5_report, list_registry, set_archived, verify_raw_snapshot
from .protocol import encode, failure, parse_request, success
from .reporting import prepare_report_payload, write_report_revision_manifest
from .trade_analysis import close_event_summary, reconstruct_lifecycles, write_trade_artifact
from .time_risk import equity_availability, realised_balance_daily_drawdown, validate_time_profile, write_daily_drawdown_artifact
from .portfolio_preflight import combined_daily_drawdown, create_combined_realised_balance, preflight_mt5_excel_batch
from .what_if import fixed_close_event_cost_scenario
from .monte_carlo import order_permutation_scenario
from .display_series import close_event_display_series
from .performance_metrics import performance_metrics
from .r_metrics import r_multiple_metrics
from .portfolio_lab import combine as portfolio_combine, delete_saved_combination, explore as portfolio_explore, list_saved_combinations, save_combination
from .pareto import evaluate as pareto_evaluate
from .mt5_set import intake_parameter_schema
from .parameter_exploration import add_single_test, attach_forward, create_study, evaluate as exploration_evaluate, render_choice
from .equity_log import attach_equity_log, equity_metrics
from .prop_presets import list_presets as prop_list_presets
from .windows import render_windows_note, separate_windows, split_windows
from .symbol_sweep import compare_symbol_sweeps, delete_symbol_sweep, evaluate_symbol_sweep, intake_symbol_sweep, list_symbol_sweeps, render_symbol_shortlist
from .prop_rolling import chain_starts as prop_chain_starts, rolling_starts as prop_rolling_starts
from .prop_check import delete_profile as prop_delete_profile, evaluate as prop_evaluate, list_profiles as prop_list_profiles, save_profile as prop_save_profile
from .set_check import check_set_against_report
from .neighbourhood import attach_neighbourhood_run, neighbourhood, render_neighbourhood_set, write_neighbourhood_set
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
                    "dataset.intake_mt5_report",
                    "dataset.list_registry",
                    "dataset.archive",
                    "dataset.restore",
                    "dataset.deletion_preview",
                    "dataset.delete",
                    "dataset.get_evidence",
                    "dataset.verify_raw_snapshot",
                    "portfolio.preflight_mt5_excel_batch",
                    "portfolio.create_combined_realised_balance",
                    "portfolio.combined_daily_drawdown",
                    "analysis.basic_statistics",
                    "analysis.close_event_summary",
                    "analysis.close_event_display_series",
                    "analysis.performance_metrics",
                    "analysis.r_multiple_metrics",
                    "portfolio.combine",
                    "portfolio.explore",
                    "portfolio.save_combination",
                    "portfolio.list_saved_combinations",
                    "portfolio.delete_saved_combination",
                    "analysis.pareto_evaluate",
                    "exploration.intake_parameter_schema",
                    "exploration.create_study",
                    "exploration.evaluate",
                    "exploration.render_choice",
                    "exploration.add_single_test",
                    "exploration.attach_forward",
                    "exploration.neighbourhood",
                    "exploration.render_neighbourhood_set",
                    "exploration.write_neighbourhood_set",
                    "exploration.attach_neighbourhood_run",
                    "analysis.reconstruct_lifecycles",
                    "analysis.lifecycle_summary",
                    "time.validate_profile",
                    "analysis.realised_balance_daily_drawdown",
                    "analysis.equity_availability",
                    "dataset.attach_equity_log",
                    "dataset.check_set",
                    "analysis.equity_metrics",
                    "prop.list_presets",
                    "windows.split",
                    "windows.separate",
                    "windows.render_note",
                    "sweep.intake",
                    "sweep.list",
                    "sweep.evaluate",
                    "sweep.compare",
                    "sweep.render_shortlist",
                    "sweep.delete",
                    "prop.list_profiles",
                    "prop.save_profile",
                    "prop.delete_profile",
                    "prop.evaluate",
                    "prop.rolling_starts",
                    "prop.chain_starts",
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
        if method == "dataset.intake_mt5_report":
            return intake_mt5_report(self.workspace_root, _required_string(params, "source_path"))
        if method == "dataset.intake_mt5_excel":
            return intake_mt5_excel(self.workspace_root, _required_string(params, "source_path"))
        if method == "dataset.list_registry":
            return list_registry(self.workspace_root)
        if method == "dataset.deletion_preview":
            return deletion_preview(self.workspace_root, _required_string(params, "dataset_ref"))
        if method == "dataset.delete":
            return delete_dataset(self.workspace_root, _required_string(params, "dataset_ref"), _required_string(params, "dependents"))
        if method in {"dataset.archive", "dataset.restore"}:
            return set_archived(self.workspace_root, _required_string(params, "dataset_ref"), method == "dataset.archive")
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
        if method == "portfolio.save_combination":
            tracks = params.get("tracks")
            labels = params.get("labels")
            if not isinstance(tracks, list) or not isinstance(labels, list):
                raise CoreError("E_REQUEST_INVALID", "params.tracks and params.labels must be lists.")
            return save_combination(self.workspace_root, _required_string(params, "name"), labels, tracks, _required_string(params, "starting_capital"), str(params.get("window", "UNION")), str(params.get("day_boundary", "REPORT_CLOCK_MIDNIGHT")))
        if method == "portfolio.list_saved_combinations":
            return list_saved_combinations(self.workspace_root)
        if method == "portfolio.delete_saved_combination":
            return delete_saved_combination(self.workspace_root, _required_string(params, "key"))
        if method == "portfolio.explore":
            tracks = params.get("tracks")
            if not isinstance(tracks, list):
                raise CoreError("E_REQUEST_INVALID", "params.tracks must be a list of dataset-reference lists.")
            return portfolio_explore(self.workspace_root, tracks, _required_string(params, "starting_capital"), str(params.get("window", "UNION")), params.get("objectives"), params.get("constraints"))
        if method == "exploration.intake_parameter_schema":
            return intake_parameter_schema(self.workspace_root, _required_string(params, "source_path"))
        if method == "exploration.create_study":
            schema_ref = params.get("schema_ref")
            if schema_ref is not None and not isinstance(schema_ref, str):
                raise CoreError("E_REQUEST_INVALID", "params.schema_ref must be a string when supplied.")
            return create_study(self.workspace_root, _required_string(params, "optimisation_ref"), schema_ref or None)
        if method == "exploration.evaluate":
            objectives = params.get("objectives")
            constraints = params.get("constraints") or []
            if not isinstance(objectives, list) or not isinstance(constraints, list):
                raise CoreError("E_REQUEST_INVALID", "params.objectives and params.constraints must be lists.")
            return exploration_evaluate(self.workspace_root, _required_string(params, "study_ref"), objectives, constraints)
        if method == "exploration.attach_forward":
            return attach_forward(self.workspace_root, _required_string(params, "study_ref"), _required_string(params, "forward_optimisation_ref"))
        if method == "exploration.add_single_test":
            return add_single_test(self.workspace_root, _required_string(params, "study_ref"), _required_string(params, "dataset_ref"))
        if method == "exploration.render_choice":
            objectives = params.get("objectives")
            constraints = params.get("constraints") or []
            if not isinstance(objectives, list) or not isinstance(constraints, list):
                raise CoreError("E_REQUEST_INVALID", "params.objectives and params.constraints must be lists.")
            reason = params.get("reason", "")
            if not isinstance(reason, str) or len(reason) > 4000:
                raise CoreError("E_REQUEST_INVALID", "params.reason must be text of at most 4000 characters.")
            settings = params.get("neighbourhood")
            if settings is not None and not isinstance(settings, dict):
                raise CoreError("E_REQUEST_INVALID", "params.neighbourhood must be an object with roles and radius.")
            return render_choice(self.workspace_root, _required_string(params, "study_ref"), objectives, constraints, _required_string(params, "candidate_id"), reason, settings)
        if method in {"exploration.neighbourhood", "exploration.render_neighbourhood_set", "exploration.write_neighbourhood_set"}:
            roles = params.get("roles")
            radius = params.get("radius", 1)
            if roles is not None and not isinstance(roles, dict):
                raise CoreError("E_REQUEST_INVALID", "params.roles must map parameter names to roles.")
            if not isinstance(radius, int):
                raise CoreError("E_REQUEST_INVALID", "params.radius must be an integer.")
            study_ref, candidate_id = _required_string(params, "study_ref"), _required_string(params, "candidate_id")
            if method == "exploration.render_neighbourhood_set":
                return render_neighbourhood_set(self.workspace_root, study_ref, candidate_id, roles, radius)
            if method == "exploration.write_neighbourhood_set":
                return write_neighbourhood_set(self.workspace_root, study_ref, candidate_id, _required_string(params, "target_path"), roles, radius)
            objectives = params.get("objectives")
            axes = params.get("slice_axes")
            if not isinstance(objectives, list) or (axes is not None and not isinstance(axes, list)):
                raise CoreError("E_REQUEST_INVALID", "params.objectives must be a list and params.slice_axes a list or null.")
            return neighbourhood(self.workspace_root, study_ref, candidate_id, objectives, roles, radius, axes, params.get("slice_metric"))
        if method == "exploration.attach_neighbourhood_run":
            return attach_neighbourhood_run(self.workspace_root, _required_string(params, "study_ref"), _required_string(params, "optimisation_ref"))
        if method == "analysis.pareto_evaluate":
            candidates = params.get("candidates")
            objectives = params.get("objectives")
            constraints = params.get("constraints") or []
            if not isinstance(candidates, list) or not isinstance(objectives, list) or not isinstance(constraints, list):
                raise CoreError("E_REQUEST_INVALID", "params.candidates and params.objectives must be lists.")
            return pareto_evaluate(candidates, objectives, constraints)
        if method == "portfolio.combine":
            tracks = params.get("tracks")
            if not isinstance(tracks, list):
                raise CoreError("E_REQUEST_INVALID", "params.tracks must be a list of dataset-reference lists.")
            return portfolio_combine(self.workspace_root, tracks, _required_string(params, "starting_capital"), str(params.get("window", "UNION")), str(params.get("day_boundary", "REPORT_CLOCK_MIDNIGHT")))
        if method == "analysis.r_multiple_metrics":
            amount = params.get("r_amount")
            if amount is not None and not isinstance(amount, str):
                raise CoreError("E_REQUEST_INVALID", "params.r_amount must be a decimal string when supplied.")
            return r_multiple_metrics(read_dataset(self.workspace_root, _required_string(params, "dataset_ref")), _required_string(params, "r_source"), amount)
        if method == "analysis.performance_metrics":
            return performance_metrics(read_dataset(self.workspace_root, _required_string(params, "dataset_ref")))
        if method == "analysis.close_event_display_series":
            dataset_ref = _required_string(params, "dataset_ref")
            return close_event_display_series(read_dataset(self.workspace_root, dataset_ref))
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
        if method == "dataset.attach_equity_log":
            return attach_equity_log(self.workspace_root, _required_string(params, "dataset_ref"), _required_string(params, "source_path"), _required_string(params, "modelling_mode"))
        if method == "dataset.check_set":
            return check_set_against_report(self.workspace_root, _required_string(params, "dataset_ref"), _required_string(params, "source_path"))
        if method == "analysis.equity_metrics":
            return equity_metrics(self.workspace_root, _required_string(params, "dataset_ref"))
        if method in {"windows.split", "windows.separate", "windows.render_note"}:
            min_trades, max_losing = params.get("min_trades"), params.get("max_losing_windows")
            mode = "SPLIT" if method == "windows.split" else "SEPARATE" if method == "windows.separate" else str(params.get("mode"))
            if mode == "SPLIT":
                start = params.get("start")
                result = split_windows(self.workspace_root, _required_string(params, "dataset_ref"), params.get("months"), start if isinstance(start, str) and start.strip() else None, min_trades, max_losing)
            elif mode == "SEPARATE":
                result = separate_windows(self.workspace_root, params.get("dataset_refs"), min_trades, max_losing)
            else:
                raise CoreError("E_REQUEST_INVALID", "params.mode must be SPLIT or SEPARATE.")
            return render_windows_note(result, str(params.get("reason") or "")) if method == "windows.render_note" else result
        if method == "sweep.intake":
            set_path = params.get("set_path")
            return intake_symbol_sweep(self.workspace_root, _required_string(params, "source_path"), _required_string(params, "modelling_mode"), set_path if isinstance(set_path, str) and set_path.strip() else None)
        if method == "sweep.list":
            return list_symbol_sweeps(self.workspace_root)
        if method == "sweep.evaluate":
            return evaluate_symbol_sweep(self.workspace_root, _required_string(params, "sweep_ref"), params.get("objectives"), params.get("constraints"))
        if method == "sweep.compare":
            return compare_symbol_sweeps(self.workspace_root, params.get("sweep_refs"), _required_string(params, "metric"))
        if method == "sweep.render_shortlist":
            return render_symbol_shortlist(self.workspace_root, params.get("sweep_refs"), params.get("symbols"), str(params.get("reason") or ""))
        if method == "sweep.delete":
            return delete_symbol_sweep(self.workspace_root, _required_string(params, "sweep_ref"))
        if method == "prop.list_presets":
            return prop_list_presets()
        if method == "prop.list_profiles":
            return prop_list_profiles(self.workspace_root)
        if method == "prop.save_profile":
            profile = params.get("profile")
            if not isinstance(profile, dict):
                raise CoreError("E_REQUEST_INVALID", "params.profile must be an object.")
            supersedes = params.get("supersedes")
            preset_id = params.get("preset_id")
            return prop_save_profile(self.workspace_root, profile, supersedes if isinstance(supersedes, str) and supersedes else None, preset_id if isinstance(preset_id, str) and preset_id else None)
        if method == "prop.delete_profile":
            return prop_delete_profile(self.workspace_root, _required_string(params, "profile_id"))
        if method == "prop.chain_starts":
            zone = params.get("report_clock_zone")
            return prop_chain_starts(self.workspace_root, params.get("profile_ids"), params.get("target"), zone if isinstance(zone, str) and zone.strip() else None, params.get("survival_days"))
        if method == "prop.rolling_starts":
            zone = params.get("report_clock_zone")
            return prop_rolling_starts(self.workspace_root, _required_string(params, "profile_id"), params.get("target"), zone if isinstance(zone, str) and zone.strip() else None, params.get("survival_days"))
        if method == "prop.evaluate":
            zone = params.get("report_clock_zone")
            return prop_evaluate(self.workspace_root, _required_string(params, "profile_id"), params.get("target"), zone if isinstance(zone, str) and zone.strip() else None)
        if method == "analysis.equity_availability":
            dataset_ref = _required_string(params, "dataset_ref")
            try:
                equity = get_evidence(self.workspace_root, dataset_ref).get("equity")
            except CoreError:  # datasets without a registry entry have no equity evidence
                equity = None
            if isinstance(equity, dict) and equity.get("status") == "LINKED_VERIFIED":
                return {"dataset_ref": dataset_ref, "status": "AVAILABLE", "basis": "INTRATRADE_EQUITY", "source": "MT5_TESTER_LOGGED", "equity": equity, "warnings": ["Equity comes from a linked TRL tester log, verified against this report's balances."]}
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
