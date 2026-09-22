"""Fixtures R1–R8 of internal/docs/MVP_TIER_C2_VAN_THARP_METRICS.md."""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path

import pytest

from trading_research_core.errors import CoreError
from trading_research_core.performance_metrics import performance_metrics
from trading_research_core.r_metrics import r_multiple_metrics
from trading_research_core.worker import Worker
from test_performance_metrics import START, _dataset

R1 = ["200", "-100", "-100", "300", "-100"]


def test_r1_declared_one_r(tmp_path: Path) -> None:
    result = r_multiple_metrics(_dataset(tmp_path, R1), "DECLARED", "100")
    assert result["r_quality"] == "USER_SUPPLIED" and result["one_r"] == "100.00000000"
    assert result["expectancy_r"] == "0.40000000"
    assert result["standard_deviation_r"] == "1.94935887"
    assert result["sqn"] == "0.45883147" and result["sqn_capped_100"] == "0.45883147"
    assert result["largest_win_r"] == "3.00000000" and result["largest_loss_r"] == "-1.00000000"


def test_r2_sqn_is_invariant_to_one_r(tmp_path: Path) -> None:
    first = r_multiple_metrics(_dataset(tmp_path, R1), "DECLARED", "100")
    second = r_multiple_metrics(_dataset(tmp_path, R1), "DECLARED", "50")
    assert second["expectancy_r"] == "0.80000000"
    assert second["sqn"] == first["sqn"]
    assert performance_metrics(_dataset(tmp_path, R1))["close_event_metrics"]["sqn"] == first["sqn"]


def test_r3_average_loss_proxy_is_inferred(tmp_path: Path) -> None:
    result = r_multiple_metrics(_dataset(tmp_path, R1), "AVERAGE_LOSS")
    assert result["one_r"] == "100.00000000" and result["r_quality"] == "INFERRED"
    assert result["analysis_basis"] == "VERIFIED_CLOSE_EVENTS_WITH_INFERRED_1R"


def test_r4_proxy_without_losses_is_blocked(tmp_path: Path) -> None:
    with pytest.raises(CoreError) as error:
        r_multiple_metrics(_dataset(tmp_path, ["10", "20"]), "AVERAGE_LOSS")
    assert error.value.code == "E_R_SOURCE_UNAVAILABLE"


def test_r5_single_event_has_no_stdev_or_sqn(tmp_path: Path) -> None:
    result = r_multiple_metrics(_dataset(tmp_path, ["-20"]), "DECLARED", "10")
    assert result["expectancy_r"] == "-2.00000000"
    assert result["standard_deviation_r"] is None and result["sqn"] is None
    assert result["opportunity_per_30_days"] is None and result["expectunity_r_per_30_days"] is None


def test_r6_sqn_cap_at_100(tmp_path: Path) -> None:
    result = r_multiple_metrics(_dataset(tmp_path, R1 * 30), "DECLARED", "100")
    assert result["close_event_count"] == 150
    from decimal import Decimal
    ratio = Decimal(result["sqn"]) / Decimal(result["sqn_capped_100"])
    assert abs(ratio - (Decimal(150).sqrt() / Decimal(100).sqrt())) < Decimal("0.0000001")


def test_r7_histogram_edges_are_lower_inclusive(tmp_path: Path) -> None:
    result = r_multiple_metrics(_dataset(tmp_path, ["-300", "0", "500", "-301", "49"]), "DECLARED", "100")
    histogram = result["histogram"]
    counts = {bucket["lower_r"]: bucket["count"] for bucket in histogram["buckets"]}
    assert len(histogram["buckets"]) == 16
    assert counts["-3"] == 1 and counts["0"] == 2
    assert histogram["overflow_count"] == 1 and histogram["underflow_count"] == 1
    assert histogram["buckets"][-1] == {"lower_r": "4.5", "upper_r": "5", "count": 0}


def test_r8_zero_span_has_no_opportunity(tmp_path: Path) -> None:
    same = [START + timedelta(days=1)] * 3
    result = r_multiple_metrics(_dataset(tmp_path, ["10", "-5", "5"], times=same), "DECLARED", "5")
    assert result["opportunity_per_30_days"] is None and result["expectunity_r_per_30_days"] is None


def test_opportunity_expectunity_and_top_share(tmp_path: Path) -> None:
    result = r_multiple_metrics(_dataset(tmp_path, R1), "DECLARED", "100")
    # 5 close events across 4 days: 5 / 4 * 30 = 37.5 per 30 days; 0.4R * 37.5 = 15R.
    assert result["opportunity_per_30_days"] == "37.50000000"
    assert result["expectunity_r_per_30_days"] == "15.00000000"
    assert result["top_events_share_percent"] == {"value": "250.00000000", "reason": None, "event_count": 2}
    losing = r_multiple_metrics(_dataset(tmp_path, ["-10", "5"], sha="E"), "DECLARED", "10")
    assert losing["top_events_share_percent"]["reason"] == "NON_POSITIVE_NET"


@pytest.mark.parametrize("source,amount", [("DECLARED", None), ("DECLARED", "0"), ("DECLARED", "-5"), ("DECLARED", "abc"), ("AVERAGE_LOSS", "100"), ("OTHER", None)])
def test_invalid_r_configuration(tmp_path: Path, source: str, amount: str | None) -> None:
    with pytest.raises(CoreError) as error:
        r_multiple_metrics(_dataset(tmp_path, R1), source, amount)
    assert error.value.code == "E_R_SOURCE_INVALID"


def test_worker_exposes_r_metrics(tmp_path: Path) -> None:
    dataset = _dataset(tmp_path, R1)
    worker = Worker(tmp_path)
    result = worker.dispatch({"method": "analysis.r_multiple_metrics", "params": {"dataset_ref": str(dataset["metadata"]["dataset_ref"]), "r_source": "AVERAGE_LOSS"}})
    assert result["sqn"] == "0.45883147"
