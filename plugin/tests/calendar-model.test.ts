import assert from "node:assert/strict";
import test from "node:test";
import { calendarMonths, isoWeekOf } from "../src/components/calendar-model.ts";

const pnl = (net_pnl: string) => ({ net_pnl, close_event_count: 1, win_count: net_pnl.startsWith("-") ? 0 : 1, loss_count: net_pnl.startsWith("-") ? 1 : 0 });

test("ISO weeks match the Core convention across a year boundary", () => {
  assert.deepEqual(isoWeekOf(2024, 12, 29), { isoYear: 2024, isoWeek: 52 });
  assert.deepEqual(isoWeekOf(2024, 12, 30), { isoYear: 2025, isoWeek: 1 });
  assert.deepEqual(isoWeekOf(2021, 1, 3), { isoYear: 2020, isoWeek: 53 });
  assert.deepEqual(isoWeekOf(2026, 9, 22), { isoYear: 2026, isoWeek: 39 });
});

test("months lay out Monday-first and attach Core day, week, and month totals", () => {
  const months = calendarMonths({
    daily: [{ date: "2024-12-29", ...pnl("0.28") }, { date: "2024-12-30", ...pnl("-5.75") }, { date: "2025-01-02", ...pnl("12.34") }],
    weekly: [{ iso_year: 2024, iso_week: 52, ...pnl("0.28") }, { iso_year: 2025, iso_week: 1, ...pnl("6.59") }],
    monthly: [{ month: "2024-12", ...pnl("-5.47") }, { month: "2025-01", ...pnl("12.34") }],
  });
  assert.deepEqual(months.map((month) => month.label), ["December 2024", "January 2025"]);
  const december = months[0]!;
  assert.equal(december.total?.net_pnl, "-5.47");
  // 1 December 2024 is a Sunday: the first row has only the last column filled.
  assert.deepEqual(december.weeks[0]!.days.map((day) => day?.day ?? null), [null, null, null, null, null, null, 1]);
  const lastWeek = december.weeks.at(-1)!;
  assert.equal(lastWeek.isoYear, 2025);
  assert.equal(lastWeek.isoWeek, 1);
  assert.equal(lastWeek.total?.net_pnl, "6.59");
  assert.equal(lastWeek.days[0]?.pnl?.net_pnl, "-5.75");
  const week52 = december.weeks.find((week) => week.isoWeek === 52)!;
  assert.equal(week52.days[6]?.pnl?.net_pnl, "0.28");
  assert.equal(december.weeks.flatMap((week) => week.days).filter((day) => day?.pnl).length, 2);
  // January 2025 starts on a Wednesday.
  assert.equal(months[1]!.weeks[0]!.days.findIndex((day) => day !== null), 2);
});

test("a day without close events is present but carries no value", () => {
  const [month] = calendarMonths({ daily: [{ date: "2026-02-10", ...pnl("1") }], weekly: [], monthly: [] });
  const days = month!.weeks.flatMap((week) => week.days).filter((day) => day !== null);
  assert.equal(days.length, 28);
  assert.equal(days.filter((day) => day!.pnl !== null).length, 1);
  assert.equal(month!.total, null);
});
