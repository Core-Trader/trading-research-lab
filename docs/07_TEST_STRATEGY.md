# Test Strategy

## Philosophy

Financial tests specify expected behavior before implementation. Tests are evidence, not a substitute for the written semantics or real-source reconciliation.

## Test layers

| Layer | Purpose | Examples |
| --- | --- | --- |
| Unit | Small domain rules | drawdown peak update, commission signs, daily reset boundary |
| Scenario | Ordered event sequences | simultaneous opens, close after midnight, mixed strategy events |
| Property | General invariants | deterministic ordering; equity equals balance plus unrealised P/L |
| Import fixture | Parser behavior | known MT5 layouts, locale/date formats, rejected unsupported data |
| Reconciliation | Real representative exports | source totals vs normalised outputs |
| Integration | Local API/database boundaries | persisted run can be retrieved unchanged |
| End-to-end | Browser workflow | visible warning/evidence navigation |

## Required initial scenarios

| ID | Scenario | Required assertion |
| --- | --- | --- |
| REPLAY-001 | Single completed trade with explicit source-signed costs | final balance equals gross P/L plus commission plus swap |
| REPLAY-002 | Two strategies, interleaved opens/closes | stable order and expected account ledger |
| REPLAY-003 | Same timestamp events | persisted ordering tuple controls result |
| REPLAY-004 | Open position with mark | equity reflects balance plus unrealised P/L |
| REPLAY-005 | Open position without permitted mark | equity metric warns/blocks by policy |
| RISK-001 | Equity falls below a prior peak | max drawdown amount and percent are correct |
| RISK-002 | Position spans daily reset | policy timezone/reset/baseline determine daily result |
| RISK-003 | Floating loss breaches then recovers | continuous-check policy records worst observation |
| DET-001 | Identical manifest runs twice | canonical ledgers and result hashes match |
| IMPORT-001 | Representative MT5 export | expected mappings and source totals are proven |
| IMPORT-002 | USDJPY Deal prices with three-decimal source display format | imported decimals and source scale preserve the report values without float rounding |
| OPT-001 | Multi-symbol optimizer XML summary | importer recognizes summary-only rows and rejects it as replay-event input |

## Fixtures

Synthetic fixtures are small, readable, hand-calculated, and checked into version control. Proprietary real exports remain local and are referenced by hashes/secure instructions, not committed. Each real reconciliation fixture needs a documented consent and retention decision.

## Invariants

- Balance changes only through defined cash-affecting events.
- Every ledger entry links to an input event or an explicit checkpoint reason.
- Event sequence numbers are contiguous and unique per run.
- A reported maximum points to a ledger observation.
- Re-running a manifest does not mutate historical run output.

## Release gate for a financial-rule change

Update its specification, add/adjust a focused regression test, demonstrate determinism, record any changed expected outputs, and add a development-log entry. A change that breaks reconciliation cannot ship as an unqualified improvement.
