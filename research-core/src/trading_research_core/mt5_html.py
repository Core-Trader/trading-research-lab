"""Read MT5 Strategy Tester HTML reports into the same row/cell shape as the `.xlsx`.

MT5 writes the HTML report (UTF-16 LE with BOM by default) as one table whose
rows mirror the Excel export: Settings, Inputs, Results, Orders, Deals.
`colspan` is expanded so every cell sits in the column it occupies in the
Excel export, which lets the Excel adapter's checks run unchanged. Values stay
text; only MT5's space thousands separators are removed from numbers. The price
scale that `.xlsx` carries in its number format is taken from the digits shown.
"""

from __future__ import annotations

from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
import re

from .errors import CoreError


HTML_SUFFIXES = {".htm", ".html"}
MAX_HTML_BYTES = 200 * 1024 * 1024
_GROUPED_NUMBER = re.compile(r"^-?\d{1,3}(?:[   ]\d{3})+(?:\.\d+)?$")
_DECIMALS = re.compile(r"^-?\d+\.(\d+)$")


@dataclass(frozen=True)
class HtmlCell:
    """Mimics the two openpyxl cell attributes the MT5 adapters read."""

    value: str | None
    number_format: str = "General"


def decode_html_bytes(raw: bytes) -> str:
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        return raw.decode("utf-16")
    if raw.startswith(b"\xef\xbb\xbf"):
        return raw[3:].decode("utf-8")
    if b"\x00" in raw[:400]:
        return raw.decode("utf-16-le")
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError as error:
        raise CoreError("E_SOURCE_INVALID", "The HTML report is neither UTF-16 nor UTF-8.") from error


def read_html_rows(path: Path) -> list[list[HtmlCell]]:
    """Every table row of the report, with colspans expanded to Excel column positions."""

    if path.stat().st_size > MAX_HTML_BYTES:
        raise CoreError("E_SOURCE_UNSUPPORTED", "The HTML report is larger than TRL reads.")
    parser = _RowParser()
    parser.feed(decode_html_bytes(path.read_bytes()))
    parser.close()
    if not parser.rows:
        raise CoreError("E_SOURCE_INVALID", "The HTML file contains no table rows; it is not an MT5 Strategy Tester report.")
    return [[_cell(text) for text in row] for row in parser.rows]


def row_values(rows: list[list[HtmlCell]]) -> list[list[str | None]]:
    return [[cell.value for cell in row] for row in rows]


def _cell(text: str | None) -> HtmlCell:
    if text is None:
        return HtmlCell(None)
    value = text.strip()
    if not value:
        return HtmlCell(None)
    if _GROUPED_NUMBER.match(value):
        value = re.sub(r"[   ]", "", value)
    decimals = _DECIMALS.match(value)
    return HtmlCell(value, "0." + "0" * len(decimals.group(1)) if decimals else "General")


class _RowParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[str | None]] = []
        self._row: list[str | None] | None = None
        self._text: list[str] | None = None
        self._span = 1

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "tr":
            self._close_cell()
            self._row = []
        elif tag in {"td", "th"} and self._row is not None:
            self._close_cell()
            span = dict(attrs).get("colspan") or "1"
            self._span = max(1, min(int(span), 64)) if span.isdigit() else 1
            self._text = []
        elif tag == "br" and self._text is not None:
            self._text.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"}:
            self._close_cell()
        elif tag == "tr" and self._row is not None:
            self._close_cell()
            self.rows.append(self._row)
            self._row = None

    def handle_data(self, data: str) -> None:
        if self._text is not None:
            self._text.append(data)

    def _close_cell(self) -> None:
        if self._text is None or self._row is None:
            return
        text = re.sub(r"\s+", " ", "".join(self._text)).strip()
        self._row.append(text or None)
        self._row.extend([None] * (self._span - 1))
        self._text = None
        self._span = 1


def import_mt5_html(path_text: str) -> dict[str, object]:
    """Canonical events from an MT5 HTML report, through the Excel adapter's checks.

    The HTML Deals table ends with a totals row (commission, swap, profit, and
    final balance). It is verified against the deals and then dropped; a
    mismatch blocks the import.
    """

    from decimal import Decimal

    from .mt5_excel import _extract_events, _extract_settings, file_sha256

    source_path = Path(path_text).expanduser().resolve()
    if not source_path.is_file():
        raise CoreError("E_SOURCE_NOT_FOUND", "Source file does not exist.", details={"path": str(source_path)})
    if source_path.suffix.lower() not in HTML_SUFFIXES:
        raise CoreError("E_SOURCE_UNSUPPORTED", "Expected an MT5 Strategy Tester HTML report (.htm or .html).")
    rows = read_html_rows(source_path)
    rows, totals = _split_totals(rows)
    source_hash = file_sha256(source_path)
    settings = _extract_settings(rows)
    events = _extract_events(rows, source_hash)
    if totals is not None:
        trading = [event for event in events if event["event_type"] != "OPENING_BALANCE"]
        observed = {
            "commission": sum((Decimal(str(event["source_commission"])) for event in trading), Decimal(0)),
            "swap": sum((Decimal(str(event["source_swap"])) for event in trading), Decimal(0)),
            "profit": sum((Decimal(str(event["source_profit"])) for event in trading), Decimal(0)),
            "balance": Decimal(str(events[-1]["reported_balance"])),
        }
        differing = [name for name, value in observed.items() if totals[name] is not None and Decimal(totals[name]) != value]
        if differing:
            raise CoreError("E_SOURCE_INVALID", "The HTML report's Deals totals do not match its deals.", details={"differing": differing})
    return {
        "source": {"filename": source_path.name, "sha256": source_hash, "byte_count": source_path.stat().st_size, "worksheet_name": "HTML report"},
        "settings": settings,
        "events": events,
        "source_checks": ["HTML_DEALS_TOTALS_MATCH"] if totals is not None else ["HTML_DEALS_TOTALS_ABSENT"],
    }


def _split_totals(rows: list[list[HtmlCell]]) -> tuple[list[list[HtmlCell]], dict[str, str | None] | None]:
    deals = next((index for index, row in enumerate(rows) if row and row[0].value == "Deals"), None)
    if deals is None:
        return rows, None
    candidates = [index for index in range(deals + 2, len(rows)) if any(cell.value is not None for cell in rows[index])]
    if not candidates:
        return rows, None
    last = candidates[-1]
    row = rows[last] + [HtmlCell(None)] * 13
    if all(cell.value is None for cell in row[:8]) and row[11].value is not None:
        totals = {"commission": row[8].value, "swap": row[9].value, "profit": row[10].value, "balance": row[11].value}
        return rows[:last] + rows[last + 1:], totals
    return rows, None
