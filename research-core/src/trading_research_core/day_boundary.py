"""Day boundaries for daily rules (PROP_FIRM_SPEC.md §3, decision P3).

MT5 tester times are broker server time (the report clock). A day is either
the report clock's calendar day (`REPORT_CLOCK_MIDNIGHT`, TRL's default) or a
firm's reset day (`FIRM_RESET`: a local time in an IANA zone). A firm reset
needs the report clock's zone declared by the user; TRL never guesses it.

Days are labelled by the calendar date, in the reset zone, on which they
start. Conversion uses the IANA tz database (`tzdata`). Report times that do
not exist or are ambiguous in the report-clock zone (daylight-saving
changes) resolve to the earlier offset (`fold=0`) and are counted in
`findings`.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone, tzinfo
import re
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .errors import CoreError


VERSION = "day-boundary-1"
REPORT_CLOCK_MIDNIGHT = "REPORT_CLOCK_MIDNIGHT"
FIRM_RESET = "FIRM_RESET"
_RESET_TIME = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
_FIXED_OFFSET = re.compile(r"^UTC([+-])(\d{2}):(\d{2})$")


class DayBoundary:
    """Maps report-clock ISO times to day labels under one boundary definition."""

    def __init__(self, spec: dict[str, Any] | None = None, report_clock_zone: str | None = None) -> None:
        spec = normalise_spec(spec)
        self.spec = spec
        self.report_clock_zone: str | None = None
        self._cache: dict[str, str] = {}
        self.nonexistent_times = 0
        self.ambiguous_times = 0
        if spec["kind"] == FIRM_RESET:
            if not report_clock_zone:
                raise CoreError("E_PROP_CLOCK_UNDECLARED", "A firm reset time needs the report's server time zone. Declare it, or use the report clock's midnight.")
            self.report_clock_zone = str(report_clock_zone).strip()
            self._source = parse_zone(self.report_clock_zone, allow_fixed=True)
            self._reset = parse_zone(spec["zone"], allow_fixed=False)
            hours, minutes = (int(part) for part in spec["time"].split(":"))
            self._shift = timedelta(hours=hours, minutes=minutes)

    def day(self, report_time: str) -> str:
        cached = self._cache.get(report_time)
        if cached is not None:
            return cached
        if self.spec["kind"] == REPORT_CLOCK_MIDNIGHT:
            label = datetime.fromisoformat(report_time).date().isoformat()
        else:
            naive = datetime.fromisoformat(report_time)
            aware = naive.replace(tzinfo=self._source, fold=0)
            if aware.astimezone(timezone.utc).astimezone(self._source).replace(tzinfo=None) != naive:
                self.nonexistent_times += 1
            elif naive.replace(tzinfo=self._source, fold=1).utcoffset() != aware.utcoffset():
                self.ambiguous_times += 1
            label = (aware.astimezone(self._reset) - self._shift).date().isoformat()
        self._cache[report_time] = label
        return label

    def describe(self) -> dict[str, object]:
        return {"version": VERSION, **self.spec, "report_clock_zone": self.report_clock_zone, "day_label": "calendar date on which the day starts"}

    def findings(self) -> list[dict[str, object]]:
        items: list[dict[str, object]] = []
        if self.nonexistent_times:
            items.append({"severity": "NOTE", "code": "REPORT_TIME_NONEXISTENT", "message": f"{self.nonexistent_times} report time(s) fall in a daylight-saving gap of {self.report_clock_zone}; they were read with the earlier offset."})
        if self.ambiguous_times:
            items.append({"severity": "NOTE", "code": "REPORT_TIME_AMBIGUOUS", "message": f"{self.ambiguous_times} report time(s) are ambiguous in {self.report_clock_zone} (clocks went back); they were read with the earlier offset."})
        return items


def normalise_spec(spec: dict[str, Any] | None) -> dict[str, Any]:
    if spec is None or spec == {"kind": REPORT_CLOCK_MIDNIGHT}:
        return {"kind": REPORT_CLOCK_MIDNIGHT}
    if not isinstance(spec, dict) or spec.get("kind") != FIRM_RESET or set(spec) != {"kind", "time", "zone"}:
        raise CoreError("E_PROP_PROFILE_INVALID", "reset must be {kind: REPORT_CLOCK_MIDNIGHT} or {kind: FIRM_RESET, time: 'HH:MM', zone: IANA zone}.")
    time, zone = str(spec["time"]).strip(), str(spec["zone"]).strip()
    if not _RESET_TIME.match(time):
        raise CoreError("E_PROP_PROFILE_INVALID", "The reset time must be HH:MM (24-hour).")
    parse_zone(zone, allow_fixed=False)
    return {"kind": FIRM_RESET, "time": time, "zone": zone}


def parse_zone(name: str, allow_fixed: bool) -> tzinfo:
    """An IANA zone, or (for the report clock only) a fixed offset such as UTC+02:00."""

    match = _FIXED_OFFSET.match(name) if allow_fixed else None
    if match:
        sign = 1 if match.group(1) == "+" else -1
        hours, minutes = int(match.group(2)), int(match.group(3))
        if hours > 14 or minutes >= 60:
            raise CoreError("E_PROP_ZONE_INVALID", f"Unknown time zone '{name}'.")
        return timezone(sign * timedelta(hours=hours, minutes=minutes))
    try:
        if not name or name != name.strip() or ".." in name or name.startswith("/"):
            raise ValueError(name)
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError) as error:
        hint = " Use an IANA name such as Europe/Prague, or a fixed offset such as UTC+02:00." if allow_fixed else " Use an IANA name such as Europe/Prague."
        raise CoreError("E_PROP_ZONE_INVALID", f"Unknown time zone '{name}'.{hint}") from error
