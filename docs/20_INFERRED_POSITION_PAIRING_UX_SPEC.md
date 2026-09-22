# Inferred Position Pairing — User Experience Specification

**Status:** Proposed v0.1 — no interface or pairing algorithm exists yet.

## Purpose

Regular MT5 Excel exports are the normal working files. In a hedging account,
those files may lack the Position IDs needed to prove which open position an
exit affected. When a later approved pairing algorithm can form a useful group
without that evidence, the application may show it only as `INFERRED`.

`INFERRED` means: “constructed by this app's documented pairing policy from the
available report rows.” It never means “confirmed by MT5.”

## Required presentation

Every inferred trade/position result must show this status at the result level,
not merely in a hidden help page:

```text
Trade grouping: INFERRED
Source: Regular MT5 Excel report — no MT5 Position ID supplied
Method: <versioned pairing policy ID>
Interpretation: Useful analytical reconstruction; not MT5-verified.
```

The result detail view must link to its contributing Deal events and display:

- the source report SHA-256;
- every included Deal ticket and source sequence;
- the declared account mode and its evidence state, for example
  `HEDGING / DECLARED`;
- the pairing policy ID/version;
- why the result is inferred rather than verified.

## Summary states

| Status | Meaning | UI treatment |
| --- | --- | --- |
| `MT5_VERIFIED` | Every group has linked MT5 Position-ID evidence | Green/positive quality badge, with audit-artifact link |
| `INFERRED` | Group formed by an approved deterministic policy without Position ID | Amber warning badge and mandatory explanatory text |
| `UNPAIRED` | No approved policy could form a defensible group | Neutral/blocked badge; retain Deal-level analytics only |
| `AMBIGUOUS` | More than one permitted pairing is possible | Red attention badge; never silently select one |

Colour is supplementary only; the status text and explanation are always shown.

## Example result card

```text
EURUSD reconstructed position
Status: INFERRED
Account mode: HEDGING / DECLARED
Pairing policy: <policy ID>
Included events: 4
Evidence: Regular MT5 Excel report only

This grouping was reconstructed from Deal rows. MT5 Position ID was not
available, so it is not a confirmed MT5 position lifecycle.

[View source events]  [Why inferred?]
```

## Non-negotiable behaviour

1. Never mix `MT5_VERIFIED` and `INFERRED` results in a single aggregate without
   exposing counts and quality breakdowns.
2. Never label an inferred result “actual,” “confirmed,” or “reproduced from
   MT5.”
3. Keep event-level balance, cash, and risk outputs available even if pairing is
   unpaired or ambiguous.
4. Preserve the exact versioned pairing policy and input hashes in every saved
   result.
5. Do not implement a pairing policy until its algorithm, ambiguity conditions,
   and regression fixtures are separately approved.

## Manual review decisions requested before implementation

1. **Approved 2026-09-20:** Use `MT5_VERIFIED`, `INFERRED`, `UNPAIRED`, and
   `AMBIGUOUS` as the status words.
2. **Approved 2026-09-20:** Use the warning text in the example card.
3. **Approved 2026-09-20:** Inferred results may appear in headline performance
   summaries by default, provided their quality status and breakdown remain
   visible.
4. Review the eventual pairing policy specification before any calculations or
   interface are built.
