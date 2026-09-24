import assert from "node:assert/strict";
import test from "node:test";
import { emptyForm, formFromRules, limitUsedPercent, profileFromForm, propChartGeometry, propGuidance, verdictHeadline } from "../src/components/prop/prop-model.ts";
import type { PropEvaluation, PropRules } from "../src/types.ts";

const rules: PropRules = {
  name: "P", account_size: "10000", daily_loss_limit: { kind: "PERCENT", value: "5" }, daily_loss_basis: "INITIAL_BALANCE", start_of_day_reference: "HIGHER_OF_BALANCE_AND_EQUITY",
  overall_loss_limit: { kind: "AMOUNT", value: "1000" }, overall_loss_mode: "TRAILING", trailing_reference: "EQUITY_HIGH", profit_target: null,
  minimum_trading_days: 4, maximum_calendar_days: null, reset: { kind: "FIRM_RESET", time: "00:00", zone: "Europe/Prague" }, breach_on: "EQUITY_TOUCH",
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
