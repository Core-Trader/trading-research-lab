/**
 * Plain meanings for the Core's codes (UIX-5). The Core keeps its codes for
 * the protocol and tests; the screen shows what they mean, with the exact code
 * on hover for traceability. Meanings follow DATA_MODEL.md and the milestone
 * specifications.
 */
export const CODE_TEXT: Record<string, string> = {
  // Data quality (DATA_MODEL.md; MILESTONE_2_TRADE_EVENT_ANALYSIS.md)
  MT5_VERIFIED: "Confirmed by the MT5 report",
  INFERRED: "Reconstructed by TRL (not stated in the report)",
  UNPAIRED: "No matching open or close found",
  AMBIGUOUS: "More than one reading possible",
  USER_SUPPLIED: "Declared by you",
  DECLARED: "Declared by you",
  MT5_REPORTED: "As reported by MT5",
  // What a calculation is based on
  MT5_VERIFIED_CLOSE_EVENTS: "Closed trades as recorded in the MT5 report",
  MT5_VERIFIED_CLOSE_EVENTS_NET_PNL: "Closed trades as recorded in the MT5 report, net of commission and swap",
  VERIFIED_CLOSE_EVENTS: "Closed trades as recorded in the MT5 report",
  REPORTED_BALANCE_AND_VERIFIED_CLOSE_EVENTS: "The report's balance after each deal, and its closed trades",
  REPORTED_BALANCE_SOURCE_ORDER: "The report's balance after each deal, in report order",
  INFERRED_LIFECYCLES: "Trades rebuilt by TRL from opening and closing deals",
  REALISED_BALANCE_ONLY: "Closed-trade balance only (floating losses not included)",
  COMBINED_REALISED_BALANCE: "Combined closed-trade balance of the selected reports",
  COMBINED_REALISED_BALANCE_AS_REPORTED: "Combined closed-trade balance, as reported",
  INTRATRADE_EQUITY: "Equity including open positions (from the TRL equity log)",
  SOURCE_REPORTED_CLOCK: "The report's own clock (no time-zone conversion)",
  // Snapshots and availability
  VERIFIED: "Verified",
  CHECKING: "Checking…",
  MANAGED_SNAPSHOT: "An unchanged copy of your file, kept by TRL",
  AVAILABLE: "Available",
  UNAVAILABLE: "Not available",
  BLOCKED: "Blocked",
  DECLARED_NOT_VERIFIABLE: "Declared by you; the file cannot confirm it",
  // Account and day boundaries
  HEDGING: "Hedging account",
  NETTING: "Netting account",
  REPORT_CLOCK_MIDNIGHT: "Midnight on the report's clock",
  FIRM_RESET: "The firm's daily reset time",
  // Methods
  ORDER_PERMUTATION_WITHOUT_REPLACEMENT: "Reordering the actual trades (each used once per path)",
  // Significance (PROPOSAL_SIGNIFICANCE.md)
  VALID: "The randomness check passed",
  NOT_VALID: "Not valid for this report: wins and losses are not in random order",
  UNCHECKED: "Too few wins or losses to check randomness",
  NOT_AVAILABLE: "Not available",
  TOO_FEW: "Too few wins or losses to check",
  TOO_FEW_TRADES: "Too few trades",
  NO_VARIATION: "Every trade had the same result",
  RANDOMNESS_REJECTED: "Wins and losses are not in random order",
  NOT_REJECTED: "No sign of a pattern in wins and losses",
};

/** The plain meaning of a code; an unknown code is shown as words, never with underscores. */
export function plain(code: string | null | undefined): string {
  if (code === null || code === undefined || code === "") return "—";
  const known = CODE_TEXT[code];
  if (known) return known;
  if (!/^[A-Z0-9_]+$/.test(code)) return code;
  const words = code.toLowerCase().split("_").filter(Boolean).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Hover text that keeps the exact code for traceability. */
export const codeTitle = (code: string | null | undefined): string | undefined => code ? `TRL code: ${code}` : undefined;

/** Replaces codes inside a sentence (for example a Core warning) with their plain meaning. */
export function plainSentence(text: string): string {
  return text.replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g, (code) => { const text = plain(code); return text.charAt(0).toLowerCase() + text.slice(1); });
}
