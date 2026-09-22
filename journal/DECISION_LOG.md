# Decision Log

## DL-001 — Local-first V1

**Date:** 2026-09-20  
**Decision:** Build a single-user local application first.  
**Why:** The initial objective is personal research with reproducibility and private source data, not hosted collaboration.  
**Reconsider when:** Multiple concurrent users, remote access, or centralized data management become an approved requirement.

## DL-002 — SQLite as V1 system of record

**Date:** 2026-09-20  
**Decision:** Use SQLite for persisted V1 state.  
**Why:** It supports local, single-user, portable storage with minimal operations burden.  
**Reconsider when:** Concurrency, server deployment, or dataset scale demonstrably exceed the chosen SQLite access model.

## DL-003 — Daily drawdown is configurable

**Date:** 2026-09-20  
**Decision:** Persist a versioned daily-drawdown policy with every result.  
**Why:** Baseline, reset timezone/time, and floating-P/L treatment vary by use case and rule provider.  
**Reconsider when:** Never remove provenance; add policies only with documented semantics.

## DL-004 — Preserve source-signed cash components

**Date:** 2026-09-20  
**Decision:** Canonical commission, swap, and cash-adjustment values retain their source signs; net realised P/L is their sum with gross realised P/L.  
**Why:** The sampled EURUSD report shows `8.10` profit plus `-0.20` swap producing a `7.90` balance increase. Negating already-negative costs would overstate P/L.  
**Reconsider when:** A future adapter uses an incompatible source convention; then convert only at that adapter boundary and record the mapping.

## DL-005 — Defer daily-drawdown calculation

**Date:** 2026-09-20  
**Decision:** Exclude daily-drawdown output from Step 3 acceptance criteria.  
**Why:** The stored report timestamps omit an explicit timezone and the owner has not selected a daily reset convention. Any daily-risk number now would be an unapproved assumption.  
**Reconsider when:** The owner approves timezone, reset time, baseline, and realised/floating treatment in a versioned policy.

## DL-006 — Preserve source price scale

**Date:** 2026-09-20  
**Decision:** Preserve decimal price values and source display/precision metadata without hard-coded per-symbol scales.  
**Why:** The USDJPY Deals report uses a three-decimal display format, showing that a universal five-decimal FX convention would corrupt or misrepresent source data.  
**Reconsider when:** A source provides authoritative instrument metadata; record that source and retain raw report provenance.

## DL-007 — Use Prague midnight for the FTMO-reference policy

**Date:** 2026-09-20  
**Decision:** Use `Europe/Prague` with a 00:00:00 local reset as the authoritative daily-risk calculation clock for `ftmo-reference-daily-loss-v0.1`; use Europe/Lisbon for display only.  
**Why:** FTMO’s published guidance describes maximum daily loss as resetting at midnight CE(S)T/Prague time and evaluates equity including floating P/L, commissions, and swaps.  
**Constraint:** Current RoboForex report timestamps have no confirmed timezone. No daily result may be produced until a source-time/DST mapping exists.  
**Reconsider when:** An account-specific FTMO rule set, platform policy, or source timestamp evidence requires a versioned policy change.

## DL-008 — Make prop-firm analysis optional

**Date:** 2026-09-20  
**Decision:** Run broker-native analysis by default and apply prop-firm rules only as optional, versioned scenario overlays.  
**Why:** The initial EA/report work is for a standard RoboForex account, but the same EA may later be evaluated against different prop-firm rules. Conflating these models would make ordinary broker analysis depend on a challenge policy.  
**Constraint:** Any calendar-based overlay requires a sufficient broker-time profile for the imported timestamps.  
**Reconsider when:** Never remove the broker-native mode; add overlays only through explicit, versioned rule sets.

## DL-009 — Use RoboForex EET/EEST for current Forex report timestamps

**Date:** 2026-09-20  
**Decision:** Use `roboforex-eet-eest-v0.1`: UTC+2 standard time and UTC+3 summer time, with date-aware DST conversion, for the current RoboForex Forex reports.  
**Why:** RoboForex publishes this server-time convention and the owner confirmed it.  
**Constraint:** Temporary US/Europe daylight-saving differences affect US-asset trading-session hours, not the Forex timestamp clock.  
**Reconsider when:** The broker changes its published server-time policy or a report comes from another broker/server.

## DL-010 — Do not infer trades from MT5 Deals rows

**Date:** 2026-09-20  
**Decision:** Normalise each supported MT5 Deals row into an atomic canonical
event, but do not pair entries and exits into Trade or Position entities.  
**Why:** The reviewed reports do not establish a position identifier or the
account's netting/hedging semantics. Inferring pairs would be unsafe for partial
closes, reversals, and multi-deal executions.  
**Constraint:** A later trade-pairing milestone requires an approved source
contract containing sufficient account and position semantics.  
**Reconsider when:** A documented source export provides the necessary
position-level identifiers and account-mode evidence.

## DL-011 — Treat current account mode as declared hedging evidence

**Date:** 2026-09-20  
**Decision:** Record the current source account mode as `HEDGING` with evidence
state `DECLARED`.  
**Why:** The owner confirmed hedging, while the current Excel reports do not
include MT5's `ACCOUNT_MARGIN_MODE`.  
**Constraint:** Do not treat this declaration as proof for a historical test
run and do not infer one position per symbol.  
**Reconsider when:** A same-run forensic manifest or terminal snapshot provides
verifiable account-mode evidence.

## DL-012 — Allow clearly labelled inferred pairing for ordinary reports

**Date:** 2026-09-20  
**Decision:** A future position/trade view may show a pairing inferred from a
regular MT5 Excel report, provided it is explicitly labelled `INFERRED`.  
**Why:** Ordinary exports are the intended working files, but do not expose the
MT5 Position ID necessary to verify every hedging-account match.  
**Constraint:** Never describe an inferred result as MT5-verified. Block an
inference when the documented algorithm identifies ambiguity it cannot resolve.  
**Reconsider when:** An ordinary MT5 export variant provides the required
Position-ID evidence.

## DL-013 — Approve forensic audit privacy profile and local storage

**Date:** 2026-09-20  
**Decision:** Store forensic artifacts locally under `data/raw/forensic/`; omit
raw trade comments; retain the approved audit identifiers and metadata locally;
and bind audit and regular report artifacts by hashes after import.  
**Why:** This provides the evidence needed for validation while minimizing
sensitive account/trading data and keeping it outside version control.  
**Constraint:** Never export credentials or account-holder information, and
never commit forensic artifacts.  
**Reconsider when:** The privacy profile or local data-retention policy changes.

## DL-014 — Show inferred results in headline summaries with quality disclosure

**Date:** 2026-09-20  
**Decision:** Allow `INFERRED` position/trade results in headline performance
summaries by default, with an always-visible quality status and breakdown.  
**Why:** Regular MT5 Excel exports are the normal working inputs, so hiding all
inferred analytics would make useful analysis unavailable.  
**Constraint:** Never obscure the status, merge it indistinguishably with
`MT5_VERIFIED` results, or claim MT5 verification.  
**Reconsider when:** User research indicates a different default is clearer.

## DL-015 — Use a test-only forensic audit copy for Position-ID evidence

**Date:** 2026-09-20  
**Decision:** Generate Position-ID reference evidence only through the separately
named forensic EA copy, with audit export disabled by default and restricted to
Strategy Tester runs.  
**Why:** This validates later pairing logic without altering the frozen trading
EA or requiring forensic artifacts for ordinary report use.  
**Constraint:** The copy must never modify trades, retain raw comments, bypass
the MT5 file sandbox, or overwrite an existing audit run ID.  
**Reconsider when:** MT5 provides a regular export containing equivalent,
verifiable position-level evidence.
