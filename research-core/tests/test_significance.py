from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from trading_research_core.errors import CoreError
from trading_research_core.performance_metrics import performance_metrics
from trading_research_core.significance import lag1_autocorrelation, normal_quantile, runs_test, significance, student_t_cdf, student_t_quantile, t_test
from trading_research_core.worker import Worker
from test_performance_metrics import _dataset


def D(values: list[str]) -> list[Decimal]:
    return [Decimal(value) for value in values]


# Published Student t table values (two-sided 95 % / one-sided 95 %, etc.).
@pytest.mark.parametrize("probability,df,expected", [(0.975, 1, 12.7062), (0.975, 4, 2.7764), (0.975, 10, 2.2281), (0.95, 20, 1.7247), (0.995, 30, 2.7500), (0.95, 1000, 1.6464)])
def test_t_quantile_matches_tables(probability: float, df: int, expected: float) -> None:
    assert student_t_quantile(probability, df) == pytest.approx(expected, abs=1e-4)


def test_t_cdf_and_normal_quantile() -> None:
    assert 1 - student_t_cdf(2.0, 10) == pytest.approx(0.036694, abs=1e-6)   # one-sided p for t = 2, df = 10
    assert student_t_cdf(0.0, 7) == pytest.approx(0.5)
    assert student_t_cdf(-2.0, 10) == pytest.approx(0.036694, abs=1e-6)
    assert normal_quantile(0.975) == pytest.approx(1.959964, abs=1e-6)


def test_t_test_by_hand() -> None:
    # 1..5: mean 3, s = 1.58113883, se = 0.70710678, t = 4.24264069, t(0.975, 4) = 2.77644511.
    result = t_test(D(["1", "2", "3", "4", "5"]), "0.95")
    assert result["mean"] == "3.00000000"
    assert result["t_statistic"] == "4.24264069"
    assert result["interval"]["low"] == "1.03675684"
    assert result["interval"]["high"] == "4.96324316"
    assert Decimal(result["p_value_one_sided"]) == pytest.approx(Decimal("0.00662"), abs=Decimal("0.00001"))


def test_t_test_edge_cases() -> None:
    assert t_test(D(["5"]), "0.95")["reason"] == "TOO_FEW_TRADES"
    flat = t_test(D(["2", "2", "2"]), "0.95")
    assert flat["reason"] == "NO_VARIATION" and flat["t_statistic"] is None


def test_runs_test_nist_formula() -> None:
    alternating = D(["1", "-1"] * 12)                          # n1 = n2 = 12, R = 24
    result = runs_test(alternating, "0.95")
    assert result["expected_runs"] == "13.00000000"           # 2*12*12/24 + 1
    assert result["z"] == "4.59165910"                         # (24 - 13) / sqrt(5.73913043) = 11 / 2.39564822
    assert result["status"] == "RANDOMNESS_REJECTED"
    clustered = D(["1"] * 12 + ["-1"] * 12)                     # R = 2
    assert runs_test(clustered, "0.95")["status"] == "RANDOMNESS_REJECTED"
    few = runs_test(D(["1", "-1", "0"] * 10), "0.95")           # 10 wins, 10 losses: below NIST's n > 10
    assert few["status"] == "TOO_FEW" and few["breakeven_excluded"] == 10


def test_lag1_autocorrelation_by_hand() -> None:
    assert lag1_autocorrelation(D(["1", "2", "3", "4", "5"])) == "0.40000000"
    assert lag1_autocorrelation(D(["1", "2"])) is None


def test_significance_on_a_dataset_and_sqn_equivalence(tmp_path: Path) -> None:
    values = ["12", "-5", "8", "-3", "15", "-7", "4", "9", "-2", "6", "-4", "11", "3", "-6", "7", "10", "-1", "5", "-8", "14",
              "2", "-9", "13", "-3", "6", "8", "-5", "9", "-2", "4"]
    dataset = _dataset(tmp_path, values)
    result = significance(dataset, "0.95")
    sqn = performance_metrics(dataset)["close_event_metrics"]["sqn"]
    assert result["mean_test"]["t_statistic"] == sqn
    assert result["runs_test"]["wins"] == 18 and result["runs_test"]["losses"] == 12
    assert result["validity"] in {"VALID", "NOT_VALID"}
    assert result["basis"] == "MT5_VERIFIED_CLOSE_EVENTS_NET_PNL"


def test_invalid_confidence_and_worker(tmp_path: Path) -> None:
    dataset = _dataset(tmp_path, ["5", "-3", "4"])
    with pytest.raises(CoreError) as error:
        significance(dataset, "0.8")
    assert error.value.code == "E_CONFIDENCE_LEVEL"
    result = Worker(tmp_path).dispatch({"method": "analysis.significance", "params": {"dataset_ref": str(dataset["metadata"]["dataset_ref"]), "confidence": "0.99"}})
    assert result["confidence"] == "0.99" and result["validity"] == "UNCHECKED"


def test_significance_note(tmp_path: Path) -> None:
    dataset = _dataset(tmp_path, ["5", "-3", "4", "6"])
    note = Worker(tmp_path).dispatch({"method": "analysis.render_significance_note", "params": {"dataset_ref": str(dataset["metadata"]["dataset_ref"]), "confidence": "0.95", "reason": "thin sample"}})
    assert note["markdown"].startswith("### Significance checked")
    assert "95 % confidence interval" in note["markdown"] and "Your conclusion: thin sample" in note["markdown"]
    again = Worker(tmp_path).dispatch({"method": "analysis.render_significance_note", "params": {"dataset_ref": str(dataset["metadata"]["dataset_ref"]), "confidence": "0.95", "reason": "other"}})
    assert again["record_id"] == note["record_id"]
