"""MT5 tester equity evidence (PL-006, EQUITY_LOGGER_SPEC.md E1–E7).

Imports a `trl-equity-log-1` CSV written by `TRL_EquityLogger.mqh`, proves
it belongs to an imported MT5 report (metadata plus the balance after every
logged deal count, plus the final balance), cross-checks its equity drawdown
against MT5's reported "Equity Drawdown Maximal", and stores the series as
`MT5_TESTER_LOGGED` equity next to the report. Nothing is inferred from
balance: without a linked log, equity stays UNAVAILABLE.
"""

from __future__ import annotations

from datetime import datetime
from decimal import ROUND_HALF_EVEN, Decimal, InvalidOperation
from hashlib import sha256
import json
import os
from pathlib import Path
import re
from tempfile import NamedTemporaryFile
from typing import Any

from .dataset_store import read_dataset
from .day_boundary import DayBoundary
from .errors import CoreError


FORMAT = "trl-equity-log-1"
ADAPTER_VERSION = "mt5-equity-log-adapter-1"
METRICS_VERSION = "mvp-equity-metrics-2"
COLUMNS = ["kind", "time", "balance", "equity_close", "equity_min", "equity_min_time", "equity_max", "margin_max", "positions_max", "deals_total"]
KINDS = {"START", "INTERVAL", "BALANCE", "END"}
MAX_LOG_BYTES = 500 * 1024 * 1024
_STEP = Decimal("0.00000001")
_CENT = Decimal("0.01")
_LEADING_NUMBER = re.compile(r"^\s*(-?[\d\s ]+(?:\.\d+)?)")


def attach_equity_log(workspace_root: Path, dataset_ref: str, source_path: str, modelling_mode: str) -> dict[str, object]:
    """Snapshot, parse, link, and cross-check one equity log for one report."""

    from .intake import get_evidence, set_equity_evidence

    root = workspace_root.resolve()
    mode = str(modelling_mode).strip()
    if not mode:
        raise CoreError("E_REQUEST_INVALID", "Declare the modelling mode the test used (MT5 does not record it in the log).")
    evidence = get_evidence(root, dataset_ref)
    source = Path(source_path).expanduser().resolve()
    if not source.is_file() or source.suffix.lower() != ".csv":
        raise CoreError("E_SOURCE_NOT_FOUND", "Select the TRL equity log (.csv) written by TRL_EquityLogger.")
    if source.stat().st_size > MAX_LOG_BYTES:
        raise CoreError("E_SOURCE_UNSUPPORTED", "The equity log is larger than TRL reads.")
    raw = source.read_bytes()
    log_hash = sha256(raw).hexdigest().upper()
    header, rows = parse_equity_log(raw)
    dataset = read_dataset(root, dataset_ref)
    settings = dict(dataset["metadata"].get("settings") or {})
    events = sorted(dataset["events"], key=lambda event: int(event["source_sequence"]))
    findings = _link(header, rows, settings, events)
    drawdown = equity_drawdown(rows)
    reported = _reported_equity_drawdown(Path(str(evidence["raw_snapshot_path"])))
    if reported is not None:
        difference = drawdown["maximum"] - reported
        tolerance = max(reported * Decimal("0.005"), _CENT)
        if difference > tolerance:
            # Observed on real runs: MT5's summary figure can miss tick lows the logger sees.
            findings.append(_finding("NOTE", "LOG_DEEPER_THAN_MT5", f"The log's maximum equity drawdown ({_fmt(drawdown['maximum'])}) is deeper than MT5's reported Equity Drawdown Maximal ({_fmt(reported)}) by {_fmt(difference)}. The logger checks every tick; TRL uses the log's (more conservative) figure."))
        elif -difference > tolerance:
            findings.append(_finding("WARNING", "EQUITY_DRAWDOWN_DIFFERS", f"The log's maximum equity drawdown ({_fmt(drawdown['maximum'])}) is shallower than MT5's reported Equity Drawdown Maximal ({_fmt(reported)}) by {_fmt(-difference)}, more than the {_fmt(tolerance.quantize(_CENT))} tolerance: the log may have missed a low. Check the interval and that it comes from this run."))
    else:
        findings.append(_finding("NOTE", "MT5_EQUITY_DRAWDOWN_UNAVAILABLE", "The report has no readable Equity Drawdown Maximal to cross-check against."))
    if not re.search(r"real ticks", mode, re.IGNORECASE):
        findings.append(_finding("NOTE", "SYNTHETIC_INTRABAR_PATH", f"Modelling mode '{mode}': the intrabar equity path is simulated, not real ticks, so intrabar lows are approximate."))
    status = "BLOCKED" if any(item["severity"] == "BLOCKED" for item in findings) else "LINKED_VERIFIED"
    result = {
        "dataset_ref": dataset_ref,
        "log_sha256": log_hash,
        "adapter_version": ADAPTER_VERSION,
        "status": status,
        "equity_source": "MT5_TESTER_LOGGED",
        "modelling_mode": mode,
        "modelling_mode_source": "USER_SUPPLIED",
        "header": header,
        "row_count": len(rows),
        "first_time": rows[0]["time"],
        "last_time": rows[-1]["time"],
        "maximum_equity_drawdown": _fmt(drawdown["maximum"]),
        "maximum_equity_drawdown_percent": None if drawdown["percent"] is None else _q(drawdown["percent"]),
        "mt5_reported_equity_drawdown": None if reported is None else _fmt(reported),
        "findings": findings,
    }
    if status != "LINKED_VERIFIED":
        return result
    source_hash = str(evidence["source_sha256"])
    snapshot_dir = _bounded(root, "raw", log_hash)
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    snapshot = snapshot_dir / "source.csv"
    if not snapshot.is_file():
        with NamedTemporaryFile(delete=False, dir=snapshot_dir, prefix="snapshot-", suffix=".tmp") as temporary:
            temporary.write(raw)
            temporary_path = Path(temporary.name)
        os.replace(temporary_path, snapshot)
    target = _bounded(root, "datasets", source_hash, "equity", log_hash)
    target.mkdir(parents=True, exist_ok=True)
    import pyarrow as pa
    import pyarrow.parquet as pq
    pq.write_table(pa.Table.from_pylist([{key: str(value) for key, value in row.items()} for row in rows]), target / "equity.parquet", compression="zstd", use_dictionary=False, write_statistics=True)
    manifest = {key: value for key, value in result.items() if key != "findings"} | {"findings": findings, "raw_snapshot_path": str(snapshot)}
    (target / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    set_equity_evidence(root, dataset_ref, {key: result[key] for key in ("log_sha256", "status", "equity_source", "modelling_mode", "row_count", "maximum_equity_drawdown", "mt5_reported_equity_drawdown")} | {"interval": header.get("interval"), "findings": [item["code"] for item in findings]})
    return result


def parse_equity_log(raw: bytes) -> tuple[dict[str, str], list[dict[str, Any]]]:
    """Header (`# key: value`) and typed rows of a trl-equity-log-1 file."""

    text = raw.decode("utf-8-sig", errors="strict") if not raw.startswith((b"\xff\xfe", b"\xfe\xff")) else raw.decode("utf-16")
    header: dict[str, str] = {}
    rows: list[dict[str, Any]] = []
    columns: list[str] | None = None
    for number, line in enumerate(text.splitlines(), start=1):
        line = line.strip()
        if not line:
            continue
        if line.startswith("#"):
            key, _, value = line[1:].partition(":")
            header[key.strip()] = value.strip()
            continue
        cells = [cell.strip() for cell in line.split(",")]
        if columns is None:
            columns = cells
            if columns != COLUMNS:
                raise CoreError("E_EQUITY_LOG_INVALID", "The equity log columns are not the trl-equity-log-1 layout.", details={"received": columns})
            continue
        if len(cells) != len(COLUMNS) or cells[0] not in KINDS:
            raise CoreError("E_EQUITY_LOG_INVALID", "An equity log row is malformed.", details={"line": number})
        try:
            row = {
                "kind": cells[0], "time": _time(cells[1]), "balance": Decimal(cells[2]), "equity_close": Decimal(cells[3]),
                "equity_min": Decimal(cells[4]), "equity_min_time": _time(cells[5]), "equity_max": Decimal(cells[6]),
                "margin_max": Decimal(cells[7]), "positions_max": int(cells[8]), "deals_total": int(cells[9]),
            }
        except (InvalidOperation, ValueError) as error:
            raise CoreError("E_EQUITY_LOG_INVALID", "An equity log row has an invalid value.", details={"line": number}) from error
        if row["equity_min"] > row["equity_max"] or rows and row["time"] < rows[-1]["time"]:
            raise CoreError("E_EQUITY_LOG_INVALID", "Equity log rows must be in time order with min <= max.", details={"line": number})
        rows.append(row)
    if header.get("format") != FORMAT:
        raise CoreError("E_EQUITY_LOG_INVALID", f"Not a {FORMAT} file (written by TRL_EquityLogger.mqh).", details={"format": header.get("format")})
    if not rows or rows[0]["kind"] != "START":
        raise CoreError("E_EQUITY_LOG_INVALID", "The equity log has no START row.")
    if rows[-1]["kind"] != "END":
        raise CoreError("E_EQUITY_LOG_INVALID", "The equity log has no END row; the test may not have finished or the file is truncated.")
    return header, rows


def equity_drawdown(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Largest fall from a prior equity peak to a later interval low (currency and % of that peak).

    The peak before each row uses earlier rows only, so a peak and trough in
    the same interval are not combined in an unknown order.
    """

    peak = rows[0]["equity_max"]
    maximum = Decimal(0)
    peak_at_maximum = peak
    for row in rows[1:]:
        fall = peak - row["equity_min"]
        if fall > maximum:
            maximum, peak_at_maximum = fall, peak
        peak = max(peak, row["equity_max"], row["equity_close"])
    return {"maximum": maximum, "percent": None if peak_at_maximum <= 0 else maximum / peak_at_maximum * 100}


def equity_metrics(workspace_root: Path, dataset_ref: str) -> dict[str, object]:
    """Equity series and daily equity loss (report clock, midnight) for a linked log."""

    from .intake import get_evidence

    root = workspace_root.resolve()
    evidence = get_evidence(root, dataset_ref)
    equity = evidence.get("equity")
    if not isinstance(equity, dict) or equity.get("status") != "LINKED_VERIFIED":
        raise CoreError("E_EQUITY_UNAVAILABLE", "No verified equity log is attached to this report.")
    target = _bounded(root, "datasets", str(evidence["source_sha256"]), "equity", str(equity["log_sha256"]))
    import pyarrow.parquet as pq
    rows = [_typed(row) for row in pq.read_table(target / "equity.parquet").to_pylist()]
    initial = rows[0]["balance"]
    boundary = DayBoundary()
    days: dict[str, dict[str, Any]] = {}
    reference = max(rows[0]["balance"], rows[0]["equity_close"])
    for index, row in enumerate(rows):
        day = boundary.day(row["time"])
        if day not in days:
            if index > 0:
                previous = rows[index - 1]
                reference = max(previous["balance"], previous["equity_close"])
            days[day] = {"date": day, "reference": reference, "lowest_equity": row["equity_min"], "lowest_at": row["equity_min_time"]}
        if row["equity_min"] < days[day]["lowest_equity"]:
            days[day]["lowest_equity"], days[day]["lowest_at"] = row["equity_min"], row["equity_min_time"]
    daily = []
    for item in days.values():
        loss = max(Decimal(0), item["reference"] - item["lowest_equity"])
        daily.append({"date": item["date"], "start_of_day_reference": _fmt(item["reference"]), "lowest_equity": _fmt(item["lowest_equity"]), "lowest_at": item["lowest_at"], "loss": _fmt(loss), "loss_percent_of_initial": _q(loss / initial * 100) if initial > 0 else None})
    worst = daily[0]
    for item in daily[1:]:  # the largest loss; ties resolve to the earliest day
        if Decimal(item["loss"]) > Decimal(worst["loss"]):
            worst = item
    drawdown = equity_drawdown(rows)
    from .performance_metrics import performance_metrics

    balance_drawdown = Decimal(str(performance_metrics(read_dataset(root, dataset_ref))["balance_metrics"]["maximum_drawdown"]))
    return {
        "dataset_ref": dataset_ref,
        "calculation_version": METRICS_VERSION,
        "balance_maximum_drawdown": _fmt(balance_drawdown),
        "equity_to_balance_drawdown_ratio": _q(drawdown["maximum"] / balance_drawdown) if balance_drawdown > 0 else None,
        "equity_deeper_than_balance": drawdown["maximum"] > balance_drawdown,
        "equity_source": "MT5_TESTER_LOGGED",
        "day_boundary": "REPORT_CLOCK_MIDNIGHT",
        "start_of_day_reference": "HIGHER_OF_BALANCE_AND_EQUITY_AT_PREVIOUS_ROW",
        "initial_balance": _fmt(initial),
        "maximum_equity_drawdown": _fmt(drawdown["maximum"]),
        "maximum_equity_drawdown_percent": None if drawdown["percent"] is None else _q(drawdown["percent"]),
        "worst_day": worst,
        "daily": daily,
        "row_count": len(rows),
        "display_series": display_series(rows),
        "warnings": [
            "Equity comes from the TRL tester logger; each interval's low is the lowest tick-level equity inside it.",
            "Daily loss uses the report clock's midnight and the higher of balance and equity at the previous sample as the start-of-day reference; firms' rules differ.",
        ],
    }


DISPLAY_POINTS = 1500


def display_series(rows: list[dict[str, Any]], limit: int = DISPLAY_POINTS) -> list[dict[str, str]]:
    """At most `limit` points for charts: consecutive rows are bucketed, keeping each
    bucket's lowest equity_min and highest equity_max (no dip is lost) and its
    last balance and equity_close. Deterministic; display only.
    """

    size = max(1, -(-len(rows) // limit))
    points = []
    for start in range(0, len(rows), size):
        bucket = rows[start:start + size]
        last = bucket[-1]
        points.append({
            "time": last["time"], "balance": _fmt(last["balance"]), "equity_close": _fmt(last["equity_close"]),
            "equity_min": _fmt(min(row["equity_min"] for row in bucket)), "equity_max": _fmt(max(row["equity_max"] for row in bucket)),
        })
    return points


def _link(header: dict[str, str], rows: list[dict[str, Any]], settings: dict[str, Any], events: list[dict[str, Any]]) -> list[dict[str, object]]:
    findings: list[dict[str, object]] = []
    report_timeframe = str(settings.get("Period", "")).split(" ")[0]
    checks = [
        ("expert", header.get("expert"), settings.get("Expert")),
        ("symbol", header.get("symbol"), settings.get("Symbol")),
        ("timeframe", header.get("timeframe"), report_timeframe),
        ("currency", header.get("currency"), settings.get("Currency")),
    ]
    differing = [f"{name} ({log!r} vs report {report!r})" for name, log, report in checks if (log or "").strip() != str(report or "").strip()]
    deposit_log, deposit_report = _number(header.get("initial_deposit")), _number(settings.get("Initial Deposit"))
    if deposit_log is None or deposit_report is None or deposit_log != deposit_report:
        differing.append(f"initial deposit ({header.get('initial_deposit')} vs report {settings.get('Initial Deposit')})")
    if differing:
        findings.append(_finding("BLOCKED", "LOG_CONTEXT_DIFFERS", "The equity log is not from this report's test: " + "; ".join(differing) + "."))
        return findings
    balances = [Decimal(str(event["reported_balance"])) for event in events]
    offset = next((candidate for candidate in (0, 1) if all(_balance_at(balances, row["deals_total"] + candidate) in (None, row["balance"]) for row in rows[:-1])), None)
    if offset is None:
        findings.append(_finding("BLOCKED", "BALANCE_PATH_DIFFERS", "The balances in the equity log do not match the report's balance after each deal; it comes from a different run or was edited."))
        return findings
    final_report = balances[-1]
    end = rows[-1]
    if end["balance"] != final_report:
        remaining = [event for event in events[max(0, end["deals_total"] + offset):]]
        tester_closes = all(str(event.get("comment") or "").strip().lower() == "end of test" for event in remaining if event["event_type"] != "OPENING_BALANCE")
        if not (remaining and tester_closes and abs(end["equity_close"] - final_report) <= _CENT):
            findings.append(_finding("BLOCKED", "FINAL_BALANCE_DIFFERS", f"The log ends at balance {_fmt(end['balance'])} but the report ends at {_fmt(final_report)}."))
            return findings
        findings.append(_finding("NOTE", "END_OF_TEST_CLOSES", f"MT5 closed {len(remaining)} open position(s) at the end of the test after the logger's last row; the log's final equity ({_fmt(end['equity_close'])}) matches the report's final balance."))
    first_deal = next((event for event in events if event["event_type"] != "OPENING_BALANCE"), None)
    if first_deal is not None and (rows[0]["time"] > str(first_deal["source_timestamp"]) or rows[-1]["time"] < str(events[-1]["source_timestamp"])):
        findings.append(_finding("BLOCKED", "LOG_DOES_NOT_COVER_REPORT", "The equity log does not cover the report's first to last deal."))
    return findings


def _balance_at(balances: list[Decimal], deal_count: int) -> Decimal | None:
    if deal_count <= 0:
        return None
    return balances[deal_count - 1] if deal_count <= len(balances) else Decimal("NaN")


def _reported_equity_drawdown(report_path: Path) -> Decimal | None:
    from .mt5_report_summary import read_report_summary

    try:
        text = read_report_summary(report_path)["results"].get("Equity Drawdown Maximal", "")
    except CoreError:
        return None
    match = _LEADING_NUMBER.match(text or "")
    return None if match is None else _number(match.group(1))


def _time(text: str) -> str:
    try:
        return datetime.strptime(text, "%Y.%m.%d %H:%M:%S").strftime("%Y-%m-%dT%H:%M:%S")
    except ValueError as error:
        raise ValueError(text) from error


def _typed(row: dict[str, Any]) -> dict[str, Any]:
    return {key: (Decimal(value) if key in {"balance", "equity_close", "equity_min", "equity_max", "margin_max"} else value) for key, value in row.items()}


def _number(value: object) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(re.sub(r"[\s ]", "", str(value)))
    except InvalidOperation:
        return None


def _finding(severity: str, code: str, message: str) -> dict[str, object]:
    return {"severity": severity, "code": code, "message": message}


def _q(value: Decimal) -> str:
    return format(value.quantize(_STEP, rounding=ROUND_HALF_EVEN), "f")


def _fmt(value: Decimal) -> str:
    return format(value, "f")


def _bounded(root: Path, *parts: str) -> Path:
    candidate = root.joinpath(*parts).resolve()
    try:
        candidate.relative_to(root)
    except ValueError as error:
        raise CoreError("E_PATH_INVALID", "Equity path escapes the worker workspace.") from error
    return candidate

