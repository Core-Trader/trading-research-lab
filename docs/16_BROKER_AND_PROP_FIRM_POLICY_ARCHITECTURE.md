# Broker-Time and Optional Prop-Firm Policy Architecture

## Core principle

The application first analyses imported/replayed strategy behavior under a broker account model. Prop-firm rules are optional, named overlays. A strategy is not a prop-firm strategy by default, and a broker account does not acquire FTMO rules simply because the user later wants a comparison.

```text
Imported events + BrokerTimeProfile + AccountScenario
                        |
                 Broker-native analytics
                        |
          optional PropFirmRuleSet projection
                        |
      policy-specific pass/fail and risk explanation
```

## BrokerTimeProfile

Every importer/replay may attach a versioned broker-time profile. It answers how source timestamps are interpreted; it does not impose a prop-firm calendar.

| Field | Meaning |
| --- | --- |
| `broker_id` / label | Human-readable broker/server identity |
| `server_clock_rule` | IANA timezone when verified, or a versioned standard/DST offset schedule |
| `effective_from` / `effective_to` | Dates for which the rule is valid |
| `timestamp_semantics` | Whether source text represents server-local wall time |
| `evidence` | Broker documentation or manually verified terminal evidence |
| `confidence` | `VERIFIED`, `USER_CONFIRMED`, or `UNVERIFIED` |

### Initial RoboForex Forex profile

RoboForex publishes its server time as EET: UTC+2 in standard time and UTC+3 in summer time. Record the initial profile as `roboforex-eet-eest-v0.1`, confidence `VERIFIED`, with EET/EEST daylight-saving transitions. [RoboForex trading accounts](https://roboforex.com/forex-trading/trading/trading-accounts/)

The profile applies to the current Forex reports. It must use a date-aware timezone implementation and tests at daylight-saving boundaries, never a fixed UTC offset. During the temporary US/Europe transition weeks, US-asset trading sessions may shift relative to server time; represent those as instrument-session schedules, not as a change in the server timestamp clock.

## Optional PropFirmRuleSet

An overlay is selected per replay scenario. It includes provider, product/account type, effective rule version, measurement basis, daily policy, overall-loss policy, thresholds, and evidence source. When omitted, only broker-native analytics run.

### Initial reference overlay

`ftmo-2step-swing-reference-v0.1`:

- Maximum Daily Loss: 5% of initial simulated capital;
- Maximum Loss (overall): 10% of initial simulated capital, static;
- measurement: equity including balance, floating P/L, swaps, and commissions;
- calendar: `ftmo-reference-daily-loss-v0.1`, Prague midnight;
- status: reference only until the exact account/rule version is selected for a future simulation.

## Future policy configuration panel

The future browser UI will provide a prop-firm analysis configuration panel. It selects or creates an overlay without changing broker-native results, imported raw data, or historical replay runs. At a minimum it will show provider/product/version, initial capital, daily/overall thresholds, balance/equity basis, realised/floating treatment, timezone/reset policy, broker-time profile, and policy evidence. A saved policy change creates a new replay analysis result rather than overwriting a prior result.

## Result classifications

| Situation | Result |
| --- | --- |
| No prop-firm overlay attached | `NOT_REQUESTED` |
| Policy attached but source time mapping absent | `NOT_COMPARABLE` |
| Policy and required evidence available | `PASS`, `FAIL`, or `NO_BREACH_OBSERVED` as appropriate |

No classification may be presented as a broker fact when it came from an optional policy overlay.

## Manual review before implementation

- [ ] Confirm a broker-time profile for every broker/server whose reports will be analysed.
- [ ] Verify the actual server-time/DST schedule for historical report dates when calendar-based rules are enabled.
- [ ] Select a specific prop-firm product/account and rule version before treating a reference overlay as a compliance result.
