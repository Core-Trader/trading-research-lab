"""Significance of the average close-event result (PROPOSAL_SIGNIFICANCE.md, G1-G4).

Sources (internal/references/REFERENCE_REGISTER.md):
- NIST/SEMATECH e-Handbook 1.3.5.2: one-sample t, T = (mean - 0) / (s / sqrt(N)),
  N - 1 degrees of freedom. With mu0 = 0 this equals the uncapped Van Tharp SQN.
- NIST 1.3.5.13: runs test, Z = (R - Rbar) / sR, normal approximation for
  n1, n2 > 10; reject randomness if abs(Z) > z(1 - alpha/2).
- NIST 1.2.5.1: if randomness fails, the usual tests are invalid, so the
  p-value and interval are then marked NOT_VALID.
- NIST 1.3.5.12: lag-1 autocorrelation, descriptive only (no cut-off stated).

Basis: verified close-event net P/L (profit + commission + swap), as SQN.
Monetary values stay Decimal; distribution functions use IEEE doubles and
their results are quantised to 8 decimal places (ROUND_HALF_EVEN).
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_EVEN
import math

from .errors import CoreError
from .trade_analysis import close_event_summary


CALCULATION_VERSION = "significance-1"
CONFIDENCE_LEVELS = ("0.90", "0.95", "0.99")
RUNS_MINIMUM_EACH = 11  # NIST 1.3.5.13: normal approximation for n1 > 10 and n2 > 10
_STEP = Decimal("0.00000001")
_ZERO = Decimal("0")


def _q(value: Decimal | float) -> str:
    return str((value if isinstance(value, Decimal) else Decimal(repr(value))).quantize(_STEP, rounding=ROUND_HALF_EVEN))


# --- Distribution functions -------------------------------------------------

def _beta_continued_fraction(a: float, b: float, x: float) -> float:
    """Continued fraction for the incomplete beta function (modified Lentz)."""
    tiny = 1e-300
    c, d = 1.0, 1.0 - (a + b) * x / (a + 1.0)
    d = 1.0 / (d if abs(d) > tiny else tiny)
    result = d
    for m in range(1, 400):
        m2 = 2 * m
        for numerator in (m * (b - m) * x / ((a + m2 - 1.0) * (a + m2)), -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1.0))):
            d = 1.0 + numerator * d
            d = 1.0 / (d if abs(d) > tiny else tiny)
            c = 1.0 + numerator / c
            c = c if abs(c) > tiny else tiny
            result *= d * c
        if abs(d * c - 1.0) < 1e-15:
            break
    return result


def regularized_incomplete_beta(a: float, b: float, x: float) -> float:
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    front = math.exp(math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b) + a * math.log(x) + b * math.log1p(-x))
    if x < (a + 1.0) / (a + b + 2.0):
        return front * _beta_continued_fraction(a, b, x) / a
    return 1.0 - front * _beta_continued_fraction(b, a, 1.0 - x) / b


def student_t_cdf(t: float, degrees_of_freedom: int) -> float:
    tail = 0.5 * regularized_incomplete_beta(degrees_of_freedom / 2.0, 0.5, degrees_of_freedom / (degrees_of_freedom + t * t))
    return 1.0 - tail if t > 0 else tail


def _invert(cdf, probability: float) -> float:
    low, high = -1e6, 1e6
    for _ in range(300):
        middle = (low + high) / 2.0
        if cdf(middle) < probability:
            low = middle
        else:
            high = middle
        if high - low < 1e-12:
            break
    return (low + high) / 2.0


def student_t_quantile(probability: float, degrees_of_freedom: int) -> float:
    return _invert(lambda value: student_t_cdf(value, degrees_of_freedom), probability)


def normal_cdf(z: float) -> float:
    return 0.5 * math.erfc(-z / math.sqrt(2.0))


def normal_quantile(probability: float) -> float:
    return _invert(normal_cdf, probability)


# --- Tests ------------------------------------------------------------------

def t_test(values: list[Decimal], confidence: str) -> dict[str, object]:
    """One-sample t-test of mean > 0 and a two-sided confidence interval for the mean (NIST 1.3.5.2)."""
    count = len(values)
    base: dict[str, object] = {"count": count, "degrees_of_freedom": max(count - 1, 0), "mean": None, "standard_deviation": None, "standard_error": None,
                               "t_statistic": None, "p_value_one_sided": None, "interval": None, "reason": None}
    if count < 2:
        return {**base, "reason": "TOO_FEW_TRADES"}
    mean = sum(values, _ZERO) / count
    deviation = (sum(((value - mean) ** 2 for value in values), _ZERO) / (count - 1)).sqrt()
    base.update({"mean": _q(mean), "standard_deviation": _q(deviation)})
    if deviation == 0:
        return {**base, "reason": "NO_VARIATION"}
    error = deviation / Decimal(count).sqrt()
    statistic = mean / error
    critical = Decimal(repr(student_t_quantile(1.0 - (1.0 - float(confidence)) / 2.0, count - 1)))
    return {
        **base,
        "standard_error": _q(error),
        "t_statistic": _q(statistic),
        "p_value_one_sided": _q(1.0 - student_t_cdf(float(statistic), count - 1)),
        "interval": {"confidence": confidence, "critical_t": _q(critical), "low": _q(mean - critical * error), "high": _q(mean + critical * error)},
    }


def runs_test(values: list[Decimal], confidence: str) -> dict[str, object]:
    """Runs test on the win/loss sequence (NIST 1.3.5.13); breakeven results are left out."""
    signs = [value > 0 for value in values if value != 0]
    wins, losses = signs.count(True), signs.count(False)
    runs = (1 + sum(1 for left, right in zip(signs, signs[1:]) if left != right)) if signs else 0
    base: dict[str, object] = {"wins": wins, "losses": losses, "breakeven_excluded": len(values) - len(signs), "runs": runs,
                               "expected_runs": None, "z": None, "critical_z": None, "p_value_two_sided": None, "status": None}
    if wins < RUNS_MINIMUM_EACH or losses < RUNS_MINIMUM_EACH:
        return {**base, "status": "TOO_FEW"}
    n1, n2 = Decimal(wins), Decimal(losses)
    expected = 2 * n1 * n2 / (n1 + n2) + 1
    variance = 2 * n1 * n2 * (2 * n1 * n2 - n1 - n2) / ((n1 + n2) ** 2 * (n1 + n2 - 1))
    z = (Decimal(runs) - expected) / variance.sqrt()
    critical = normal_quantile(1.0 - (1.0 - float(confidence)) / 2.0)
    return {
        **base,
        "expected_runs": _q(expected),
        "z": _q(z),
        "critical_z": _q(critical),
        "p_value_two_sided": _q(2.0 * (1.0 - normal_cdf(abs(float(z))))),
        "status": "RANDOMNESS_REJECTED" if abs(float(z)) > critical else "NOT_REJECTED",
    }


def lag1_autocorrelation(values: list[Decimal]) -> str | None:
    """NIST 1.3.5.12 lag-1 autocorrelation; descriptive only."""
    if len(values) < 3:
        return None
    mean = sum(values, _ZERO) / len(values)
    denominator = sum(((value - mean) ** 2 for value in values), _ZERO)
    if denominator == 0:
        return None
    numerator = sum(((left - mean) * (right - mean) for left, right in zip(values, values[1:])), _ZERO)
    return _q(numerator / denominator)


def significance(dataset: dict[str, object], confidence: str) -> dict[str, object]:
    if confidence not in CONFIDENCE_LEVELS:
        raise CoreError("E_CONFIDENCE_LEVEL", f"Confidence level must be one of {', '.join(CONFIDENCE_LEVELS)}.")
    summary, close_rows = close_event_summary(dataset)
    values = [Decimal(str(row["net_pnl"])) for row in close_rows]
    mean_test = t_test(values, confidence)
    runs = runs_test(values, confidence)
    if mean_test["reason"] is not None:
        validity = "NOT_AVAILABLE"
    elif runs["status"] == "RANDOMNESS_REJECTED":
        validity = "NOT_VALID"
    elif runs["status"] == "TOO_FEW":
        validity = "UNCHECKED"
    else:
        validity = "VALID"
    return {
        "calculation_version": CALCULATION_VERSION,
        "dataset_ref": summary["dataset_ref"],
        "currency": summary["currency"],
        "basis": "MT5_VERIFIED_CLOSE_EVENTS_NET_PNL",
        "confidence": confidence,
        "mean_test": mean_test,
        "runs_test": runs,
        "lag1_autocorrelation": lag1_autocorrelation(values),
        "validity": validity,
        "notes": [
            "The t-statistic equals the uncapped SQN (sqrt(N) x mean / stdev); they are the same evidence.",
            "The p-value is one-sided: the chance of an average at least this high if the true average trade were zero.",
        ],
    }
