# External Reference Register

**Status:** private internal register. External source remains outside Trading
Research Lab and is never included in product artifacts merely because it was
reviewed or permission to reuse was granted.

## Permission record

The project owner reports that each repository developer/owner has granted
direct code-reuse permission. The user retains the original correspondence. No
private correspondence, credentials, or unrelated conversation data is stored
in this repository.

**Permission status:** Direct code reuse approved by repository developer/owner.

**Condition:** At the end of development, provide a complete report identifying
the external code/components actually used in Trading Research Lab.

This record does not invent, replace, or resolve formal repository licence
terms. Every actual reuse remains subject to the mandatory provenance process in
[`EXTERNAL_CODE_USAGE_REGISTER.md`](EXTERNAL_CODE_USAGE_REGISTER.md).

| Reference | Journalit | Strategy Factory |
| --- | --- | --- |
| Repository URL | https://github.com/Cursivez/journalit | https://github.com/moyger/strategy_factory |
| Owner shown by URL | Cursivez | moyger |
| Clone path | C:\DEV\TRL_External_References\journalit | C:\DEV\TRL_External_References\strategy_factory |
| Default branch | main | main |
| Approved reference commit | `098d27747df1b3a5fb177ff3a147d9a5cfbe0dcb` | `31e778a78b465ce1a0e16e232f762ebe8ca80b52` |
| Review date | 2026-09-20 | 2026-09-20 |
| Working tree at review | Clean | Clean |
| Primary TRL role | Obsidian/plugin and trading-dashboard reference | Quantitative/research implementation reference |
| Licence / reuse status | Repository licensing terms remain as observed in the pinned review; direct reuse is approved by developer/owner under the recorded final-report condition. | No repository LICENSE file was found in the pinned review; direct reuse is approved by developer/owner under the recorded final-report condition. |
| Reference use | Approved | Approved |
| Direct code reuse | Approved by developer/owner | Approved by developer/owner |
| Condition | Full final usage report required | Full final usage report required |
| Actual code reuse in TRL | None recorded | None recorded |
| Analysis status | Complete, pinned review. | Complete, pinned review. |

## Analysis records

- [Journalit architecture map](JOURNALIT_ARCHITECTURE_MAP.md)
- Journalit import pipeline concept review (2026-09-23, pinned commit `098d277`; parsing is server-side, so there is no reusable local code; concepts only): see `../docs/MT5_AUTOMATION_AND_IMPORT_REVIEW.md` §2
- [Strategy Factory architecture map](STRATEGY_FACTORY_ARCHITECTURE_MAP.md)
- [Trading Research Lab comparison and findings](TRL_REFERENCE_FINDINGS.md)
- [Authoritative code-usage register](EXTERNAL_CODE_USAGE_REGISTER.md)
- [Future final external-code usage report](EXTERNAL_CODE_USAGE_FINAL_REPORT.md)

## Future-review rule

Do not pull, update, checkout, or silently replace these baselines. If later
work uses a newer source revision, the usage record must name that exact newer
commit. Do not assume a repository's current HEAD supplied the source.

Direct reuse may be technically justified, but is never automatic. Before and
with each reuse: identify the exact repository, commit, source path and symbol;
record the entry immediately; add a concise source comment where appropriate;
validate the TRL result; and record the product scope and any dependencies. No
untracked external code reuse is permitted.

## Prop-firm rule sources (data, not code; PROP-2)

Presets in `research-core/.../prop_presets.py` copy published rule values, not
code. Each preset records its source URL and retrieval date, and the user is
told to verify against the firm's current terms.

| Source | Use | Retrieved | Notes |
| --- | --- | --- | --- |
| https://ftmo.com/en/trading-objectives/ (FTMO, primary) | FTMO 2-Step (Challenge, Verification, Account) and 1-Step (Challenge, Account) values | 2026-09-24 | Authoritative. The values and definitions came from the 1-Step and 2-Step tabs: 00:00 CE(S)T reset, balance-at-reset daily reference, "drops below", position-opened trading day, 1-Step end-of-day trailing loss, and the best-day 50% rule. The cookie banner was not accepted. |
| https://propfirmmatch.com/ (aggregator, secondary) | Finding firms, programme names, and rule-change dates | 2026-09-24 | This is an affiliate site with discount codes. Its FTMO page listed programme structure, trading days, and the best-day rule, but no loss limits. Use it for discovery and cross-checks only; take the preset values from each firm's own rules page. Non-essential cookies were declined. |
| https://fundednext.com/cfd-challenge-terms (FundedNext, primary) and Help Center articles 8019811 (daily-loss formula) and 8394309 (reset at 00:00 server time, GMT+2 or GMT+3) | FundedNext Stellar 2-Step, 1-Step, Lite, and Evaluation presets | 2026-09-24 | The Terms §5.1–§5.4 give the DLL, MLL, minimum Trading Days, and Profit Targets. The DLL and MLL are a % of the initial size; the terms say "reaches or exceeds" (§7.1); a Trading Day is one on which a trade is opened and/or closed (§4.3). The cookie banner offers only accept, so it was left untouched. |
| https://the5ers.com/high-stakes/ (The5ers, primary) | Not used | 2026-09-24 | The page gives 5% daily, 10% max, and 10%/5% targets, but not the daily-loss reference or the reset time. It counts "profitable days" (at least 0.5% closed profit), which TRL does not model. No preset until those are confirmed. "Deny" was clicked on the cookie banner. |
