# Step 2 — Source Data Intake and Baseline Definition

**Status:** Ready for owner review  
**Objective:** Select the first representative MT5 exports and freeze the assumptions required for a testable import/replay baseline.  
**No application code is authorized by this step.**

## Outcome

At the end of Step 2, the project will have an approved input manifest and a written baseline scenario. This lets Step 3 implement one narrow importer against real, known data rather than a generic format imagined in advance.

## What the owner must review manually

Complete and approve every item below before sharing/copying source files into the project. This is intentionally manual because only the owner can confirm the identity, confidentiality, and meaning of their trading data.

### 1. Choose representative exports

Select **one to three** MT5 backtest exports that are safe to use for development.

| Priority | Required characteristic | Owner confirmation |
| --- | --- | --- |
| First | One small, completed single-strategy test with a known final balance/net profit | [ ] |
| Second | A test containing more than one trade and at least one cost field, if available | [ ] |
| Optional third | A test with an open-position/equity or overnight scenario, if the export exposes it | [ ] |

For each selected export, record its original filename, export type (`HTML`, `CSV`, or EA-generated CSV), MT5 terminal/broker context if relevant, symbol, timeframe, date range, deposit/currency, leverage, and whether it is a hedging or netting test if known. Do not edit the original file.

### 2. Review data safety

- Confirm that the files contain no credentials, account numbers, personal information, or material you cannot keep locally in this project.
- Confirm that the project’s `data/raw/` directory is local/offline if the project later lives under a sync provider.
- Confirm whether the exports may be retained as local test fixtures. If not, supply only anonymised/synthetic fixtures and keep a private reconciliation record outside Git.

### 3. Choose the first baseline account scenario

Fill in and approve these values; `unknown` is acceptable when it blocks a metric rather than being guessed.

| Field | Value | Manual review required |
| --- | --- | --- |
| Account currency |  | [ ] |
| Opening balance |  | [ ] |
| Leverage |  | [ ] |
| Margin model | `defer` / documented value | [ ] |
| Currency-conversion policy | `not supported in baseline` / documented value | [ ] |
| Cost convention in source | unknown / included / excluded / mixed | [ ] |

### 4. Choose the initial daily-drawdown policy

This definition is required before presenting any daily-risk result.

| Field | Baseline choice | Manual review required |
| --- | --- | --- |
| Policy name/version | e.g. `research-daily-dd-v1` | [ ] |
| Timezone |  | [ ] |
| Daily reset time in that timezone |  | [ ] |
| Baseline | opening-of-day balance / opening-of-day equity | [ ] |
| P/L treatment | realised only / realised plus floating | [ ] |
| Observation timing | available event/mark checkpoints / day close only | [ ] |

The baseline is a research policy, not a claim that it matches a particular prop firm.

### 5. Define expected reference totals

For the first chosen test, manually copy the values displayed by MT5 where available:

| Reference value | Source value | Manual review required |
| --- | --- | --- |
| Number of completed trades |  | [ ] |
| Gross profit/loss convention |  | [ ] |
| Commission |  | [ ] |
| Swap |  | [ ] |
| Net profit |  | [ ] |
| Final balance |  | [ ] |
| Reported maximum drawdown and its type |  | [ ] |

Record exact labels from the report. Do not normalize or reinterpret values at this stage.

## Handoff package for Step 3

After manual approval, place copies—not originals—of approved exports in the local, ignored intake folder:

```text
C:\DEV\Trading_Research_Lab\data\raw\
```

Do not rename, edit, or commit the export copies. Provide the following alongside them in your message or a separate non-sensitive intake note:

```text
Selected export filenames:
Export format:
Confidentiality/retention decision:
Baseline account values:
Daily-drawdown policy values:
MT5 reference totals:
Known ambiguities or missing fields:
```

## Step 2 exit criteria

- The owner has manually reviewed and approved the selected export(s), data-retention choice, baseline account scenario, daily-drawdown policy, and MT5 reference totals.
- At least one export has a known layout and a reconciliable completed-trade baseline.
- Any unknown item is explicitly marked as a blocker or limitation.

## Next step

Step 3 will specify and implement only the smallest importer needed for the approved first export layout, together with its fixture tests and data-quality report. It will not claim support for other MT5 layouts until separately verified.
