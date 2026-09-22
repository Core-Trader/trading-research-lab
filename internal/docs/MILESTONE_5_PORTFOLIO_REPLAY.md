# Milestone 5 — Sequential Same-Account Balance Analysis Specification

**Status:** Closed; bounded implementation and owner-panel validation completed
on 2026-09-21.  
**Depends on:** Milestones 1–4 closure reports.  
**Purpose:** define an evidence-qualified common balance analysis for a
user-selected sequence of MT5 Strategy Tester Excel reports from one account.

## Confirmed initial scope

M5 initially supports only sequential reports from one account. It does not
support multiple accounts, pooled/shared capital across strategies, or general
portfolio construction. Those are future extensions and must not be inferred
from this baseline.

Every selected `.xlsx` report remains a separate M1 source: it has its own
source hash, managed raw snapshot, canonical dataset, intake receipt, and
limitations. A combined result is a new derived artifact that references those
sources; it is never a replacement or silent concatenation of them.

## Implemented workflow

1. The user explicitly selects one or more `.xlsx` reports as a proposed batch.
2. The Core intakes or reuses each source independently under M1 rules.
3. The Core produces a reviewable batch preflight: member identities, reported
   time coverage, ordering candidate, duplicate/overlap/gap findings,
   compatibility findings, and unavailable evidence.
4. The user reviews the preflight and explicitly confirms the batch basis.
5. Only an eligible batch may use the separate explicit action to create a
   versioned combined-balance artifact and its
   manifest. Research-document creation remains a separate explicit action.
6. Once the explicit artifact exists, the Core may produce qualified
   source-clock daily realised-balance drawdown. It does not make an equity,
   prop-firm, or continuous-coverage claim.

The future UI may orchestrate these steps to reduce repetitive clicks, but it
must show progress and retain each evidence boundary. It must never create a
combined analysis or research document merely because files were selected.

## Evidence and qualification rules

- The one-account claim is `USER_SUPPLIED` unless regular source reports expose
  a stable account identifier that the Core can retain and compare. It must not
  be displayed as source-verified solely because reports were selected together.
- Report ordering uses source-reported times and event order only; it makes no
  timezone conversion or broker-time claim.
- A batch preflight must distinguish identical source files, potentially
  duplicate events, overlapping coverage, and gaps. None may be silently
  removed or ignored.
- Currency, report-clock, and balance-series compatibility must be reported
  before a common monetary balance result is available. Unsupported conversion
  blocks that result rather than estimating one.
- M3's current intratrade-equity limitation remains: a regular Deals export does
  not make a combined intratrade equity curve or equity drawdown available.
- Combined realised-balance/daily-risk output must expose its source membership,
  ordering rule, continuity/coverage qualification, and any user-supplied
  assumptions.

## Storage and IPC boundary

The Python Core—not TypeScript—owns batch validation and
calculations. It will write a versioned JSON batch manifest and any high-volume
derived tables as Parquet in a bounded workspace. The manifest must identify:

- a deterministic batch identity and schema/calculation versions;
- ordered member dataset/source identities and hashes;
- user-supplied account declaration and aggregation intent;
- compatibility, overlap, duplicate, and gap findings;
- selected/declared ordering and capital rules;
- result availability, warnings, and derived artifact hashes.

The implementation uses versioned local IPC for preflight, explicit artifact
creation, and qualified daily drawdown. High-volume output remains a bounded
Parquet artifact with a JSON manifest; IPC returns compact summaries only.

## Locked implementation decisions

1. **Same-account declaration:** `USER_SUPPLIED_SINGLE_ACCOUNT` is shown unless
   the source itself establishes a stable account identity.
2. **Order:** chronological source-event order is required; no user ordering
   override exists in the initial scope.
3. **Overlaps/duplicates:** coverage overlap blocks; a repeated deal ID in a
   non-overlapping report is a visible warning; an exact source-time + deal-ID
   event collision blocks.
4. **Gaps:** a gap permits the bounded combined result but emits
   `GAP_UNDETERMINED`; it does not establish continuous coverage.
5. **Capital continuity:** the next reported opening balance must exactly equal
   the prior final reported balance; otherwise the batch blocks. Funding is not
   inferred.
6. **Compatibility:** one currency and one source-report clock basis are
   required; no conversion is attempted.
7. **Output:** source-clock realised-balance daily drawdown is available only
   from an eligible sequential batch. Equity and prop-firm results remain
   unavailable.

## Explicit exclusions

Multi-account aggregation, shared-capital portfolios, currency conversion,
broker execution, inferred deposits/withdrawals, intratrade equity, equity-based
drawdown, prop-firm compliance, optimisation, Monte Carlo, and automatic vault
or folder scanning are out of scope.
