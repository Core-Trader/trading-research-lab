"""Shared multi-objective analysis: constraints, Pareto dominance, and fronts.

Used by Portfolio Lab (combination explorer, PL-003) and parameter exploration
(PX-001). The analysis is descriptive: it records feasibility, violated
constraints, Pareto rank, and dominated-by counts for every candidate. It never
selects, scores, or ranks a single "best" candidate.

Rules (PARAMETER_EXPLORATION_ARCHITECTURE.md §5–§6):
- Constraints are hard filters applied before dominance. A failing or
  unverifiable constraint makes the candidate CONSTRAINED; it is kept.
- A feasible candidate missing any objective value is INCOMPLETE and excluded
  from dominance.
- a dominates b iff a is at least as good on every objective and strictly
  better on at least one, after direction normalisation (MAX as is, MIN
  negated). Identical vectors do not dominate each other.
- Rank 1 is the non-dominated set; rank k is non-dominated after removing
  ranks < k. Values are compared as exact Decimals.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from hashlib import sha256
import json
from typing import Any

from .errors import CoreError


CALCULATION_VERSION = "shared-pareto-1"
DIRECTIONS = {"MAX", "MIN"}
OPERATORS = {">=", "<="}
MAX_OBJECTIVES = 6
# Dominance uses per-objective bitsets whose memory grows with n^2 / 8 bytes
# per objective (about 50 MB each at 20,000 candidates).
MAX_CANDIDATES = 20_000


def evaluate(candidates: list[dict[str, Any]], objectives: list[dict[str, str]], constraints: list[dict[str, str]] | None = None) -> dict[str, object]:
    """Classify candidates. Each candidate is {"id": str, "values": {metric: decimal string | None}}."""

    constraints = constraints or []
    _validate(candidates, objectives, constraints)
    records: list[dict[str, Any]] = []
    for candidate in candidates:
        values = candidate["values"]
        violations = [violation for constraint in constraints if (violation := _violation(constraint, values.get(constraint["metric"]))) is not None]
        vector = [_decimal(values.get(objective["metric"])) for objective in objectives]
        if violations:
            status = "CONSTRAINED"
        elif any(value is None for value in vector):
            status = "INCOMPLETE"
        else:
            status = "PENDING"
        normalised = None if status != "PENDING" else tuple(value if objective["direction"] == "MAX" else -value for value, objective in zip(vector, objectives))  # type: ignore[operator]
        records.append({"id": str(candidate["id"]), "status": status, "violations": violations, "vector": normalised, "rank": None, "dominated_by_count": 0, "dominated_by_example": None})

    comparable = [record for record in records if record["status"] == "PENDING"]
    rank = _non_dominated_sort(comparable)
    for record in comparable:
        record["status"] = "PARETO" if record["rank"] == 1 else "DOMINATED"

    configuration = {"calculation_version": CALCULATION_VERSION, "objectives": objectives, "constraints": constraints}
    counts = {status: sum(1 for record in records if record["status"] == status) for status in ("PARETO", "DOMINATED", "CONSTRAINED", "INCOMPLETE")}
    return {
        "calculation_version": CALCULATION_VERSION,
        "configuration": configuration,
        "configuration_hash": sha256(json.dumps(configuration, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest().upper(),
        "candidate_count": len(records),
        "counts": counts,
        "front_count": rank,
        "candidates": [
            {"id": record["id"], "status": record["status"], "rank": record["rank"], "dominated_by_count": record["dominated_by_count"], "dominated_by_example": record["dominated_by_example"], "violations": record["violations"]}
            for record in records
        ],
    }


def _validate(candidates: list[dict[str, Any]], objectives: list[dict[str, str]], constraints: list[dict[str, str]]) -> None:
    if not isinstance(candidates, list) or not all(isinstance(candidate, dict) and isinstance(candidate.get("values"), dict) and str(candidate.get("id", "")) for candidate in candidates):
        raise CoreError("E_PARETO_CONFIG_INVALID", "Each candidate needs an id and a values mapping.")
    if len(candidates) > MAX_CANDIDATES:
        raise CoreError("E_PARETO_TOO_MANY_CANDIDATES", f"At most {MAX_CANDIDATES} candidates can be analysed at once.", details={"candidate_count": len(candidates)})
    ids = [str(candidate["id"]) for candidate in candidates]
    if len(set(ids)) != len(ids):
        raise CoreError("E_PARETO_CONFIG_INVALID", "Candidate ids must be unique.")
    if not isinstance(objectives, list) or not 1 <= len(objectives) <= MAX_OBJECTIVES:
        raise CoreError("E_PARETO_CONFIG_INVALID", f"Choose 1 to {MAX_OBJECTIVES} objectives.")
    metrics = [objective.get("metric") for objective in objectives]
    if any(not isinstance(metric, str) or not metric for metric in metrics) or len(set(metrics)) != len(metrics):
        raise CoreError("E_PARETO_CONFIG_INVALID", "Objectives need distinct metric names.")
    if any(objective.get("direction") not in DIRECTIONS for objective in objectives):
        raise CoreError("E_PARETO_CONFIG_INVALID", "Objective direction must be MAX or MIN.")
    for constraint in constraints:
        if not isinstance(constraint.get("metric"), str) or constraint.get("operator") not in OPERATORS or _decimal(constraint.get("threshold")) is None:
            raise CoreError("E_PARETO_CONFIG_INVALID", "Constraints need a metric, an operator (>= or <=), and a decimal threshold.")


def _violation(constraint: dict[str, str], raw: object) -> dict[str, object] | None:
    threshold = _decimal(constraint["threshold"])
    value = _decimal(raw)
    base = {"metric": constraint["metric"], "operator": constraint["operator"], "threshold": constraint["threshold"]}
    if value is None:
        return {**base, "value": None, "reason": "MISSING_VALUE"}
    assert threshold is not None
    satisfied = value >= threshold if constraint["operator"] == ">=" else value <= threshold
    return None if satisfied else {**base, "value": format(value, "f"), "reason": "NOT_SATISFIED"}


def _non_dominated_sort(records: list[dict[str, Any]]) -> int:
    """Exact non-dominated sorting; sets rank, dominated_by_count, and example.

    Objective values are replaced by their dense per-objective order (exact,
    since dominance depends only on order), so comparisons are integer-only.
    Returns the number of fronts.
    """

    if not records:
        return 0
    width = len(records[0]["vector"])
    columns = []
    for axis in range(width):
        ordered = {value: position for position, value in enumerate(sorted({record["vector"][axis] for record in records}))}
        columns.append([ordered[record["vector"][axis]] for record in records])
    vectors = [tuple(column[index] for column in columns) for index in range(len(records))]
    count = len(records)
    # Bitsets over input positions (bit i = candidate i), as Python integers:
    # at_least[axis][v] = candidates whose value on `axis` is >= v. The
    # dominators of i are the intersection over axes minus candidates with an
    # identical vector (which includes i). All set operations run in C.
    at_least: list[list[int]] = []
    for axis in range(width):
        members: dict[int, int] = {}
        for index, vector in enumerate(vectors):
            members[vector[axis]] = members.get(vector[axis], 0) | (1 << index)
        cumulative = 0
        levels = [0] * (max(members) + 1)
        for value in sorted(members, reverse=True):
            cumulative |= members[value]
            levels[value] = cumulative
        at_least.append(levels)
    identical: dict[tuple[int, ...], int] = {}
    for index, vector in enumerate(vectors):
        identical[vector] = identical.get(vector, 0) | (1 << index)

    # In descending lexicographic order every dominator precedes the candidate
    # it dominates, so one ordered pass assigns rank = 1 + max dominator rank.
    fronts: list[int] = []
    for index in sorted(range(count), key=lambda position: vectors[position], reverse=True):
        vector = vectors[index]
        dominators = at_least[0][vector[0]]
        for axis in range(1, width):
            dominators &= at_least[axis][vector[axis]]
        dominators &= ~identical[vector]
        rank = 1
        for level in range(len(fronts), 0, -1):
            if dominators & fronts[level - 1]:
                rank = level + 1
                break
        if rank > len(fronts):
            fronts.append(0)
        fronts[rank - 1] |= 1 << index
        records[index]["rank"] = rank
        records[index]["dominated_by_count"] = dominators.bit_count()
    # Example dominator: the lowest-input-position rank-1 candidate dominating it.
    for index, record in enumerate(records):
        if record["rank"] and record["rank"] > 1:
            vector = vectors[index]
            dominators = at_least[0][vector[0]]
            for axis in range(1, width):
                dominators &= at_least[axis][vector[axis]]
            first_front = dominators & ~identical[vector] & fronts[0]
            record["dominated_by_example"] = records[(first_front & -first_front).bit_length() - 1]["id"]
    return len(fronts)


def _decimal(value: object) -> Decimal | None:
    if value is None or isinstance(value, bool):
        return None
    try:
        parsed = Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        return None
    return parsed if parsed.is_finite() else None
