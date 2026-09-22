import type { CloseEventDisplaySeries, PeriodPnl } from "../types";

export type CalendarDay = { date: string; day: number; pnl: (PeriodPnl & { date: string }) | null };
export type CalendarWeek = { isoYear: number; isoWeek: number; days: Array<CalendarDay | null>; total: (PeriodPnl & { iso_year: number; iso_week: number }) | null };
export type CalendarMonth = { month: string; label: string; weeks: CalendarWeek[]; total: (PeriodPnl & { month: string }) | null };

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Lays out Core daily P/L on Monday-first month grids. Only date placement
 * happens here; every total shown (day, ISO week, month) is a Core value.
 */
export function calendarMonths(series: Pick<CloseEventDisplaySeries, "daily" | "weekly" | "monthly">): CalendarMonth[] {
  const byDate = new Map(series.daily.map((row) => [row.date, row]));
  const byWeek = new Map(series.weekly.map((row) => [`${row.iso_year}-${row.iso_week}`, row]));
  const byMonth = new Map(series.monthly.map((row) => [row.month, row]));
  const months = [...new Set(series.daily.map((row) => row.date.slice(0, 7)))].sort();
  return months.map((month) => {
    const [year, monthNumber] = month.split("-").map(Number) as [number, number];
    const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const weeks: CalendarWeek[] = [];
    let current: CalendarWeek | null = null;
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${month}-${String(day).padStart(2, "0")}`;
      const weekdayIndex = (new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay() + 6) % 7;
      if (current === null || weekdayIndex === 0) {
        const { isoYear, isoWeek } = isoWeekOf(year, monthNumber, day);
        current = { isoYear, isoWeek, days: Array<CalendarDay | null>(7).fill(null), total: byWeek.get(`${isoYear}-${isoWeek}`) ?? null };
        weeks.push(current);
      }
      current.days[weekdayIndex] = { date, day, pnl: byDate.get(date) ?? null };
    }
    return { month, label: `${MONTH_NAMES[monthNumber - 1]} ${year}`, weeks, total: byMonth.get(month) ?? null };
  });
}

/** ISO 8601 week of a calendar date (used only to look up the Core weekly total). */
export function isoWeekOf(year: number, month: number, day: number): { isoYear: number; isoWeek: number } {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday + 3);
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  return { isoYear, isoWeek: 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000)) };
}
