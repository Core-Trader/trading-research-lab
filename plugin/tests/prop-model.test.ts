import assert from "node:assert/strict";
import test from "node:test";
import { emptyForm, formFromPreset, formFromRules, limitUsedPercent, profileFromForm, propChartGeometry, propGuidance, rollingGuidance, verdictHeadline } from "../src/components/prop/prop-model.ts";
import type { PropEvaluation, PropPreset, PropRolling, PropRules } from "../src/types.ts";

const rules: PropRules = {
  name: "P", account_size: "10000", daily_loss_limit: { kind: "PERCENT", value: "5" }, daily_loss_basis: "INITIAL_BALANCE", start_of_day_reference: "HIGHER_OF_BALANCE_AND_EQUITY",
  overall_loss_limit: { kind: "AMOUNT", value: "1000" }, overall_loss_mode: "TRAILING", trailing_reference: "EQUITY_HIGH", profit_target: null,
  minimum_trading_days: 4, maximum_calendar_days: null, reset: { kind: "FIRM_RESET", time: "00:00", zone: "Europe/Prague" }, breach_on: "EQUITY_TOUCH",
  trading_day_definition: "POSITION_OPENED", limit_touch_counts: false, best_day_max_percent: "50",
};

const result = (overrides: Partial<PropEvaluation> = {}): PropEvaluation => ({
  calculation_version: "prop-check-1",
  profile: { profile_id: "id", profile_hash: "H", name: "P", saved_at: "2026-09-24T00:00:00+00:00", values_source: "USER_SUPPLIED", rules },
  target: { kind: "DATASET", dataset_ref: "mt5:X" }, currency: "USD", evidence_level: "EQUITY_LOGGED",
  day_boundary: { version: "day-boundary-1", kind: "REPORT_CLOCK_MIDNIGHT", report_clock_zone: null, day_label: "" }, account_size: "10000", verdict: "NOT_BROKEN",
  rules: [{ rule: "DAILY_LOSS", verdict: "NOT_BROKEN", limit: { kind: "PERCENT", value: "5" }, basis: "INITIAL_BALANCE", first_breach: null, tightest: { date: "2026-01-19", time: "2026-01-19T00:08:15", headroom: "4906.59", headroom_percent_of_limit: "98.13180000", loss: "93.41", limit: "500" } }],
  profit_target: null, trading_days: { total: 3, definition: "" }, challenge: null, daily: [],
  series: [{ time: "2026-01-01T00:00:00", balance: "10000", equity: "10000", low: "9900", floor: "9000" }, { time: "2026-01-02T00:00:00", balance: "10100", equity: "10050", low: "10000", floor: "9100" }],
  breach_markers: [], findings: [], warnings: [],
  ...overrides,
});

test("profile form round-trips the Core rules and sends only the request shape", () => {
  assert.deepEqual(profileFromForm(formFromRules(rules)), rules);
  const fixed = profileFromForm({ ...emptyForm("100000"), name: "X", dailyKind: "NONE", overallKind: "PERCENT", overallValue: " 10 ", minimumDays: "abc" });
  assert.equal(fixed.daily_loss_limit, null);
  assert.deepEqual(fixed.overall_loss_limit, { kind: "PERCENT", value: "10" });
  assert.equal(fixed.trailing_reference, null);
  assert.equal(fixed.minimum_trading_days, "abc"); // passed through so the Core names the error
});

test("verdict wording follows the evidence level; the verdict is the Core's", () => {
  assert.equal(verdictHeadline(result()), "Not broken in the logged evidence");
  assert.equal(verdictHeadline(result({ evidence_level: "REALISED_ONLY" })), "Optimistic preview (closed trades only): Not broken on closed trades");
  const possibly = result({ verdict: "POSSIBLY_BROKEN", rules: [
    { rule: "OVERALL_LOSS", verdict: "POSSIBLY_BROKEN", limit: { kind: "AMOUNT", value: "250" }, first_breach: { time: "2026-01-04T10:04:59", day: "2026-01-04", value: "19720.00", limit_level: "19750", limit: "250" }, tightest: null, optimistic: { first_breach: null, tightest: { time: "2026-01-04T10:00:00", headroom: "48.00", headroom_percent_of_limit: "19.2" } } },
  ] });
  assert.match(verdictHeadline(possibly), /^Possibly broken on .* \(overall loss rule\)$/);
  assert.ok(propGuidance(possibly).tips.some((tip) => tip.includes("only the conservative bound") && tip.includes("48.00 USD")));
});

test("guidance restates Core headroom and flags missing evidence", () => {
  const guidance = propGuidance(result({ evidence_level: "REALISED_ONLY" }));
  assert.ok(guidance.read.some((line) => line.includes("4906.59 USD (98.13% of the limit) to spare")));
  assert.ok(guidance.tips.some((tip) => tip.includes("hardest day was 2026-01-19") && tip.includes("93.41 USD")));
  assert.ok(guidance.flags.some((flag) => flag.includes("Attach one on the Data page")));
  assert.ok(guidance.flags.some((flag) => flag.includes("resets at midnight broker time")));
});

test("chart geometry and bar heights are display scaling of Core values", () => {
  const geometry = propChartGeometry(result({ breach_markers: [{ rule: "OVERALL_LOSS", time: "2026-01-01T12:00:00" }] }));
  assert.ok(geometry);
  assert.equal(geometry.bottom, 9000);
  assert.equal(geometry.top, 10100);
  assert.equal(geometry.floor!.split(" ").length, 2);
  assert.equal(geometry.markers[0]!.x, 100);
  assert.equal(limitUsedPercent("98.13180000").toFixed(4), "1.8682");
  assert.equal(limitUsedPercent("-50"), 120);
});

test("a preset fills an editable form with the run's account size and remembers its origin", () => {
  const { name: _name, account_size: _size, ...presetRules } = rules;
  const preset = { preset_id: "ftmo-1step-challenge", firm: "FTMO", programme: "FTMO Challenge: 1-Step", phase: "FTMO Challenge", source_url: "https://ftmo.com/en/trading-objectives/", retrieved_at: "2026-09-24", name: "FTMO 1-Step · FTMO Challenge", rules: presetRules, not_modelled: [] } satisfies PropPreset;
  const form = formFromPreset(preset, "100000");
  assert.equal(form.presetId, "ftmo-1step-challenge");
  assert.equal(form.accountSize, "100000");
  assert.deepEqual(profileFromForm(form), { ...rules, name: "FTMO 1-Step · FTMO Challenge", account_size: "100000" });
  assert.equal(profileFromForm({ ...form, bestDay: " " }).best_day_max_percent, null);
});

test("rolling guidance restates the Core summary and never reports a share without decided starts", () => {
  const rolling = (summary: Partial<PropRolling["summary"]>): PropRolling => ({
    calculation_version: "prop-rolling-1", profile: { profile_id: "p", profile_hash: "h", name: "P" }, currency: "USD", evidence_level: "EQUITY_LOGGED", horizon_days: null, mode: "CHALLENGE",
    summary: { starts: 10, decided: 8, counts: { PASSED: 6, BROKEN: 2, NOT_DECIDED: 2 }, success_outcome: "PASSED", success_share_percent: "75.00000000", days_to_pass: { minimum: 3, median: 9, maximum: 20 }, days_to_breach: null, open_at_start: 4, ...summary },
    starts: [], findings: [], warnings: ["W"],
  });
  const guidance = rollingGuidance(rolling({}));
  assert.ok(guidance.read.some((line) => line.includes("6 passed, 2 broken, 2 not decided (data ended)")));
  assert.ok(guidance.read.some((line) => line.startsWith("75.00% of the 8 decided starts passed")));
  assert.ok(guidance.tips.some((tip) => tip.includes("3 to 20 calendar days (median 9)")));
  assert.ok(guidance.flags.some((flag) => flag.startsWith("4 of 10 starts began with positions already open")));
  assert.ok(rollingGuidance(rolling({ decided: 0, success_share_percent: null, counts: { NOT_DECIDED: 10 } })).read.some((line) => line.startsWith("No start reached a decision")));
});
