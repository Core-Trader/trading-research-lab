import type { SignificanceConfidence } from "../types.ts";

/**
 * The user's own research thresholds (PROPOSAL_SIGNIFICANCE.md G2, G5), kept in
 * the plugin settings. No threshold has a default number: the minimum trades
 * warning is off until the user sets it, and 95 % is the owner's preselected
 * workflow choice for the confidence level (a convention, not a sourced value).
 */
/** showGuidance: the "How to read this · tips" blocks across TRL (one switch; the wording lives in the *-model.ts guidance functions). */
export type ResearchPreferences = { minTrades: number | null; confidence: SignificanceConfidence; showGuidance: boolean };

export const DEFAULT_THRESHOLDS: ResearchPreferences = { minTrades: null, confidence: "0.95", showGuidance: true };
export const CONFIDENCE_OPTIONS: readonly SignificanceConfidence[] = ["0.90", "0.95", "0.99"];

export function readThresholds(value: unknown): ResearchPreferences {
  if (typeof value !== "object" || value === null) return DEFAULT_THRESHOLDS;
  const { minTrades, confidence, showGuidance } = value as { minTrades?: unknown; confidence?: unknown; showGuidance?: unknown };
  return {
    minTrades: typeof minTrades === "number" && Number.isInteger(minTrades) && minTrades > 0 ? minTrades : null,
    confidence: CONFIDENCE_OPTIONS.includes(confidence as SignificanceConfidence) ? confidence as SignificanceConfidence : DEFAULT_THRESHOLDS.confidence,
    showGuidance: showGuidance !== false,
  };
}

/** Parses what the user typed for the minimum; empty means "no minimum". Returns undefined when invalid. */
export function parseMinTrades(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  return /^\d+$/.test(trimmed) && Number(trimmed) > 0 ? Number(trimmed) : undefined;
}

/** True when a result rests on fewer trades than the user's own minimum. */
export function belowMinimum(trades: number | null | undefined, minimum: number | null): boolean {
  return minimum !== null && trades !== null && trades !== undefined && trades < minimum;
}

export class ThresholdStore {
  private value: ResearchPreferences;
  private readonly listeners = new Set<() => void>();
  private readonly persist: (value: ResearchPreferences) => Promise<void>;

  constructor(initial: unknown, persist: (value: ResearchPreferences) => Promise<void>) {
    this.value = readThresholds(initial);
    this.persist = persist;
  }

  get snapshot(): ResearchPreferences { return this.value; }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  set(next: Partial<ResearchPreferences>): void {
    this.value = readThresholds({ ...this.value, ...next });
    this.listeners.forEach((listener) => listener());
    void this.persist(this.value).catch(() => undefined);
  }
}
