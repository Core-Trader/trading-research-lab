"""Find the equity log that belongs to a report (UI help for PL-006 attach).

The logger names its files by EA, symbol, timeframe, and test start date, and
repeats of the same test get `_2`, `_3`, ... (`TRL_EquityLogger.mqh`), so a log
cannot be matched to a report by name. This scans the logger folder read-only
and runs the same link check as attaching (`equity_log._link`) on every
candidate, so a MATCHES result will attach. Nothing is copied or stored here.
"""

from __future__ import annotations

from datetime import datetime
import os
from pathlib import Path
from typing import Any

from .dataset_store import read_dataset
from .equity_log import FORMAT, MAX_LOG_BYTES, _link, _number, parse_equity_log
from .errors import CoreError


MAX_FILES = 500  # TRL's own bound on one scan (not a sourced number)
_HEADER_BYTES = 4096


def default_logger_folder() -> dict[str, object]:
    """Where TRL_EquityLogger writes: the MT5 common data folder, `Files\\TRL` (Windows)."""
    appdata = os.environ.get("APPDATA")
    if not appdata:
        return {"folder": None, "exists": False}
    folder = Path(appdata) / "MetaQuotes" / "Terminal" / "Common" / "Files" / "TRL"
    return {"folder": str(folder), "exists": folder.is_dir()}


def _quick_header(path: Path) -> dict[str, str]:
    with path.open("rb") as handle:
        head = handle.read(_HEADER_BYTES).decode("utf-8", errors="replace")
    header: dict[str, str] = {}
    for line in head.splitlines():
        if line.startswith("#") and ":" in line:
            key, value = line[1:].split(":", 1)
            header[key.strip()] = value.strip()
    return header


def scan_equity_logs(workspace_root: Path, dataset_ref: str, folder: str | None = None) -> dict[str, object]:
    location = Path(folder).expanduser() if folder else None
    if location is None:
        default = default_logger_folder()["folder"]
        location = Path(str(default)) if default else None
    if location is None or not location.is_dir():
        raise CoreError("E_SOURCE_NOT_FOUND", "The equity logger folder was not found. Run a logged test first, or browse for the log.", details={"folder": None if location is None else str(location)})
    dataset = read_dataset(workspace_root.resolve(), dataset_ref)
    settings = dict(dataset["metadata"].get("settings") or {})
    events = sorted(dataset["events"], key=lambda event: int(event["source_sequence"]))
    report_timeframe = str(settings.get("Period", "")).split(" ")[0]

    files = sorted((path for path in location.iterdir() if path.is_file() and path.suffix.lower() == ".csv"), key=lambda path: path.stat().st_mtime, reverse=True)
    candidates: list[dict[str, Any]] = []
    for path in files[:MAX_FILES]:
        stat = path.stat()
        entry: dict[str, Any] = {"path": str(path), "name": path.name, "bytes": stat.st_size,
                                 "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"), "status": None, "reason": None,
                                 "logger_version": None, "interval": None, "rows": None}
        header = _quick_header(path)
        entry["logger_version"], entry["interval"] = header.get("logger_version"), header.get("interval")
        if header.get("format") != FORMAT:
            candidates.append({**entry, "status": "NOT_A_TRL_LOG", "reason": "Not a TRL equity log."})
            continue
        context = [("expert", header.get("expert"), settings.get("Expert")), ("symbol", header.get("symbol"), settings.get("Symbol")),
                   ("timeframe", header.get("timeframe"), report_timeframe), ("currency", header.get("currency"), settings.get("Currency"))]
        differing = [name for name, log, report in context if (log or "").strip() != str(report or "").strip()]
        if _number(header.get("initial_deposit")) != _number(settings.get("Initial Deposit")):
            differing.append("initial deposit")
        if differing:
            candidates.append({**entry, "status": "OTHER_TEST", "reason": "Different " + ", ".join(differing) + "."})
            continue
        if stat.st_size > MAX_LOG_BYTES:
            candidates.append({**entry, "status": "TOO_LARGE", "reason": "Larger than TRL reads."})
            continue
        try:
            full_header, rows = parse_equity_log(path.read_bytes())
        except (CoreError, ValueError) as error:
            candidates.append({**entry, "status": "UNREADABLE", "reason": error.message if isinstance(error, CoreError) else "The log could not be read."})
            continue
        blocked = [finding for finding in _link(full_header, rows, settings, events) if finding["severity"] == "BLOCKED"]
        entry["rows"] = len(rows)
        candidates.append({**entry, "status": "OTHER_RUN" if blocked else "MATCHES", "reason": blocked[0]["message"] if blocked else None})

    order = {"MATCHES": 0, "OTHER_RUN": 1, "OTHER_TEST": 2, "TOO_LARGE": 3, "UNREADABLE": 4, "NOT_A_TRL_LOG": 5}
    candidates.sort(key=lambda item: order[item["status"]])  # stable: newest first within each status
    return {"folder": str(location), "scanned": min(len(files), MAX_FILES), "total_csv": len(files),
            "matches": sum(1 for item in candidates if item["status"] == "MATCHES"), "candidates": candidates}
