"""Combined equity of several tracks from their TRL equity logs (PROPOSAL_EQUITY_PORTFOLIO.md E1-E6).

Each report's attached log (EQUITY_LOGGER_SPEC.md) gives, per interval row:
close, low, high, balance, and peak margin. Tracks are combined on a common
grid (the coarsest log interval). Within one grid interval the tracks' lows
happened at unknown moments, so the combined equity drawdown is bounded:

- conservative (upper bound): the peak of earlier intervals' summed highs, or
  the previous combined close, down to the SUM of the tracks' lows, as if every
  low coincided;
- observed (lower bound): the peak of earlier combined closes down to the lower
  of the combined close and, for each track i, low_i + sum of the others'
  highs (at the moment i hit its low the others were at most at their highs).

The true combined drawdown lies between. As in TRL's single-log equity
drawdown, a peak and a trough inside the same interval are not combined.
Margin level follows MT5 (equity / margin x 100) with summed peak margins and
the conservative low. Separate backtests never shared one account: no stop-out
or margin call is simulated. Lots are as reported.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_EVEN
import re
from pathlib import Path
from typing import Any

from .dataset_store import read_dataset
from .errors import CoreError
from .identities import stable_uuid
from .portfolio_lab import MAX_TRACKS, WINDOWS, _capital, track_id
from .portfolio_preflight import preflight_datasets


CALCULATION_VERSION = "portfolio-equity-1"
MAX_CHART_POINTS = 600
_STEP = Decimal("0.00000001")
_ZERO = Decimal("0")
_EPOCH = datetime(1970, 1, 1)
_INTERVAL = re.compile(r"^(M|H|D)(\d+)$")
_SECONDS = {"M": 60, "H": 3600, "D": 86400}


def _q(value: Decimal) -> str:
    return format(value.quantize(_STEP, rounding=ROUND_HALF_EVEN), "f")


def _fmt(value: Decimal) -> str:
    return format(value, "f")


def interval_seconds(label: object) -> int:
    match = _INTERVAL.match(str(label or ""))
    if not match:
        raise CoreError("E_PORTFOLIO_EQUITY_INTERVAL", f"The equity log interval '{label}' is not supported (use minutes, hours, or D1).")
    return int(match.group(2)) * _SECONDS[match.group(1)]


def _log_rows(root: Path, dataset_ref: str) -> tuple[list[dict[str, Any]] | None, dict[str, Any]]:
    from .equity_log import _bounded, _typed
    from .intake import get_evidence

    evidence = get_evidence(root, dataset_ref)
    equity = evidence.get("equity")
    if not isinstance(equity, dict) or equity.get("status") != "LINKED_VERIFIED":
        return None, evidence
    import pyarrow.parquet as pq
    target = _bounded(root, "datasets", str(evidence["source_sha256"]), "equity", str(equity["log_sha256"]))
    rows = [_typed(row) for row in pq.read_table(target / "equity.parquet").to_pylist()]
    return rows, evidence


def _company(root: Path, dataset_ref: str) -> str | None:
    dataset = read_dataset(root, dataset_ref)
    metadata = dataset.get("metadata") if isinstance(dataset.get("metadata"), dict) else {}
    settings = (metadata or {}).get("settings") or dataset.get("settings") or {}
    value = settings.get("Company") if isinstance(settings, dict) else None
    return str(value).strip() or None if value is not None else None


def _bucket(moment: str, step: int) -> int:
    return int((datetime.fromisoformat(moment) - _EPOCH).total_seconds()) // step


def _bucket_start(index: int, step: int) -> datetime:
    return _EPOCH + timedelta(seconds=index * step)


def _track_buckets(rows: list[dict[str, Any]], step: int) -> dict[int, dict[str, Decimal]]:
    """Per grid interval: last close and balance, lowest low, highest high, highest margin."""
    buckets: dict[int, dict[str, Decimal]] = {}
    for row in rows:
        index = _bucket(row["time"], step)
        entry = buckets.get(index)
        if entry is None:
            buckets[index] = {"close": row["equity_close"], "balance": row["balance"], "low": row["equity_min"], "high": row["equity_max"], "margin": row["margin_max"]}
        else:
            entry["close"], entry["balance"] = row["equity_close"], row["balance"]
            entry["low"] = min(entry["low"], row["equity_min"])
            entry["high"] = max(entry["high"], row["equity_max"])
            entry["margin"] = max(entry["margin"], row["margin_max"])
    return buckets


def combined_series(tracks: list[dict[str, Any]], capital: Decimal, first: int, last: int) -> list[dict[str, Any]]:
    """Combine per-track buckets over [first, last] with carry-forward; each track contributes its change from its deposit."""
    state = [{"close": track["deposit"], "balance": track["deposit"]} for track in tracks]
    series: list[dict[str, Any]] = []
    for index in range(first, last + 1):
        closes, lows, highs, balances, margin = [], [], [], [], _ZERO
        for position, track in enumerate(tracks):
            previous = state[position]["close"]
            entry = track["buckets"].get(index)
            if entry is not None:
                low, high = min(previous, entry["low"]), max(previous, entry["high"])
                state[position] = {"close": entry["close"], "balance": entry["balance"]}
                margin += entry["margin"]
            else:
                low = high = previous
            deposit = track["deposit"]
            closes.append(state[position]["close"] - deposit)
            balances.append(state[position]["balance"] - deposit)
            lows.append(low - deposit)
            highs.append(high - deposit)
        total_high = sum(highs, _ZERO)
        observed_low = min(sum(closes, _ZERO), *(lows[i] + total_high - highs[i] for i in range(len(tracks))))
        series.append({
            "index": index,
            "close": capital + sum(closes, _ZERO),
            "balance": capital + sum(balances, _ZERO),
            "low_conservative": capital + sum(lows, _ZERO),
            "low_observed": capital + observed_low,
            "high": capital + total_high,
            "margin": margin,
        })
    return series


def drawdown_range(series: list[dict[str, Any]], capital: Decimal) -> dict[str, Any]:
    """Observed (lower bound) and conservative (upper bound) maximum drawdown; peaks from earlier intervals only."""
    close_peak = high_peak = capital
    observed = conservative = _ZERO
    observed_at = conservative_at = None
    previous_close = capital
    for point in series:
        lower = close_peak - point["low_observed"]
        upper = max(high_peak, previous_close) - point["low_conservative"]
        if lower > observed:
            observed, observed_at = lower, point["index"]
        if upper > conservative:
            conservative, conservative_at = upper, point["index"]
        close_peak = max(close_peak, point["close"])
        high_peak = max(high_peak, point["high"])
        previous_close = point["close"]
    return {"observed": observed, "conservative": max(conservative, observed), "observed_at": observed_at, "conservative_at": conservative_at}


def _chart(series: list[dict[str, Any]], step: int) -> list[dict[str, str]]:
    chunk = max(1, -(-len(series) // MAX_CHART_POINTS))
    points = []
    for start in range(0, len(series), chunk):
        part = series[start:start + chunk]
        points.append({
            "time": _bucket_start(part[0]["index"], step).isoformat(),
            "close": _fmt(part[-1]["close"]),
            "balance": _fmt(part[-1]["balance"]),
            "low_conservative": _fmt(min(point["low_conservative"] for point in part)),
            "low_observed": _fmt(min(point["low_observed"] for point in part)),
        })
    return points


def combine_equity(workspace_root: Path, tracks: list[list[str]], starting_capital: str, window: str = "UNION", stop_out_level: str | None = None) -> dict[str, object]:
    capital = _capital(starting_capital)
    if not 1 <= len(tracks) <= MAX_TRACKS or any(not refs for refs in tracks):
        raise CoreError("E_PORTFOLIO_CONFIG_INVALID", f"Choose 1 to {MAX_TRACKS} tracks, each with at least one report.")
    if window not in WINDOWS:
        raise CoreError("E_PORTFOLIO_CONFIG_INVALID", "window must be UNION or COMMON.")
    stop_out: Decimal | None = None
    if stop_out_level is not None:
        try:
            stop_out = Decimal(stop_out_level.strip())
        except Exception as error:
            raise CoreError("E_PORTFOLIO_CONFIG_INVALID", "stop_out_level must be a positive percentage.") from error
        if not stop_out.is_finite() or stop_out <= 0:
            raise CoreError("E_PORTFOLIO_CONFIG_INVALID", "stop_out_level must be a positive percentage.")
    root = workspace_root.resolve()

    loaded: list[dict[str, Any]] = []
    missing: list[dict[str, str]] = []
    companies: set[str] = set()
    unknown_company = False
    for index, refs in enumerate(tracks):
        if len(refs) > 1:
            preflight = preflight_datasets(root, refs)
            if preflight["status"] != "ELIGIBLE":
                raise CoreError("E_PORTFOLIO_TRACK_INVALID", f"Track {index + 1} is not a valid consecutive chain of reports.", details={"track_index": index})
            refs = [str(member["dataset_ref"]) for member in preflight["members"]]
        rows: list[dict[str, Any]] = []
        intervals: set[int] = set()
        currencies: set[str] = set()
        for dataset_ref in refs:
            log, evidence = _log_rows(root, dataset_ref)
            if log is None:
                missing.append({"track": str(index + 1), "dataset_ref": dataset_ref, "filename": str(evidence.get("original_filename", dataset_ref))})
                continue
            rows.extend(log)
            intervals.add(interval_seconds(evidence["equity"].get("interval")))
            currencies.add(str((evidence.get("supplied_facts") or {}).get("currency")))
            company = _company(root, dataset_ref)
            if company is None:
                unknown_company = True
            else:
                companies.add(company)
        loaded.append({"index": index, "refs": refs, "rows": sorted(rows, key=lambda row: row["time"]), "intervals": intervals, "currencies": currencies})

    configuration = {"calculation_version": CALCULATION_VERSION, "track_ids": [track_id(track["refs"]) for track in loaded], "starting_capital": _fmt(capital),
                     "window": window, "sizing": "AS_REPORTED", "stop_out_level": None if stop_out is None else _fmt(stop_out)}
    base = {"calculation_version": CALCULATION_VERSION, "configuration": configuration}
    if missing:
        return {**base, "status": "MISSING_LOGS", "missing": missing}
    currencies = set().union(*(track["currencies"] for track in loaded))
    if len(currencies) != 1:
        raise CoreError("E_PORTFOLIO_CURRENCY_MISMATCH", "The tracks use different account currencies.")

    step = max(max(track["intervals"]) for track in loaded)
    for track in loaded:
        track["deposit"] = track["rows"][0]["balance"]
        track["buckets"] = _track_buckets(track["rows"], step)
        track["first"], track["last"] = min(track["buckets"]), max(track["buckets"])
    if window == "UNION":
        first, last = min(track["first"] for track in loaded), max(track["last"] for track in loaded)
    else:
        first, last = max(track["first"] for track in loaded), min(track["last"] for track in loaded)
        if first > last:
            raise CoreError("E_PORTFOLIO_NO_COMMON_WINDOW", "The equity logs have no period in which all tracks were active; use the union window.")
    if window == "COMMON":
        for track in loaded:  # start every track from its equity at the window start
            before = [index for index in track["buckets"] if index < first]
            if before:
                track["deposit"] = track["buckets"][max(before)]["close"]
            track["buckets"] = {index: entry for index, entry in track["buckets"].items() if first <= index <= last}

    series = combined_series(loaded, capital, first, last)
    combined = drawdown_range(series, capital)
    own = []
    for track in loaded:
        alone = combined_series([track], capital, first, last)
        own.append({"track": track["index"] + 1, "track_id": track_id(track["refs"]), "drawdown": drawdown_range(alone, capital)})
    realised_peak, realised = capital, _ZERO
    for point in series:
        realised_peak = max(realised_peak, point["balance"])
        realised = max(realised, realised_peak - point["balance"])

    days: dict[str, dict[str, Any]] = {}
    previous = {"close": capital, "balance": capital}
    for point in series:
        day = _bucket_start(point["index"], step).date().isoformat()
        entry = days.get(day)
        if entry is None:
            entry = days[day] = {"date": day, "reference": max(previous["close"], previous["balance"]), "observed": point["low_observed"], "conservative": point["low_conservative"]}
        entry["observed"] = min(entry["observed"], point["low_observed"])
        entry["conservative"] = min(entry["conservative"], point["low_conservative"])
        previous = point
    daily = [{"date": item["date"], "start_of_day_reference": _fmt(item["reference"]), "loss_observed": _fmt(max(_ZERO, item["reference"] - item["observed"])),
              "loss_conservative": _fmt(max(_ZERO, item["reference"] - item["conservative"]))} for item in days.values()]
    worst_day = max(daily, key=lambda item: Decimal(item["loss_conservative"])) if daily else None

    levels = [(point["low_conservative"] / point["margin"] * 100, point) for point in series if point["margin"] > 0]
    lowest_level = min(levels, key=lambda item: item[0]) if levels else None
    below = sum(1 for level, _point in levels if stop_out is not None and level < stop_out)
    own_conservative = [Decimal(item["drawdown"]["conservative"]) for item in own]

    findings: list[dict[str, str]] = []
    if len(companies) > 1:
        findings.append({"severity": "WARNING", "code": "DIFFERENT_BROKERS", "message": "The reports come from different brokers (" + ", ".join(sorted(companies)) + "); their server clocks may differ, so the logs may not line up in time. TRL does not convert time zones."})
    elif unknown_company:
        findings.append({"severity": "NOTE", "code": "BROKER_UNKNOWN", "message": "Some reports do not state their broker, so TRL could not check that the logs share one server clock."})
    if len({interval for track in loaded for interval in track["intervals"]}) > 1:
        findings.append({"severity": "NOTE", "code": "MIXED_INTERVALS", "message": f"The logs use different intervals; they were combined on the coarsest ({step // 60} minutes)."})

    result = {
        **base,
        "status": "COMBINED",
        "evaluation_id": stable_uuid("portfolio-equity", CALCULATION_VERSION, *configuration["track_ids"], _fmt(capital), window, configuration["stop_out_level"] or "no-stop-out"),
        "currency": currencies.pop(),
        "grid_minutes": step // 60,
        "window_start": _bucket_start(first, step).isoformat(),
        "window_end": _bucket_start(last, step).isoformat(),
        "starting_capital": _fmt(capital),
        "final_equity": _fmt(series[-1]["close"]),
        "equity_drawdown": {"observed": _fmt(combined["observed"]), "conservative": _fmt(combined["conservative"]),
                            "observed_at": None if combined["observed_at"] is None else _bucket_start(combined["observed_at"], step).isoformat(),
                            "conservative_at": None if combined["conservative_at"] is None else _bucket_start(combined["conservative_at"], step).isoformat()},
        "realised_drawdown": _fmt(realised),
        "tracks": [{"track": item["track"], "track_id": item["track_id"], "equity_drawdown": {"observed": _fmt(item["drawdown"]["observed"]), "conservative": _fmt(item["drawdown"]["conservative"])}} for item in own],
        "diversification": {"sum_of_tracks": _fmt(sum(own_conservative, _ZERO)), "worst_track": _fmt(max(own_conservative)), "combined_conservative": _fmt(combined["conservative"])},
        "daily": daily,
        "worst_day": worst_day,
        "margin": {
            "lowest_level_percent": None if lowest_level is None else _q(lowest_level[0]),
            "lowest_level_at": None if lowest_level is None else _bucket_start(lowest_level[1]["index"], step).isoformat(),
            "peak_margin": _fmt(max((point["margin"] for point in series), default=_ZERO)),
            "intervals_below_stop_out": None if stop_out is None else below,
        },
        "chart": _chart(series, step),
        "findings": findings,
        "warnings": [
            "Separate backtests never shared one account: no margin call or stop-out is simulated.",
            "The combined drawdown is a range: observed can miss a low; conservative assumes every track's low coincided.",
            "Lots are as reported; each track contributes its equity change from its own deposit.",
        ],
    }
    return result


def equity_combination_note(result: dict[str, object], labels: list[str], reason: str) -> dict[str, str]:
    """Markdown for "Combined equity checked" in an Experiment note (E7)."""
    if result.get("status") != "COMBINED":
        raise CoreError("E_PORTFOLIO_EQUITY_UNAVAILABLE", "Every report in the tracks needs an equity log before the combined equity can be recorded.")
    currency = result["currency"]
    drawdown, diversification, margin = result["equity_drawdown"], result["diversification"], result["margin"]
    lines = [
        "### Combined equity checked",
        "",
        f"- Tracks: {', '.join(labels) if labels else len(result['tracks'])}; starting capital {result['starting_capital']} {currency}; {result['window_start'][:10]} to {result['window_end'][:10]}; {result['grid_minutes']}-minute grid",
        f"- Combined equity drawdown: between {drawdown['observed']} and {drawdown['conservative']} {currency} (observed to conservative); realised drawdown {result['realised_drawdown']} {currency}",
        f"- Diversification: combined {diversification['combined_conservative']} {currency} against the sum of the tracks {diversification['sum_of_tracks']} and the worst single track {diversification['worst_track']} {currency}",
    ]
    if result["worst_day"]:
        day = result["worst_day"]
        lines.append(f"- Worst day {day['date']}: {day['loss_observed']} to {day['loss_conservative']} {currency} below the start of the day")
    if margin["lowest_level_percent"] is not None:
        lines.append(f"- Lowest combined margin level: {margin['lowest_level_percent']} %" + ("" if margin["intervals_below_stop_out"] is None else f"; intervals below your stop-out level: {margin['intervals_below_stop_out']}"))
    lines += [
        "- Separate backtests never shared one account: no margin call or stop-out was simulated.",
        f"- Your conclusion: {reason.strip() or '(none given)'}",
        f"- Calculation: `{result['calculation_version']}`, `{result['evaluation_id']}`",
    ]
    return {"record_id": str(result["evaluation_id"]), "markdown": "\n".join(lines)}
