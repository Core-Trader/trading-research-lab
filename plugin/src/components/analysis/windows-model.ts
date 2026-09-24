/**
 * Windows display model: bar scaling and wording of Core fields. All values,
 * flags and the summary come from the Core (windows-1).
 */
import type { TimeWindow, WindowsResult } from "../../types";
import { money } from "../display-format.ts";

export type WindowBar = { index: number; height: number; negative: boolean };

/** Bar heights (0–100 % of the half-height) for net P/L per window; display scaling only. */
export function windowBars(windows: TimeWindow[]): WindowBar[] {
  const largest = Math.max(...windows.map((window) => Math.abs(Number(window.net_pnl))).filter((value) => Number.isFinite(value)), 0);
  return windows.map((window) => {
    const value = Number(window.net_pnl);
    return { index: window.index, height: largest > 0 && Number.isFinite(value) ? (Math.abs(value) / largest) * 100 : 0, negative: value < 0 };
  });
}

/** Parses an optional whole-number threshold field; null when empty, undefined when invalid. */
export function thresholdValue(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
}

export type Guidance = { read: string[]; tips: string[]; flags: string[] };

export function windowsGuidance(result: WindowsResult): Guidance {
  const summary = result.summary;
  const ccy = result.currency ?? "";
  const read = [
    result.configuration.mode === "SPLIT"
      ? `The report is split into ${result.configuration.months}-month windows with the same settings throughout. Trades count in the window where they close.`
      : `${summary.windows} separate reports of the same settings, one per window, compared side by side.`,
    `${summary.profitable} of ${summary.windows} windows made money; the worst was ${summary.worst.label} (${money(summary.worst.net_pnl)} ${ccy}).`,
    `Net result per window ranged from ${money(summary.net_pnl_spread.minimum)} to ${money(summary.net_pnl_spread.maximum)} ${ccy} (median ${money(summary.net_pnl_spread.median)}).`,
  ];
  const tips: string[] = [];
  if (summary.within_losing_allowance === false) tips.push(`More windows lost money (${summary.losing}) than you allow (${result.configuration.max_losing_windows}).`);
  if (summary.within_losing_allowance === true) tips.push(`Losing windows (${summary.losing}) are within what you allow (${result.configuration.max_losing_windows}).`);
  if (summary.below_min_trades.length) tips.push(`Windows ${summary.below_min_trades.join(", ")} have fewer trades than your minimum, so their results say little.`);
  tips.push("A clean total can hide one bad period: look at each window, not only the sum (TRL playbook §5).");
  const flags = [...result.findings.map((finding) => finding.message), ...result.notes];
  if (result.windows.some((window) => window.partial)) flags.unshift("Partial windows (marked) are not fully covered by the report.");
  return { read, tips, flags };
}
