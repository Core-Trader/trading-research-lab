# Research Methodology

## Claim taxonomy

| Term | Meaning |
| --- | --- |
| Historical fact | Information directly contained in a source import |
| Derived metric | Deterministic calculation from stated inputs and policy |
| Simulation | Projection under explicit model assumptions |
| Stress test | Simulation with deliberately adverse stated assumptions |
| Monte Carlo | Stochastic procedure with a specified method and seed |
| Optimisation | Search result for a stated objective, dataset, and constraints |
| Hypothesis | An unvalidated explanation or expected effect |

Never describe a simulation, optimisation, or hypothesis as a historical fact.

## Experiment protocol

1. State the question and decision it informs.
2. Define the dataset, time period, selection criteria, and exclusions.
3. Freeze the input manifest and calculation configuration.
4. Run the deterministic baseline and save its evidence bundle.
5. Change one documented factor per comparison where practical.
6. Record results, warnings, limitations, and non-comparable conditions.
7. Write conclusions proportional to the evidence; do not generalize beyond the tested sample.

## Portfolio and replay discipline

Independent backtests do not represent the same thing as a shared account. A combined replay may expose overlapping exposure, floating losses, timing conflicts, and different drawdown paths. It is an explicit model result, not automatically the broker's historical record.

## Risk reporting rules

Always show currency, time range, event/mark coverage, equity-vs-balance basis, and daily-drawdown policy. Daily values additionally show the named timezone, reset time, baseline, and treatment of unrealised P/L. Metrics must link to their underlying observations.

## Broker analysis versus prop-firm overlay

Broker-native analysis is the default: it reports what the imported strategy/replay implies for the configured broker account without applying challenge rules. A prop-firm result is a separate optional overlay using a named, versioned rule set and calendar policy. The same strategy may therefore be acceptable under one broker account model and violate a particular prop-firm policy; neither result overrides the other.

## Bias controls

Record data-snooping risk, survivorship/selection constraints, parameter search scope, in-sample/out-of-sample split when later introduced, and all unavailable data. Avoid optimizing against a metric without recording the search budget and selection rule.

## Communication rule

The application supports research and education. It does not predict future returns, provide personal investment advice, or remove the need for independent due diligence.
