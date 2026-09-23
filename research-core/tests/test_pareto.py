"""Shared Pareto layer: hand-computed fixtures and property tests."""

from __future__ import annotations

import json
import random
from decimal import Decimal

import pytest

from trading_research_core.errors import CoreError
from trading_research_core.pareto import evaluate

PROFIT_UP_DD_DOWN = [{"metric": "profit", "direction": "MAX"}, {"metric": "dd", "direction": "MIN"}]


def _candidates(rows: dict[str, tuple[str | None, str | None]]) -> list[dict[str, object]]:
    return [{"id": key, "values": {"profit": profit, "dd": dd}} for key, (profit, dd) in rows.items()]


def _by_id(result: dict[str, object]) -> dict[str, dict[str, object]]:
    return {row["id"]: row for row in result["candidates"]}


def test_portfolio_spec_p14_example() -> None:
    # PORTFOLIO_LAB_SPEC P14: {A}=(80,50) {B}=(50,60) {A,B}=(130,70).
    result = _by_id(evaluate(_candidates({"A": ("80", "50"), "B": ("50", "60"), "AB": ("130", "70")}), PROFIT_UP_DD_DOWN))
    assert result["A"]["status"] == "PARETO" and result["AB"]["status"] == "PARETO"
    assert result["B"]["status"] == "DOMINATED" and result["B"]["rank"] == 2
    assert result["B"]["dominated_by_count"] == 1 and result["B"]["dominated_by_example"] == "A"


def test_mixed_directions_three_objectives_and_fronts() -> None:
    objectives = PROFIT_UP_DD_DOWN + [{"metric": "trades", "direction": "MAX"}]
    candidates = [
        {"id": "p", "values": {"profit": "100", "dd": "10", "trades": "50"}},
        {"id": "q", "values": {"profit": "90", "dd": "12", "trades": "40"}},   # dominated by p
        {"id": "r", "values": {"profit": "80", "dd": "5", "trades": "10"}},    # trade-off
        {"id": "s", "values": {"profit": "70", "dd": "13", "trades": "30"}},   # dominated by p and q
    ]
    result = evaluate(candidates, objectives)
    rows = _by_id(result)
    assert [rows[key]["rank"] for key in "pqrs"] == [1, 2, 1, 3]
    assert rows["s"]["dominated_by_count"] == 2
    assert result["front_count"] == 3
    assert result["counts"] == {"PARETO": 2, "DOMINATED": 2, "CONSTRAINED": 0, "INCOMPLETE": 0}


def test_identical_candidates_share_status() -> None:
    rows = _by_id(evaluate(_candidates({"a": ("10", "5"), "b": ("10", "5"), "c": ("9", "6")}), PROFIT_UP_DD_DOWN))
    assert rows["a"]["status"] == rows["b"]["status"] == "PARETO"
    assert rows["c"]["dominated_by_count"] == 2


def test_constraints_filter_before_dominance_and_record_violations() -> None:
    # "big" would dominate everything but fails the drawdown constraint.
    candidates = _candidates({"big": ("500", "40"), "ok": ("100", "10"), "worse": ("90", "12")})
    result = evaluate(candidates, PROFIT_UP_DD_DOWN, [{"metric": "dd", "operator": "<=", "threshold": "20"}])
    rows = _by_id(result)
    assert rows["big"]["status"] == "CONSTRAINED" and rows["big"]["rank"] is None
    assert rows["big"]["violations"] == [{"metric": "dd", "operator": "<=", "threshold": "20", "value": "40", "reason": "NOT_SATISFIED"}]
    assert rows["ok"]["status"] == "PARETO"
    assert rows["worse"]["dominated_by_example"] == "ok"


def test_missing_values_are_incomplete_or_constrained_never_zero() -> None:
    candidates = _candidates({"good": ("10", "5"), "no_dd": ("99", None), "bad_text": ("abc", "1")})
    rows = _by_id(evaluate(candidates, PROFIT_UP_DD_DOWN))
    assert rows["no_dd"]["status"] == "INCOMPLETE" and rows["bad_text"]["status"] == "INCOMPLETE"
    assert rows["good"]["status"] == "PARETO"
    constrained = _by_id(evaluate(candidates, PROFIT_UP_DD_DOWN, [{"metric": "dd", "operator": "<=", "threshold": "50"}]))
    assert constrained["no_dd"]["status"] == "CONSTRAINED"
    assert constrained["no_dd"]["violations"][0]["reason"] == "MISSING_VALUE"


def test_exact_decimal_comparison() -> None:
    # 0.1 + 0.2 style float artefacts must not create or break dominance.
    rows = _by_id(evaluate(_candidates({"a": ("0.3", "1.0000000000000001"), "b": ("0.30", "1")}), PROFIT_UP_DD_DOWN))
    assert rows["b"]["status"] == "PARETO" and rows["a"]["status"] == "DOMINATED"


@pytest.mark.parametrize("objectives,constraints", [
    ([], []),
    ([{"metric": "profit", "direction": "UP"}], []),
    ([{"metric": "profit", "direction": "MAX"}, {"metric": "profit", "direction": "MIN"}], []),
    (PROFIT_UP_DD_DOWN, [{"metric": "dd", "operator": "<", "threshold": "5"}]),
    (PROFIT_UP_DD_DOWN, [{"metric": "dd", "operator": "<=", "threshold": "x"}]),
])
def test_invalid_configuration(objectives: list[dict[str, str]], constraints: list[dict[str, str]]) -> None:
    with pytest.raises(CoreError) as error:
        evaluate(_candidates({"a": ("1", "1")}), objectives, constraints)
    assert error.value.code == "E_PARETO_CONFIG_INVALID"


def test_duplicate_ids_are_rejected() -> None:
    with pytest.raises(CoreError):
        evaluate([{"id": "a", "values": {}}, {"id": "a", "values": {}}], PROFIT_UP_DD_DOWN)


def _random_candidates(seed: int, count: int) -> list[dict[str, object]]:
    generator = random.Random(seed)
    return [{"id": f"c{index}", "values": {"profit": str(generator.randint(-50, 50)), "dd": str(generator.randint(0, 30)), "trades": str(generator.randint(1, 20))}} for index in range(count)]


def _vector(candidate: dict[str, object]) -> tuple[Decimal, Decimal, Decimal]:
    values = candidate["values"]
    return Decimal(values["profit"]), -Decimal(values["dd"]), Decimal(values["trades"])


def _dominates(a: tuple[Decimal, ...], b: tuple[Decimal, ...]) -> bool:
    return all(x >= y for x, y in zip(a, b)) and any(x > y for x, y in zip(a, b))


@pytest.mark.parametrize("seed", range(6))
def test_properties_on_random_sets(seed: int) -> None:
    objectives = PROFIT_UP_DD_DOWN + [{"metric": "trades", "direction": "MAX"}]
    candidates = _random_candidates(seed, 120)
    result = evaluate(candidates, objectives)
    rows = _by_id(result)
    vectors = {candidate["id"]: _vector(candidate) for candidate in candidates}
    front = [key for key, row in rows.items() if row["status"] == "PARETO"]
    # 1. Frontier members are mutually non-dominated.
    assert not any(_dominates(vectors[a], vectors[b]) for a in front for b in front if a != b)
    # 2. Every dominated candidate is dominated by its named frontier example.
    for key, row in rows.items():
        if row["status"] == "DOMINATED":
            assert row["dominated_by_example"] in front and _dominates(vectors[row["dominated_by_example"]], vectors[key])
            assert row["dominated_by_count"] == sum(1 for other in vectors if other != key and _dominates(vectors[other], vectors[key]))
    # 3. Ranks are consistent: a candidate of rank k is dominated by some candidate of rank k-1.
    for key, row in rows.items():
        if row["rank"] and row["rank"] > 1:
            assert any(rows[other]["rank"] == row["rank"] - 1 and _dominates(vectors[other], vectors[key]) for other in vectors)
    # 4. Input order does not change any status, rank, or count.
    shuffled = list(candidates)
    random.Random(seed + 100).shuffle(shuffled)
    again = _by_id(evaluate(shuffled, objectives))
    assert {key: (row["status"], row["rank"], row["dominated_by_count"]) for key, row in rows.items()} == {key: (row["status"], row["rank"], row["dominated_by_count"]) for key, row in again.items()}


def test_deterministic_output() -> None:
    candidates = _random_candidates(7, 60)
    assert json.dumps(evaluate(candidates, PROFIT_UP_DD_DOWN), sort_keys=True) == json.dumps(evaluate(candidates, PROFIT_UP_DD_DOWN), sort_keys=True)


def _brute_force(vectors: dict[str, tuple[Decimal, ...]]) -> dict[str, tuple[int, int]]:
    counts = {key: sum(1 for other in vectors if other != key and _dominates(vectors[other], vectors[key])) for key in vectors}
    ranks: dict[str, int] = {}
    remaining = set(vectors)
    rank = 0
    while remaining:
        rank += 1
        front = {key for key in remaining if not any(_dominates(vectors[other], vectors[key]) for other in remaining if other != key)}
        ranks.update({key: rank for key in front})
        remaining -= front
    return {key: (ranks[key], counts[key]) for key in vectors}


@pytest.mark.parametrize("seed", range(5))
def test_matches_brute_force_with_ties_and_duplicates(seed: int) -> None:
    generator = random.Random(seed)
    # Few distinct values force many ties and exact duplicates.
    candidates = [{"id": f"c{index}", "values": {"profit": str(generator.randint(0, 6)), "dd": str(generator.randint(0, 6)), "trades": str(generator.randint(0, 3))}} for index in range(150)]
    objectives = PROFIT_UP_DD_DOWN + [{"metric": "trades", "direction": "MAX"}]
    rows = _by_id(evaluate(candidates, objectives))
    expected = _brute_force({candidate["id"]: _vector(candidate) for candidate in candidates})
    assert {key: (row["rank"], row["dominated_by_count"]) for key, row in rows.items()} == expected


def test_candidate_limit() -> None:
    from trading_research_core import pareto
    with pytest.raises(CoreError) as error:
        evaluate([{"id": str(index), "values": {"profit": "1", "dd": "1"}} for index in range(pareto.MAX_CANDIDATES + 1)], PROFIT_UP_DD_DOWN)
    assert error.value.code == "E_PARETO_TOO_MANY_CANDIDATES"
