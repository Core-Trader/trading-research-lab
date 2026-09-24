/**
 * Prop-firm check display model. Every number, comparison, and verdict comes
 * from the Core (`prop.evaluate`); this module converts the profile form to
 * the request shape, words Core fields, and scales chart points.
 */
import type { PropChallengeOutcome, PropEvaluation, PropLimit, PropPreset, PropRuleResult, PropRules } from "../../types";
import { formatTimestamp, roundDecimalString } from "../display-format.ts";
import type { Guidance } from "../advanced/monte-carlo-model";

const r2 = (value: string | null | undefined): string => value === null || value === undefined ? "—" : roundDecimalString(value, 2);

export type LimitKind = "NONE" | "PERCENT" | "AMOUNT";
export type ProfileForm = {
  name: string;
  accountSize: string;
  dailyKind: LimitKind; dailyValue: string; dailyBasis: PropRules["daily_loss_basis"]; startReference: PropRules["start_of_day_reference"];
  overallKind: LimitKind; overallValue: string; overallMode: PropRules["overall_loss_mode"]; trailingReference: NonNullable<PropRules["trailing_reference"]>;
  targetKind: LimitKind; targetValue: string;
  minimumDays: string; maximumDays: string;
  resetKind: "REPORT_CLOCK_MIDNIGHT" | "FIRM_RESET"; resetTime: string; resetZone: string;
  breachOn: PropRules["breach_on"];
  tradingDay: NonNullable<PropRules["trading_day_definition"]>;
  touchCounts: boolean;
  bestDay: string;
  /** Set when the form started from a firm preset; recorded with the saved profile. */
  presetId: string | null;
};

export function emptyForm(accountSize = ""): ProfileForm {
  return {
    name: "", accountSize,
    dailyKind: "PERCENT", dailyValue: "", dailyBasis: "INITIAL_BALANCE", startReference: "HIGHER_OF_BALANCE_AND_EQUITY",
    overallKind: "PERCENT", overallValue: "", overallMode: "FIXED", trailingReference: "BALANCE_HIGH",
    targetKind: "PERCENT", targetValue: "", minimumDays: "", maximumDays: "",
    resetKind: "REPORT_CLOCK_MIDNIGHT", resetTime: "00:00", resetZone: "", breachOn: "EQUITY_TOUCH",
    tradingDay: "DEAL_OPENED_OR_CLOSED", touchCounts: true, bestDay: "", presetId: null,
  };
}

export function formFromRules(rules: PropRules): ProfileForm {
  const kind = (limit: PropLimit | null): LimitKind => limit?.kind ?? "NONE";
  return {
    name: rules.name, accountSize: rules.account_size,
    dailyKind: kind(rules.daily_loss_limit), dailyValue: rules.daily_loss_limit?.value ?? "", dailyBasis: rules.daily_loss_basis, startReference: rules.start_of_day_reference,
    overallKind: kind(rules.overall_loss_limit), overallValue: rules.overall_loss_limit?.value ?? "", overallMode: rules.overall_loss_mode, trailingReference: rules.trailing_reference ?? "BALANCE_HIGH",
    targetKind: kind(rules.profit_target), targetValue: rules.profit_target?.value ?? "",
    minimumDays: rules.minimum_trading_days === null ? "" : String(rules.minimum_trading_days), maximumDays: rules.maximum_calendar_days === null ? "" : String(rules.maximum_calendar_days),
    resetKind: rules.reset.kind, resetTime: rules.reset.kind === "FIRM_RESET" ? rules.reset.time : "00:00", resetZone: rules.reset.kind === "FIRM_RESET" ? rules.reset.zone : "",
    breachOn: rules.breach_on,
    tradingDay: rules.trading_day_definition ?? "DEAL_OPENED_OR_CLOSED", touchCounts: rules.limit_touch_counts ?? true, bestDay: rules.best_day_max_percent ?? "", presetId: null,
  };
}

/** A new form from a firm preset; the account size comes from the run being checked. */
export function formFromPreset(preset: PropPreset, accountSize: string): ProfileForm {
  return { ...formFromRules({ ...preset.rules, name: preset.name, account_size: accountSize } as PropRules), presetId: preset.preset_id };
}

/** The request body for prop.save_profile. The Core validates every value. */
export function profileFromForm(form: ProfileForm): Record<string, unknown> {
  const limit = (kind: LimitKind, value: string): PropLimit | null => kind === "NONE" ? null : { kind, value: value.trim() };
  const count = (value: string): number | string | null => value.trim() === "" ? null : /^\d+$/.test(value.trim()) ? Number(value.trim()) : value.trim();
  return {
    name: form.name,
    account_size: form.accountSize.trim(),
    daily_loss_limit: limit(form.dailyKind, form.dailyValue),
    daily_loss_basis: form.dailyBasis,
    start_of_day_reference: form.startReference,
    overall_loss_limit: limit(form.overallKind, form.overallValue),
    overall_loss_mode: form.overallMode,
    trailing_reference: form.overallMode === "FIXED" ? null : form.trailingReference,
    profit_target: limit(form.targetKind, form.targetValue),
    minimum_trading_days: count(form.minimumDays),
    maximum_calendar_days: count(form.maximumDays),
    reset: form.resetKind === "FIRM_RESET" ? { kind: "FIRM_RESET", time: form.resetTime.trim(), zone: form.resetZone.trim() } : { kind: "REPORT_CLOCK_MIDNIGHT" },
    breach_on: form.breachOn,
    trading_day_definition: form.tradingDay,
    limit_touch_counts: form.touchCounts,
    best_day_max_percent: form.bestDay.trim() === "" ? null : form.bestDay.trim(),
  };
}

export const RULE_LABELS: Record<PropRuleResult["rule"], string> = { DAILY_LOSS: "Daily loss", OVERALL_LOSS: "Overall loss" };

export function limitText(limit: PropLimit | null, currency: string, base: "account" | "reference" = "account"): string {
  if (limit === null) return "not set";
  return limit.kind === "AMOUNT" ? `${r2(limit.value)} ${currency}` : `${limit.value}% of ${base === "reference" ? "the start-of-day value" : "the account size"}`;
}

export function modeText(rule: PropRuleResult): string {
  if (rule.rule === "DAILY_LOSS") return "from each day's start";
  if (rule.mode === "FIXED") return "fixed floor";
  const reference = rule.trailing_reference === "EQUITY_HIGH" ? "highest equity" : rule.trailing_reference === "END_OF_DAY_BALANCE_HIGH" ? "highest end-of-day balance" : "highest balance";
  return rule.mode === "TRAILING_LOCKS_AT_START" ? `trails the ${reference}, stops at the starting balance` : `trails the ${reference}`;
}

export const EVIDENCE_TEXT: Record<PropEvaluation["evidence_level"], string> = {
  EQUITY_LOGGED: "Equity log (tick-level lows)",
  PORTFOLIO_CONSERVATIVE: "Portfolio equity logs (conservative and optimistic bounds)",
  REALISED_ONLY: "Closed trades only (optimistic preview)",
};

/** The banner line. Wording follows the evidence level (spec §4); the verdict is the Core's. */
export function verdictHeadline(result: PropEvaluation): string {
  const preview = result.evidence_level === "REALISED_ONLY" ? "Optimistic preview (closed trades only): " : "";
  const first = firstBreach(result);
  if (result.verdict === "BROKEN" && first) return `${preview}Broken on ${formatTimestamp(first.time)} (${RULE_LABELS[first.rule].toLowerCase()} rule)`;
  if (result.verdict === "POSSIBLY_BROKEN" && first) return `${preview}Possibly broken on ${formatTimestamp(first.time)} (${RULE_LABELS[first.rule].toLowerCase()} rule)`;
  if (result.rules.length === 0) return `${preview}No loss rules in this profile`;
  return result.evidence_level === "REALISED_ONLY" ? `${preview}Not broken on closed trades` : "Not broken in the logged evidence";
}

export function firstBreach(result: PropEvaluation): { rule: PropRuleResult["rule"]; time: string } | null {
  const breaches = result.rules.filter((rule) => rule.first_breach !== null).map((rule) => ({ rule: rule.rule, time: rule.first_breach!.time }));
  breaches.sort((left, right) => left.time.localeCompare(right.time));
  return breaches[0] ?? null;
}

export const CHALLENGE_TEXT: Record<PropChallengeOutcome, string> = {
  PASSED: "Target reached with no loss rule broken first",
  TARGET_NOT_REACHED: "Profit target not reached in this run",
  MINIMUM_DAYS_NOT_REACHED: "Target reached, but the run has fewer trading days than required",
  BEST_DAY_RULE_NOT_MET: "Target and days reached, but the best day stayed above the allowed share of the profit",
  OBJECTIVES_NOT_MET_TOGETHER: "Each objective was met at some point, but never all at the same time",
  TOO_SLOW: "Target reached, but after the allowed number of days",
  BROKEN_BEFORE_PASS: "A loss rule was broken before the target was reached",
  POSSIBLY_BROKEN_BEFORE_PASS: "A loss rule was possibly broken before the target was reached",
};

export type ChartGeometry = { balance: string; equity: string; low: string; floor: string | null; markers: Array<{ rule: string; x: number; time: string }>; bottom: number; top: number };

/** SVG points in a 0–100 box for the Core display series; display scaling only. */
/** `withFloor` false scales to balance and equity only (the floor line is then omitted). */
export function propChartGeometry(result: PropEvaluation, withFloor = true): ChartGeometry | null {
  const series = result.series;
  if (series.length < 2) return null;
  const values = series.flatMap((point) => [point.balance, point.equity, point.low, withFloor ? point.floor : null].filter((value): value is string => value !== null).map(Number));
  if (values.some((value) => !Number.isFinite(value))) return null;
  const bottom = Math.min(...values);
  const top = Math.max(...values);
  const span = top - bottom || 1;
  const x = (index: number): number => (index / (series.length - 1)) * 100;
  const y = (value: string): string => (100 - ((Number(value) - bottom) / span) * 100).toFixed(3);
  const line = (pick: (point: PropEvaluation["series"][number]) => string | null): string => series.map((point, index) => `${x(index).toFixed(3)},${y(pick(point) ?? "0")}`).join(" ");
  const markers = result.breach_markers.map((marker) => {
    const index = series.findIndex((point) => point.time >= marker.time);
    return { rule: marker.rule, time: marker.time, x: x(index < 0 ? series.length - 1 : index) };
  });
  return { balance: line((point) => point.balance), equity: line((point) => point.equity), low: line((point) => point.low), floor: !withFloor || series[0]!.floor === null ? null : line((point) => point.floor), markers, bottom, top };
}

/** Bar height for a day: the share of its limit used, from the Core headroom percentage. */
export function limitUsedPercent(headroomPercentOfLimit: string): number {
  const used = 100 - Number(headroomPercentOfLimit);
  return Number.isFinite(used) ? Math.max(0, Math.min(120, used)) : 0;
}

export function propGuidance(result: PropEvaluation): Guidance {
  const ccy = result.currency ?? "";
  const read: string[] = [];
  const tips: string[] = [];
  const flags: string[] = [];
  read.push(`Evidence: ${EVIDENCE_TEXT[result.evidence_level]}. The rules are the values in "${result.profile.name}"${result.profile.preset ? `, copied from a ${result.profile.preset.firm} preset and editable` : ", entered by you"}.`);
  const boundary = result.day_boundary;
  read.push(boundary.kind === "FIRM_RESET"
    ? `A day starts at ${boundary.time} ${boundary.zone}; report times were read as ${boundary.report_clock_zone}.`
    : "A day starts at midnight on the report's clock (broker server time).");
  for (const rule of result.rules) {
    const label = RULE_LABELS[rule.rule];
    if (rule.first_breach) {
      read.push(`${label}: ${rule.verdict === "POSSIBLY_BROKEN" ? "possibly broken" : "broken"} on ${formatTimestamp(rule.first_breach.time)}, when the value reached ${r2(rule.first_breach.value)} ${ccy} against a limit level of ${r2(rule.first_breach.limit_level)} ${ccy}.`);
    } else if (rule.tightest) {
      const where = rule.rule === "DAILY_LOSS" && rule.tightest.date ? ` on ${rule.tightest.date}` : rule.tightest.time ? ` at ${formatTimestamp(rule.tightest.time)}` : "";
      read.push(`${label}: not broken. The closest it came was${where}, with ${r2(rule.tightest.headroom)} ${ccy} (${r2(rule.tightest.headroom_percent_of_limit)}% of the limit) to spare.`);
    }
    if (rule.verdict === "POSSIBLY_BROKEN" && rule.optimistic?.tightest) {
      tips.push(`${label}: only the conservative bound breaks the rule. On sampled combined equity the closest point left ${r2(rule.optimistic.tightest.headroom)} ${ccy}. The truth lies between the two; a tick-exact combined equity is not available.`);
    }
  }
  const target = result.profit_target;
  if (target) {
    read.push(target.reached
      ? `Profit target (${r2(target.amount)} ${ccy}) reached on ${formatTimestamp(target.time!)} after ${target.trading_days} trading day(s) and ${target.calendar_days} calendar day(s), on closed balance.`
      : `Profit target (${r2(target.amount)} ${ccy}) not reached in this run.`);
  }
  if (result.challenge) tips.push(`${CHALLENGE_TEXT[result.challenge.outcome]}.`);
  const best = result.challenge?.best_day;
  if (best?.share_percent) tips.push(`Best day ${best.date}: ${r2(best.best_day_profit)} ${ccy} of ${r2(best.positive_days_profit)} ${ccy} positive-days profit (${r2(best.share_percent)}%, limit ${best.max_percent}%) at the ${best.at}.`);
  if (result.profile.preset) flags.push(`Rules from the ${result.profile.preset.firm} preset (${result.profile.preset.programme}, ${result.profile.preset.phase}), copied from ${result.profile.preset.source_url} on ${result.profile.preset.retrieved_at}. Verify against the firm's current terms.`);
  const tightestDay = result.rules.find((rule) => rule.rule === "DAILY_LOSS")?.tightest;
  if (tightestDay?.date && tightestDay.loss) tips.push(`Your hardest day was ${tightestDay.date}: a loss of ${r2(tightestDay.loss)} ${ccy} against a ${r2(tightestDay.limit)} ${ccy} limit. Open that day on the chart to see which trades drove it.`);
  if (result.evidence_level === "REALISED_ONLY") flags.push("Floating (open-position) losses are not visible without an equity log. Attach one on the Data page (see Help & downloads for the logger) for an equity-based check.");
  if (boundary.kind === "REPORT_CLOCK_MIDNIGHT") flags.push("Check that your firm resets at midnight broker time; if not, set its reset time and zone in the profile.");
  for (const finding of result.findings) flags.push(finding.message);
  flags.push("This checks a past run against the rules you entered. It does not predict a live challenge.");
  return { read, tips, flags };
}

/** Common zones offered next to the free-text field; any IANA name or UTC±HH:MM is accepted by the Core. */
export const ZONE_SUGGESTIONS: Array<{ value: string; label: string }> = [
  { value: "Europe/Athens", label: "EET with EU daylight saving (common for MT5 servers)" },
  { value: "Europe/Prague", label: "Central European time" },
  { value: "Europe/London", label: "UK time" },
  { value: "America/New_York", label: "New York time" },
  { value: "UTC", label: "UTC" },
  { value: "UTC+02:00", label: "Fixed UTC+2, no daylight saving" },
  { value: "UTC+03:00", label: "Fixed UTC+3, no daylight saving" },
];
