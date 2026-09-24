"""Per-window comparison of fixed settings over time (PROPOSAL_WINDOWS_AND_NOTES.md, W1–W6).

Two inputs (W2):
- SPLIT: one imported report sliced into calendar windows of N months. A
  trade counts in the window where it closes; each window's drawdown is
  measured from the balance at the window's start (W5).
- SEPARATE: 2–12 imported reports, one per window (W3). They must share EA,
  symbol, timeframe, deposit and inputs, be ordered and must not overlap;
  gaps are reported, not blocked. Each window starts at its own deposit, so
  no balance continuity is required (unlike the sequential batch).

Metrics reuse the Overview's definitions (close-event basis). Thresholds are
the user's own (W4); none has a default. Playbook §5: "fixed-parameter walk
forward" – look at each window, not only the total.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import ROUND_HALF_EVEN, Decimal
from hashlib import sha256
import json
from pathlib import Path
from typing import Any

from .dataset_store import read_dataset
from .errors import CoreError
from .identities import stable_uuid
from .performance_metrics import _balance_points, series_metrics
from .trade_analysis import close_event_summary


CALCULATION_VERSION = "windows-1"
MAX_SEPARATE = 12
MAX_SPLIT_WINDOWS = 60
_ZERO = Decimal(0)
_HUNDRED = Decimal(100)
_STEP = Decimal("0.00000001")


def split_windows(workspace_root: Path, dataset_ref: str, months: int, start: str | None = None, min_trades: int | None = None, max_losing_windows: int | None = None) -> dict[str, object]:
    root = workspace_root.resolve()
    if isinstance(months, bool) or not isinstance(months, int) or not 1 <= months <= 24:
        raise CoreError("E_REQUEST_INVALID", "The window length must be 1 to 24 months.")
    dataset = read_dataset(root, dataset_ref)
    points = _balance_points(dataset)
    closes = _closes(dataset)
    first_day = points[0]["moment"].date()
    last_moment = points[-1]["moment"]
    begin = _parse_date(start) if start else first_day.replace(day=1)
    if begin > last_moment.date():
        raise CoreError("E_REQUEST_INVALID", "The first window starts after the report's last event.")
    bounds: list[tuple[date, date]] = []
    cursor = begin
    while cursor <= last_moment.date():
        following = _add_months(cursor, months)
        bounds.append((cursor, following))
        cursor = following
        if len(bounds) > MAX_SPLIT_WINDOWS:
            raise CoreError("E_REQUEST_INVALID", f"That would make more than {MAX_SPLIT_WINDOWS} windows; choose longer windows.")
    equity_rows = _equity_rows(root, dataset_ref)
    # The report's own test period (MT5's end date is exclusive) decides which windows it fully covers.
    period = _period(dict(dataset["metadata"].get("settings") or {}).get("Period"))
    covered_from = datetime.combine(period[0], datetime.min.time()) if period else points[0]["moment"]
    covered_to = datetime.combine(period[1], datetime.min.time()) if period else last_moment
    windows = []
    for index, (window_start, window_end) in enumerate(bounds, start=1):
        lower = datetime.combine(window_start, datetime.min.time())
        upper = datetime.combine(window_end, datetime.min.time())
        before = [point for point in points if point["moment"] < lower]
        inside = [point for point in points if lower <= point["moment"] < upper]
        opening = before[-1] if before else points[0]
        start_point = {"source_sequence": opening["source_sequence"], "timestamp": lower.isoformat(), "moment": lower, "balance": opening["balance"], "is_close": False}
        window_points = [start_point, *[point for point in inside if point is not points[0]]]
        window_closes = [item for item in closes if lower <= item["moment"] < upper]
        window_equity = [row for row in equity_rows if lower.isoformat() <= row["time"] < upper.isoformat()] if equity_rows else None
        partial = lower < covered_from or upper > covered_to  # the report does not cover the whole window
        windows.append(_window(index, window_start.isoformat(), _day_before(window_end).isoformat(), window_points, window_closes, window_equity, partial=partial, source={"dataset_ref": dataset_ref}))
    configuration = {"calculation_version": CALCULATION_VERSION, "mode": "SPLIT", "dataset_ref": dataset_ref, "months": months, "start": begin.isoformat(), "min_trades": min_trades, "max_losing_windows": max_losing_windows}
    return _result(configuration, windows, [], min_trades, max_losing_windows, dataset=dataset, notes=[
        "A trade counts in the window where it closes; a position open across a boundary adds its whole result to the later window.",
        "Each window's drawdown is measured from the balance at the window's start.",
        "The first and last windows can be partial (the report does not cover the whole window); they are marked.",
    ])


def separate_windows(workspace_root: Path, dataset_refs: list[str], min_trades: int | None = None, max_losing_windows: int | None = None) -> dict[str, object]:
    from .intake import get_evidence
    from .mt5_report_summary import read_report_summary

    root = workspace_root.resolve()
    if not isinstance(dataset_refs, list) or not 2 <= len(dataset_refs) <= MAX_SEPARATE or len(set(dataset_refs)) != len(dataset_refs):
        raise CoreError("E_WINDOWS_INVALID", f"Pick 2 to {MAX_SEPARATE} different reports, one per window.")
    loaded = []
    for ref in dataset_refs:
        dataset = read_dataset(root, ref)
        settings = dict(dataset["metadata"].get("settings") or {})
        try:
            inputs = read_report_summary(Path(str(get_evidence(root, ref)["raw_snapshot_path"])))["inputs"]
        except CoreError:
            inputs = None
        points = _balance_points(dataset)
        loaded.append({"ref": ref, "dataset": dataset, "settings": settings, "inputs": inputs, "points": points, "closes": _closes(dataset),
                       "first": points[0]["moment"], "last": points[-1]["moment"], "period": _period(settings.get("Period"))})
    findings: list[dict[str, object]] = []
    for label, key in (("EA", "Expert"), ("symbol", "Symbol"), ("deposit", "Initial Deposit")):
        values = {str(item["settings"].get(key, "")).strip() for item in loaded}
        if len(values) > 1:
            findings.append(_finding("BLOCKED", "WINDOWS_SETTINGS_DIFFER", f"The reports differ in {label}: {', '.join(sorted(values))}."))
    timeframes = {str(item["settings"].get("Period", "")).split(" ")[0] for item in loaded}
    if len(timeframes) > 1:
        findings.append(_finding("BLOCKED", "WINDOWS_SETTINGS_DIFFER", f"The reports differ in timeframe: {', '.join(sorted(timeframes))}."))
    if all(item["inputs"] is not None for item in loaded):
        reference = loaded[0]["inputs"]
        differing = sorted({name for item in loaded[1:] for name in set(reference) | set(item["inputs"]) if str(reference.get(name)) != str(item["inputs"].get(name))})
        if differing:
            findings.append(_finding("BLOCKED", "WINDOWS_INPUTS_DIFFER", f"The reports ran with different inputs: {', '.join(differing)}. A window check needs the same fixed settings."))
    else:
        findings.append(_finding("NOTE", "WINDOWS_INPUTS_UNREAD", "The inputs could not be read from every report, so identical settings are not confirmed."))
    loaded.sort(key=lambda item: (item["period"][0] if item["period"] else item["first"].date(), item["ref"]))
    for earlier, later in zip(loaded, loaded[1:]):
        earlier_end = earlier["period"][1] if earlier["period"] else earlier["last"].date()
        later_start = later["period"][0] if later["period"] else later["first"].date()
        if later_start < earlier_end:
            findings.append(_finding("BLOCKED", "WINDOWS_OVERLAP", f"{_name(earlier)} and {_name(later)} overlap in time."))
        elif later_start > earlier_end:
            findings.append(_finding("NOTE", "WINDOWS_GAP", f"There is a gap between {_name(earlier)} (to {earlier_end.isoformat()}) and {_name(later)} (from {later_start.isoformat()})."))
    if any(item["severity"] == "BLOCKED" for item in findings):
        raise CoreError("E_WINDOWS_NOT_COMPARABLE", "These reports cannot be compared as windows of the same settings.", details={"findings": findings})
    windows = []
    for index, item in enumerate(loaded, start=1):
        start_text = item["period"][0].isoformat() if item["period"] else item["first"].date().isoformat()
        end_text = _day_before(item["period"][1]).isoformat() if item["period"] else item["last"].date().isoformat()
        windows.append(_window(index, start_text, end_text, item["points"], item["closes"], _equity_rows(root, item["ref"]), partial=False, source={"dataset_ref": item["ref"], "filename": _name(item)}))
    configuration = {"calculation_version": CALCULATION_VERSION, "mode": "SEPARATE", "dataset_refs": [item["ref"] for item in loaded], "min_trades": min_trades, "max_losing_windows": max_losing_windows}
    return _result(configuration, windows, findings, min_trades, max_losing_windows, dataset=loaded[0]["dataset"], notes=["Each report starts at its own deposit; windows are compared side by side, not chained."])


def render_windows_note(result: dict[str, Any], reason: str) -> dict[str, object]:
    summary = result["summary"]
    lines = [
        "### Windows checked (same settings over time)",
        "",
        f"- Mode: {'one report split into ' + str(result['configuration']['months']) + '-month windows' if result['configuration']['mode'] == 'SPLIT' else str(len(result['windows'])) + ' separate window reports'}",
        f"- Profitable windows: {summary['profitable']} of {summary['windows']}; worst window: {summary['worst']['label']} ({summary['worst']['net_pnl']} {result['currency'] or ''})",
        f"- Net P/L per window: min {summary['net_pnl_spread']['minimum']}, median {summary['net_pnl_spread']['median']}, max {summary['net_pnl_spread']['maximum']}",
        "- Your thresholds: " + (", ".join(item for item in [f"at least {result['configuration']['min_trades']} trades per window" if result["configuration"]["min_trades"] is not None else "", f"at most {result['configuration']['max_losing_windows']} losing windows" if result["configuration"]["max_losing_windows"] is not None else ""] if item) or "none set"),
        f"- Reason: {reason.strip() or '(none given)'}",
        f"- Calculation: `{result['calculation_version']}`, `{result['evaluation_id']}`",
    ]
    return {"record_id": result["evaluation_id"], "markdown": "\n".join(lines)}


def _window(index: int, start: str, end: str, points: list[dict[str, Any]], closes: list[dict[str, Any]], equity: list[dict[str, Any]] | None, partial: bool, source: dict[str, object]) -> dict[str, object]:
    values = [item["net_pnl"] for item in closes]
    metrics = series_metrics(points, values, [item["sequence"] for item in closes])
    close = metrics["close_event_metrics"]
    balance = metrics["balance_metrics"]
    wins = sum(1 for value in values if value > 0)
    equity_drawdown = None
    if equity:
        from .equity_log import equity_drawdown as drawdown_of

        equity_drawdown = _fmt(drawdown_of(equity)["maximum"])
    return {
        "index": index, "label": f"{start} – {end}", "start": start, "end": end, "partial": partial, "source": source,
        "trades": close["close_event_count"], "net_pnl": close["net_pnl"], "profit_factor": close["profit_factor"], "profit_factor_reason": close["profit_factor_reason"],
        "win_rate_percent": _q(Decimal(wins) / Decimal(len(values)) * _HUNDRED) if values else None, "expectancy": close["expectancy"], "sqn": close["sqn"],
        "maximum_drawdown": balance["maximum_drawdown"], "maximum_drawdown_percent": balance["maximum_drawdown_percent"],
        "equity_maximum_drawdown": equity_drawdown,
    }


def _result(configuration: dict[str, object], windows: list[dict[str, Any]], findings: list[dict[str, object]], min_trades: int | None, max_losing: int | None, dataset: dict[str, Any], notes: list[str]) -> dict[str, object]:
    for name, value in (("min_trades", min_trades), ("max_losing_windows", max_losing)):
        if value is not None and (isinstance(value, bool) or not isinstance(value, int) or value < 0):
            raise CoreError("E_REQUEST_INVALID", f"{name} must be a whole number of at least 0.")
    for window in windows:
        net = Decimal(window["net_pnl"])
        window["losing"] = net < 0
        window["below_min_trades"] = min_trades is not None and window["trades"] < min_trades
    counted = [window for window in windows if window["trades"] > 0]
    nets = sorted(Decimal(window["net_pnl"]) for window in windows)
    losing = sum(1 for window in windows if window["losing"])
    worst = min(windows, key=lambda window: (Decimal(window["net_pnl"]), window["index"]))
    configuration_hash = sha256(json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest().upper()
    currency = close_event_summary(dataset)[0].get("currency")
    return {
        "calculation_version": CALCULATION_VERSION,
        "evaluation_id": stable_uuid("windows-evaluation", configuration_hash),
        "configuration": configuration,
        "currency": currency,
        "windows": windows,
        "summary": {
            "windows": len(windows),
            "with_trades": len(counted),
            "profitable": sum(1 for window in windows if Decimal(window["net_pnl"]) > 0),
            "losing": losing,
            "worst": {"index": worst["index"], "label": worst["label"], "net_pnl": worst["net_pnl"]},
            "net_pnl_spread": {"minimum": _fmt(nets[0]), "median": _fmt(nets[(len(nets) + 1) // 2 - 1]), "maximum": _fmt(nets[-1])},  # nearest rank
            "within_losing_allowance": None if max_losing is None else losing <= max_losing,
            "below_min_trades": [window["index"] for window in windows if window["below_min_trades"]],
        },
        "findings": findings,
        "notes": notes + ["Thresholds are your own; TRL sets no default. Source for the method: fixed-parameter walk forward (TRL playbook §5)."],
    }


def _closes(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    _, rows = close_event_summary(dataset)
    return [{"moment": datetime.fromisoformat(str(row["timestamp"])), "net_pnl": Decimal(str(row["net_pnl"])), "sequence": int(row["source_sequence"])} for row in rows]


def _equity_rows(root: Path, dataset_ref: str) -> list[dict[str, Any]] | None:
    from .intake import get_evidence

    evidence = get_evidence(root, dataset_ref)
    equity = evidence.get("equity")
    if not isinstance(equity, dict) or equity.get("status") != "LINKED_VERIFIED":
        return None
    import pyarrow.parquet as pq

    target = root / "datasets" / str(evidence["source_sha256"]) / "equity" / str(equity["log_sha256"])
    rows = pq.read_table(target / "equity.parquet").to_pylist()
    return [{key: (Decimal(value) if key in {"balance", "equity_close", "equity_min", "equity_max"} else value) for key, value in row.items()} for row in rows]


def _period(text: object) -> tuple[date, date] | None:
    """MT5 'H1 (2024.01.01 - 2024.12.31)': the end date is exclusive in MT5 (testing stops before it)."""

    import re

    match = re.search(r"\((\d{4})\.(\d{2})\.(\d{2})\s*-\s*(\d{4})\.(\d{2})\.(\d{2})\)", str(text or ""))
    if not match:
        return None
    values = [int(part) for part in match.groups()]
    return date(values[0], values[1], values[2]), date(values[3], values[4], values[5])


def _parse_date(text: str) -> date:
    try:
        return date.fromisoformat(str(text).replace(".", "-"))
    except ValueError as error:
        raise CoreError("E_REQUEST_INVALID", "The first window's start must be a date such as 2024-01-01.") from error


def _add_months(day: date, months: int) -> date:
    month_index = day.month - 1 + months
    return date(day.year + month_index // 12, month_index % 12 + 1, 1)


def _day_before(day: date) -> date:
    return date.fromordinal(day.toordinal() - 1)


def _name(item: dict[str, Any]) -> str:
    source = item["dataset"]["metadata"].get("source") or {}
    return str(source.get("filename") or item["ref"])


def _finding(severity: str, code: str, message: str) -> dict[str, object]:
    return {"severity": severity, "code": code, "message": message}


def _q(value: Decimal) -> str:
    return format(value.quantize(_STEP, rounding=ROUND_HALF_EVEN), "f")


def _fmt(value: Decimal) -> str:
    return format(value, "f")
