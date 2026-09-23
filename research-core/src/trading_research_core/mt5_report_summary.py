"""MT5 Strategy Tester single-test report: header, inputs, and Results summary.

Reads the sections MT5 writes above the Deals table of an `.xlsx` or HTML report:
Settings (Expert, Symbol, Period, Inputs, Company, Currency, Initial Deposit,
Leverage) and Results (MT5-computed statistics). Values are preserved as
strings; nothing is recomputed. Used to place a single test (for example the
EA default) on the same MT5-reported metric axes as optimisation passes.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from pathlib import Path
import re
from typing import Any

from .errors import CoreError


SUMMARY_VERSION = "mt5-report-summary-1"
# Results label -> TRL metric id used by parameter studies (same ids as the XML catalogue).
RESULT_METRICS = {
    "Total Net Profit": "net_profit",
    "Profit Factor": "profit_factor",
    "Recovery Factor": "recovery_factor",
    "Expected Payoff": "expected_payoff",
    "Sharpe Ratio": "mt5_sharpe",
    "Total Trades": "trades",
    "OnTester result": "mt5_custom",
}
_PERIOD = re.compile(r"^\s*(?P<timeframe>\S+)\s*\((?P<start>\d{4}\.\d{2}\.\d{2})\s*-\s*(?P<end>\d{4}\.\d{2}\.\d{2})\)\s*$")
_LEADING_PERCENT = re.compile(r"^\s*(-?\d+(?:\.\d+)?)%")


def read_report_summary(path: Path) -> dict[str, Any]:
    """Parse the header, inputs, and Results of one MT5 `.xlsx` or HTML report."""

    if path.suffix.lower() in {".htm", ".html"}:
        from .mt5_html import read_html_rows, row_values

        return summarise_rows(row_values(read_html_rows(path)))
    try:
        import openpyxl
    except ImportError as error:
        raise CoreError("E_DEPENDENCY_MISSING", "openpyxl is required to read MT5 reports.") from error
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        rows = [[cell for cell in row] for row in workbook.worksheets[0].iter_rows(values_only=True)]
    finally:
        workbook.close()
    return summarise_rows(rows)


def summarise_rows(rows: list[list[Any]]) -> dict[str, Any]:
    header: dict[str, str] = {}
    inputs: dict[str, str] = {}
    results: dict[str, str] = {}
    section = None
    in_inputs = False
    for row in rows:
        cells = [cell for cell in row if cell is not None and str(cell).strip() != ""]
        if not cells:
            continue
        first = str(cells[0]).strip()
        if len(cells) == 1 and not first.endswith(":") and "=" not in first:
            section = first
            in_inputs = False
            if section in {"Orders", "Deals"}:
                break
            continue
        if section == "Settings":
            if first.endswith(":") and first != "Inputs:":
                in_inputs = False
                header[first[:-1]] = _text(cells[1]) if len(cells) > 1 else ""
                continue
            if first == "Inputs:":
                in_inputs = True
                cells = cells[1:]
            if in_inputs:
                for cell in cells:
                    name, separator, value = str(cell).partition("=")
                    if separator and name.strip() and value.strip() != "":
                        inputs[name.strip()] = value.strip()
        elif section == "Results":
            for index in range(len(cells) - 1):
                label = str(cells[index]).strip()
                if label.endswith(":") and not str(cells[index + 1]).strip().endswith(":"):
                    results[label[:-1]] = _text(cells[index + 1])
    if "Expert" not in header or not results:
        raise CoreError("E_REPORT_SUMMARY_UNSUPPORTED", "The report has no recognisable Settings/Results sections.")
    period = _PERIOD.match(header.get("Period", ""))
    metrics = {metric_id: results.get(label) for label, metric_id in RESULT_METRICS.items()}
    relative = _LEADING_PERCENT.match(results.get("Equity Drawdown Relative", ""))
    metrics["equity_drawdown_pct"] = relative.group(1) if relative else None
    return {
        "summary_version": SUMMARY_VERSION,
        "expert": header.get("Expert"),
        "symbol": header.get("Symbol"),
        "timeframe": period.group("timeframe") if period else None,
        "start": period.group("start") if period else None,
        "end": period.group("end") if period else None,
        "currency": header.get("Currency"),
        "initial_deposit": header.get("Initial Deposit"),
        "leverage": header.get("Leverage"),
        "inputs": inputs,
        "results": results,
        "metrics": metrics,
        "notes": ["Equity drawdown % is MT5's 'Equity Drawdown Relative' percentage, which the report shows to 2 decimal places."],
    }


def _text(value: Any) -> str:
    if isinstance(value, float):
        try:
            return format(Decimal(repr(value)).normalize(), "f")
        except InvalidOperation:
            return repr(value)
    return str(value).strip()
