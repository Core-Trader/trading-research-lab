import type { PortfolioPreflightResult } from "../../types";

export type TimelineRow = {
  datasetRef: string;
  filename: string;
  first: string;
  last: string;
  left: number;
  width: number;
  conflict: boolean;
};

/**
 * Places each member's report-clock span on a shared time axis (percent).
 * Conflicts are read from Core BLOCKED findings; this module never decides
 * eligibility itself.
 */
export function batchTimeline(result: Pick<PortfolioPreflightResult, "members" | "findings">): { rows: TimelineRow[]; start: string; end: string } | null {
  const spans = result.members.map((member) => ({ member, from: Date.parse(member.first_timestamp), to: Date.parse(member.last_timestamp) }));
  if (spans.length === 0 || spans.some((span) => Number.isNaN(span.from) || Number.isNaN(span.to))) return null;
  const start = Math.min(...spans.map((span) => span.from));
  const end = Math.max(...spans.map((span) => span.to));
  const range = end - start || 1;
  const conflicted = new Set(result.findings.filter((finding) => finding.severity === "BLOCKED").flatMap((finding) => finding.members ?? []).map((member) => member.dataset_ref));
  const earliest = spans.find((span) => span.from === start)!.member;
  const latest = spans.find((span) => span.to === end)!.member;
  return {
    start: earliest.first_timestamp,
    end: latest.last_timestamp,
    rows: spans.map(({ member, from, to }) => ({
      datasetRef: member.dataset_ref,
      filename: member.filename,
      first: member.first_timestamp,
      last: member.last_timestamp,
      left: ((from - start) / range) * 100,
      width: Math.max(0.8, ((to - from) / range) * 100),
      conflict: conflicted.has(member.dataset_ref),
    })),
  };
}
