# Forensic Position Audit Export — Schema and Privacy Review

**Status:** Proposed v0.1 — no exporter exists yet.  
**Purpose:** Create a trusted MT5 reference dataset for validating future
position/trade pairing. It is not a required input for ordinary app use.

## Proposed local location

Until the owner approves otherwise, forensic artifacts would be written only to:

```text
C:\DEV\Trading_Research_Lab\data\raw\forensic\
```

This path is already under the locally retained, Git-ignored raw-data area.
No artifact is uploaded, committed, or copied into project documentation.

**Owner-approved 2026-09-20:** This location is approved for forensic artifacts.

## MT5 tester staging requirement

The approved project location is the **retained** location, not a direct MQL5
write target. MT5 file APIs are restricted to the terminal/tester file sandbox;
in a Strategy Tester run, the local agent sandbox may be temporary. The
forensic exporter must therefore write first to the MT5 shared file sandbox
using `FILE_COMMON` and the relative subfolder:

```text
TradingResearchLab\forensic\
```

The exporter must report the resolved shared-folder path from MT5 at run time;
it must not hard-code a Windows user profile path and must not use DLLs, shell
commands, symbolic links, or any mechanism that bypasses the MT5 sandbox.

After a successful test, the local app's explicit forensic-intake action copies
the selected artifacts from this staging area into the approved retained
location, computes their SHA-256 values, and creates the binding record. The
source staging artifact is never changed by intake.

This staging arrangement is proposed and awaits owner approval before the
exporter is created.

## Artifact set

One completed test run produces two files with the same locally generated
`audit_run_id` in the MT5 shared staging subfolder:

```text
position-audit-<audit_run_id>.csv
position-audit-<audit_run_id>.manifest.json
```

The regular MT5 Excel report remains separate. After the user provides both
files, the application may create a derived binding record that hashes the
Excel report and audit artifacts together. The forensic exporter does not claim
to know the SHA-256 of an Excel report that MT5 creates separately.

## CSV schema: one row per MT5 Deal

All numeric identifiers are serialized as text to avoid loss of precision in
spreadsheet tools. Money, volume, and price are decimal strings, never binary
floating-point values in the file contract.

| Column | Required | Example / type | Purpose |
| --- | --- | --- | --- |
| `schema_version` | Yes | `trading-research-lab.position-audit.v0.1` | Parser contract |
| `audit_run_id` | Yes | UUID/text | Links CSV and manifest |
| `deal_ticket` | Yes | text integer | MT5 Deal identifier |
| `order_ticket` | Yes when MT5 supplies it | text integer | Associated MT5 Order |
| `position_id` | Yes for trading deals | text integer | MT5 `DEAL_POSITION_ID`; the verified grouping key |
| `time_server_text` | Yes | `YYYY.MM.DD HH:MM:SS` | Original MT5 server-clock time |
| `time_msc_epoch` | Yes when MT5 supplies it | text integer | MT5 execution time in milliseconds |
| `deal_type` | Yes | `BUY`, `SELL`, `BALANCE`, etc. | MT5 Deal type |
| `deal_entry` | Yes when applicable | `IN`, `OUT`, `INOUT`, `OUT_BY` | MT5 position effect |
| `symbol` | Yes for trading deals | text | Instrument |
| `volume` | Yes for trading deals | decimal string | Executed volume |
| `price` | Yes for trading deals | decimal string | Executed price |
| `commission` | Yes | decimal string | Source-signed component |
| `swap` | Yes | decimal string | Source-signed component |
| `profit` | Yes | decimal string | MT5 Deal profit component |
| `fee` | Yes when MT5 supplies it | decimal string | Separate MT5 fee component |
| `magic` | Optional | text integer | EA strategy identifier for filtering |
| `reason` | Optional | MT5 enum text | Execution source/reason |
| `comment_state` | Yes | `OMITTED` or `HASHED` | Comment privacy treatment |
| `comment_value` | Conditional | empty or local hash | Never raw comment under the default profile |

The exporter must emit a header even for an empty result and must fail visibly
on file-write error. It must never fabricate a Position ID or replace an absent
field with zero.

## Manifest schema

The JSON manifest holds run-level context once, rather than repeating it in each
Deal row:

| Field | Required | Default privacy treatment |
| --- | --- | --- |
| `schema_version`, `audit_run_id`, `created_at_utc` | Yes | Retained |
| `exporter_name`, `exporter_version` | Yes | Retained |
| `terminal_build`, `account_company`, `terminal_server` | Yes | Retained; server may be masked if owner chooses |
| `account_margin_mode`, `account_hedge_allowed` | Yes | Retained |
| `account_currency`, `account_leverage` | Yes | Retained |
| `test_symbol`, `test_period`, `deal_history_start`, `deal_history_end` | Yes | Retained; these describe exported Deal-history coverage, not a claim of the full tester configuration |
| `ea_display_name`, `ea_source_sha256` | Required when available | Retained; source hash is supplied/bound outside the frozen EA if needed |
| `privacy_profile` | Yes | Retained |
| `csv_sha256` | Yes | Retained |

The binding record created by the app later adds the regular report filename and
SHA-256. It does not alter either raw artifact.

## Privacy and redaction policy — proposed default

### Never export

- account login/number, account holder name, email, password, investor password,
  credentials, terminal data paths, or IP/network information;
- raw trade comments, unless the owner deliberately changes the profile;
- screenshots, journals, `.set` files, chart templates, or unrelated history.

### Retain locally only

- Deal, Order, and Position identifiers;
- server, symbol, timestamps, price/volume, and financial Deal components;
- optional Magic number and execution reason.

These can reveal trading activity, so the artifacts remain under the ignored
local raw-data directory and must never be committed.

### Comment handling

Default profile: `OMITTED`; `comment_value` is blank. A future `HASHED` profile
may store a deterministic local SHA-256 of a comment only when equality testing
is required. Raw comments are out of scope for v0.1.

**Owner-approved 2026-09-20:** The `OMITTED` default is approved. Retaining the
server name, Magic number, Deal/Order/Position IDs, and execution reason locally
under this privacy profile is also approved.

## Non-interference requirements

The forensic copy must:

1. preserve all original strategy inputs and trading logic;
2. never send an order, modify an order, close a position, or alter a trade;
3. write only after the test has completed;
4. produce no output if the run is not explicitly configured for forensic audit;
5. retain a clear version and source-baseline identity.

## Review decisions requested before implementation

1. **Approved 2026-09-20:** `C:\DEV\Trading_Research_Lab\data\raw\forensic\`
   is the local storage location.
2. **Approved 2026-09-20:** Trade comments are `OMITTED` by default.
3. **Approved 2026-09-20:** Retain server name, Magic number,
   Deal/Order/Position IDs, and execution reason locally as described.
4. **Approved 2026-09-20:** The app may bind an audit artifact to its regular
   Excel report by hashes after import.
5. **Approved 2026-09-20:** Use the MT5 `FILE_COMMON` shared sandbox under
   `TradingResearchLab\forensic\` as the temporary tester-output staging area.
