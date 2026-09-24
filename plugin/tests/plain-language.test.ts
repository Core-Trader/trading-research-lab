import assert from "node:assert/strict";
import test from "node:test";
import { CODE_TEXT, plain, plainSentence } from "../src/components/plain-language.ts";

test("known codes show their meaning, never the code", () => {
  assert.equal(plain("MT5_VERIFIED"), "Confirmed by the MT5 report");
  assert.equal(plain("MT5_VERIFIED_CLOSE_EVENTS"), "Closed trades as recorded in the MT5 report");
  for (const [code, text] of Object.entries(CODE_TEXT)) {
    assert.ok(text.length > 0 && !text.includes("_"), `${code} has a plain meaning`);
  }
});

test("unknown codes become words; ordinary text and empties pass through safely", () => {
  assert.equal(plain("GAP_UNDETERMINED"), "Gap undetermined");
  assert.equal(plain("Every tick based on real ticks"), "Every tick based on real ticks");
  assert.equal(plain(null), "—");
});

test("codes inside sentences are replaced, keeping the rest of the sentence", () => {
  assert.equal(plainSentence("Basis: MT5_VERIFIED_CLOSE_EVENTS only."), "Basis: closed trades as recorded in the MT5 report only.");
  assert.equal(plainSentence("No codes here, MT5 and EA stay."), "No codes here, MT5 and EA stay.");
  assert.doesNotMatch(plainSentence("Mode USER_SUPPLIED and HEDGING_X"), /_/);
});

// Every code the Core sends to a displayed basis, quality or status field has a written meaning.
test("the codes shown on screen are all in the dictionary", () => {
  const shown = ["MT5_VERIFIED", "INFERRED", "UNPAIRED", "AMBIGUOUS", "USER_SUPPLIED", "MT5_VERIFIED_CLOSE_EVENTS", "MT5_VERIFIED_CLOSE_EVENTS_NET_PNL",
    "VERIFIED_CLOSE_EVENTS", "REPORTED_BALANCE_AND_VERIFIED_CLOSE_EVENTS", "INFERRED_LIFECYCLES", "REALISED_BALANCE_ONLY", "COMBINED_REALISED_BALANCE",
    "COMBINED_REALISED_BALANCE_AS_REPORTED", "SOURCE_REPORTED_CLOCK", "VERIFIED", "CHECKING", "MANAGED_SNAPSHOT", "UNAVAILABLE", "HEDGING",
    "REPORT_CLOCK_MIDNIGHT", "FIRM_RESET", "ORDER_PERMUTATION_WITHOUT_REPLACEMENT", "VALID", "NOT_VALID", "UNCHECKED", "TOO_FEW", "TOO_FEW_TRADES", "NO_VARIATION"];
  for (const code of shown) assert.ok(code in CODE_TEXT, code);
});
