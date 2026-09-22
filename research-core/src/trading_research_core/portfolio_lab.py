"""Portfolio Lab v1 combination engine (internal/docs/PORTFOLIO_LAB_SPEC.md).

Combines verified close events of several strategy tracks as if they had traded
concurrently on one account with a user-declared starting capital. Lots are as
reported; there is no rescaling, weighting, margin, or equity simulation. The
result is realised balance only. Nothing is ranked or selected.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_EVEN
from hashlib import sha256
import json
from pathlib import Path
from typing import Any

from .dataset_store import read_dataset
from .errors import CoreError
from .identities import stable_uuid
from .performance_metrics import series_metrics
from .portfolio_preflight import preflight_datasets
from .trade_analysis import close_event_summary


TRACK_VERSION = "portfolio-track-1"
CALCULATION_VERSION = "mvp-portfolio-combine-1"
MAX_TRACKS = 10
WINDOWS = {"UNION", "COMMON"}
DAY_BOUNDARIES = {"REPORT_CLOCK_MIDNIGHT"}
MIN_CORRELATION_DAYS = 10
_STEP = Decimal("0.00000001")
_ZERO = Decimal("0")


def combine(workspace_root: Path, tracks: list[list[str]], starting_capital: str, window: str = "UNION", day_boundary: str = "REPORT_CLOCK_MIDNIGHT") -> dict[str, object]:
    """Return the combined realised-balance result for the given tracks."""

    capital = _capital(starting_capital)
    _validate(tracks, window, day_boundary)
    loaded = [_load_track(workspace_root, refs, index) for index, refs in enumerate(tracks)]
    _check_currency(loaded)
    _check_duplicates(loaded)
    start, end = _window(loaded, window)
    for track in loaded:
        track["in_window"] = [event for event in track["events"] if start <= event["moment"] <= end]

    merged = sorted(
        (event for track in loaded for event in track["in_window"]),
        key=lambda event: (event["moment"], event["track_index"], event["order"]),
    )
    points = _balance_path(capital, start, merged)
    metrics = series_metrics(points, [event["net_pnl"] for event in merged], [point["source_sequence"] for point in points[1:]])
    combined_mdd = Decimal(str(metrics["balance_metrics"]["maximum_drawdown"]))
    combined_net = sum((event["net_pnl"] for event in merged), _ZERO)

    track_results = []
    standalone_total = _ZERO
    for track in loaded:
        own_points = _balance_path(capital, start, track["in_window"])
        own = series_metrics(own_points, [event["net_pnl"] for event in track["in_window"]], [point["source_sequence"] for point in own_points[1:]])
        own_mdd = Decimal(str(own["balance_metrics"]["maximum_drawdown"]))
        standalone_total += own_mdd
        net = sum((event["net_pnl"] for event in track["in_window"]), _ZERO)
        track_results.append({
            "track_id": track["track_id"],
            "index": track["index"],
            "dataset_refs": track["dataset_refs"],
            "filenames": track["filenames"],
            "currency": track["currency"],
            "active_start": track["start_text"],
            "active_end": track["end_text"],
            "close_events_in_window": len(track["in_window"]),
            "net_pnl": _fmt(net),
            "share_of_combined_net_percent": None if combined_net == 0 else _q(net / combined_net * Decimal(100)),
            "standalone_maximum_drawdown": _fmt(own_mdd),
            "standalone_metrics": own["close_event_metrics"] | {"maximum_drawdown_percent": own["balance_metrics"]["maximum_drawdown_percent"], "return_to_drawdown": own["balance_metrics"]["return_to_drawdown"]},
        })

    configuration = {
        "calculation_version": CALCULATION_VERSION,
        "track_ids": [track["track_id"] for track in loaded],
        "starting_capital": _fmt(capital),
        "starting_capital_source": "USER_SUPPLIED",
        "window": window,
        "day_boundary": day_boundary,
        "sizing": "AS_REPORTED",
        "merge_order": "timestamp, then track order, then source order",
    }
    configuration_hash = _hash(configuration)
    return {
        "combination_id": stable_uuid("portfolio-combination", configuration_hash),
        "calculation_version": CALCULATION_VERSION,
        "analysis_basis": "COMBINED_REALISED_BALANCE_AS_REPORTED",
        "configuration": configuration,
        "configuration_hash": configuration_hash,
        "currency": loaded[0]["currency"],
        "window_start": _iso(start),
        "window_end": _iso(end),
        "close_event_count": len(merged),
        "net_pnl": _fmt(combined_net),
        "combined_balance": [{"index": point["source_sequence"], "timestamp": point["timestamp"], "balance": _fmt(point["balance"]), "track_index": point.get("track_index")} for point in points],
        "metrics": {"balance_metrics": metrics["balance_metrics"], "stagnation": metrics["stagnation"], "close_event_metrics": metrics["close_event_metrics"]},
        "drawdown_series": metrics["drawdown_series"],
        "tracks": track_results,
        "drawdown_overlap": {"combined_maximum_drawdown": _fmt(combined_mdd), "sum_of_standalone_maximum_drawdowns": _fmt(standalone_total), "offset": _fmt(standalone_total - combined_mdd)},
        "correlation": _correlations(loaded),
        "daily": [{"date": date, "net_pnl": _fmt(value), "close_event_count": count} for date, (value, count) in sorted(_daily(merged).items())],
        "active_tracks": [{"index": track["index"], "track_id": track["track_id"], "start": track["start_text"], "end": track["end_text"]} for track in loaded],
        "warnings": [
            "Combined result is realised balance from verified close events only; intratrade equity and floating drawdown are unavailable.",
            "Lots are as reported in each backtest. Each backtest ran on its own balance, so compounding and margin interaction between EAs are not modelled.",
            "Tracks on the same symbol are usually highly correlated; check the correlation matrix.",
            "Starting capital is user-supplied.",
        ],
    }


def track_id(dataset_refs: list[str]) -> str:
    return stable_uuid("portfolio-track", *dataset_refs, TRACK_VERSION)


def _capital(value: str) -> Decimal:
    try:
        capital = Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as error:
        raise CoreError("E_PORTFOLIO_CONFIG_INVALID", "starting_capital must be a positive decimal amount.") from error
    if not capital.is_finite() or capital <= 0:
        raise CoreError("E_PORTFOLIO_CONFIG_INVALID", "starting_capital must be a positive decimal amount.")
    return capital


def _validate(tracks: list[list[str]], window: str, day_boundary: str) -> None:
    if not isinstance(tracks, list) or not 1 <= len(tracks) <= MAX_TRACKS:
        raise CoreError("E_PORTFOLIO_CONFIG_INVALID", f"A combination needs 1 to {MAX_TRACKS} tracks.")
    if any(not isinstance(refs, list) or not refs or not all(isinstance(ref, str) and ref for ref in refs) for refs in tracks):
        raise CoreError("E_PORTFOLIO_CONFIG_INVALID", "Each track must be a non-empty list of dataset references.")
    flat = [ref for refs in tracks for ref in refs]
    if len(set(flat)) != len(flat):
        raise CoreError("E_PORTFOLIO_CONFIG_INVALID", "A report may appear in only one track of a combination.")
    if window not in WINDOWS:
        raise CoreError("E_PORTFOLIO_CONFIG_INVALID", "window must be UNION or COMMON.")
    if day_boundary not in DAY_BOUNDARIES:
        raise CoreError("E_PORTFOLIO_CONFIG_INVALID", "day_boundary must be REPORT_CLOCK_MIDNIGHT in v1.")


def _load_track(workspace_root: Path, refs: list[str], index: int) -> dict[str, Any]:
    if len(refs) > 1:
        preflight = preflight_datasets(workspace_root, refs)
        if preflight["status"] != "ELIGIBLE":
            raise CoreError("E_PORTFOLIO_TRACK_INVALID", f"Track {index + 1} is not a valid consecutive chain of reports.", details={"track_index": index, "findings": preflight["findings"]})
        refs = [str(member["dataset_ref"]) for member in preflight["members"]]
    events: list[dict[str, Any]] = []
    filenames: list[str] = []
    currencies: set[Any] = set()
    first: datetime | None = None
    last: datetime | None = None
    for dataset_ref in refs:
        dataset = read_dataset(workspace_root, dataset_ref)
        summary, rows = close_event_summary(dataset)
        currencies.add(summary.get("currency"))
        metadata = dataset.get("metadata", {})
        filenames.append(str(metadata.get("source", {}).get("filename", dataset_ref)) if isinstance(metadata, dict) else dataset_ref)
        ordered = sorted(dataset["events"], key=lambda event: int(event["source_sequence"]))
        span_first, span_last = _moment(ordered[0]["source_timestamp"]), _moment(ordered[-1]["source_timestamp"])
        first = span_first if first is None or span_first < first else first
        last = span_last if last is None or span_last > last else last
        for row in rows:
            events.append({
                "track_index": index,
                "order": len(events),
                "moment": _moment(row["timestamp"]),
                "timestamp": str(row["timestamp"]),
                "deal": str(row["source_deal_id"]),
                "symbol": str(row["symbol"]),
                "net_pnl": Decimal(str(row["net_pnl"])),
            })
    if len(currencies) != 1:
        raise CoreError("E_PORTFOLIO_CURRENCY_MISMATCH", f"Track {index + 1} mixes currencies.", details={"track_index": index})
    assert first is not None and last is not None
    return {"index": index, "track_id": track_id(refs), "dataset_refs": refs, "filenames": filenames, "currency": currencies.pop(), "events": events, "start": first, "end": last, "start_text": _iso(first), "end_text": _iso(last)}


def _check_currency(tracks: list[dict[str, Any]]) -> None:
    currencies = {track["currency"] for track in tracks}
    if len(currencies) != 1 or None in currencies:
        raise CoreError("E_PORTFOLIO_CURRENCY_MISMATCH", "All tracks must share one known source currency; no conversion is performed.", details={"currencies": sorted(str(currency) for currency in currencies)})


def _check_duplicates(tracks: list[dict[str, Any]]) -> None:
    seen: dict[tuple[str, str, str, Decimal], int] = {}
    for track in tracks:
        for event in track["events"]:
            key = (event["timestamp"], event["deal"], event["symbol"], event["net_pnl"])
            other = seen.get(key)
            if other is not None and other != track["index"]:
                raise CoreError("E_PORTFOLIO_DUPLICATE_EVENTS", f"Tracks {other + 1} and {track['index'] + 1} contain identical close events; the same backtest may have been added twice.", details={"track_indices": [other, track["index"]], "filenames": [tracks[other]["filenames"], track["filenames"]]})
            seen.setdefault(key, track["index"])


def _window(tracks: list[dict[str, Any]], window: str) -> tuple[datetime, datetime]:
    if window == "UNION":
        return min(track["start"] for track in tracks), max(track["end"] for track in tracks)
    start, end = max(track["start"] for track in tracks), min(track["end"] for track in tracks)
    if start > end:
        raise CoreError("E_PORTFOLIO_NO_COMMON_WINDOW", "The selected tracks have no period in which all of them were active; use the union window.")
    return start, end


def _balance_path(capital: Decimal, start: datetime, events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    points: list[dict[str, Any]] = [{"source_sequence": 0, "timestamp": _iso(start), "moment": start, "balance": capital, "is_close": False, "track_index": None}]
    balance = capital
    for number, event in enumerate(events, start=1):
        balance += event["net_pnl"]
        points.append({"source_sequence": number, "timestamp": event["timestamp"], "moment": event["moment"], "balance": balance, "is_close": True, "track_index": event["track_index"]})
    return points


def _daily(events: list[dict[str, Any]]) -> dict[str, tuple[Decimal, int]]:
    days: dict[str, tuple[Decimal, int]] = {}
    for event in events:
        key = event["moment"].date().isoformat()
        value, count = days.get(key, (_ZERO, 0))
        days[key] = (value + event["net_pnl"], count + 1)
    return days


def _correlations(tracks: list[dict[str, Any]]) -> list[dict[str, object]]:
    daily = [{date: value for date, (value, _) in _daily(track["in_window"]).items()} for track in tracks]
    pairs = []
    for left in range(len(tracks)):
        for right in range(left + 1, len(tracks)):
            days = sorted(set(daily[left]) | set(daily[right]))
            xs = [daily[left].get(day, _ZERO) for day in days]
            ys = [daily[right].get(day, _ZERO) for day in days]
            value, reason = _pearson(xs, ys) if len(days) >= MIN_CORRELATION_DAYS else (None, "INSUFFICIENT_DAYS")
            pairs.append({"left_index": left, "right_index": right, "days": len(days), "pearson": value, "reason": reason})
    return pairs


def _pearson(xs: list[Decimal], ys: list[Decimal]) -> tuple[str | None, str | None]:
    count = Decimal(len(xs))
    mean_x, mean_y = sum(xs, _ZERO) / count, sum(ys, _ZERO) / count
    covariance = sum(((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys)), _ZERO)
    variance_x = sum(((x - mean_x) ** 2 for x in xs), _ZERO)
    variance_y = sum(((y - mean_y) ** 2 for y in ys), _ZERO)
    if variance_x == 0 or variance_y == 0:
        return None, "ZERO_VARIANCE"
    return _q(covariance / (variance_x.sqrt() * variance_y.sqrt())), None


def _moment(value: object) -> datetime:
    try:
        return datetime.fromisoformat(str(value))
    except ValueError as error:
        raise CoreError("E_DATASET_INVALID", "Portfolio Lab requires ISO source timestamps.") from error


def _iso(moment: datetime) -> str:
    return moment.isoformat()


def _q(value: Decimal) -> str:
    return format(value.quantize(_STEP, rounding=ROUND_HALF_EVEN), "f")


def _fmt(value: Decimal) -> str:
    return format(value, "f")


def _hash(configuration: dict[str, object]) -> str:
    return sha256(json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest().upper()
