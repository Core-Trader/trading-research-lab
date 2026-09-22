from __future__ import annotations

from pathlib import Path

import pytest

from trading_research_core import portfolio_preflight
from trading_research_core.errors import CoreError


def _intake(index: int, *, currency: str = "USD") -> dict[str, object]:
    sha = f"{index:X}" * 64
    return {
        "dataset_ref": f"mt5:{sha}", "dataset_id": f"dataset-{index}",
        "intake_receipt": {"source_sha256": sha, "original_filename": f"report-{index}.xlsx", "supplied_facts": {"currency": currency}},
    }


def _dataset(*, opening: str, final: str, first: str, last: str, deal: str) -> dict[str, object]:
    return {"events": [
        {"source_sequence": 1, "source_timestamp": first, "reported_balance": opening, "source_deal_id": deal},
        {"source_sequence": 2, "source_timestamp": last, "reported_balance": final, "source_deal_id": f"{deal}-end"},
    ]}


def test_preflight_is_eligible_for_reconciling_sequential_sources(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    intakes = [_intake(1), _intake(2)]
    datasets = {
        str(intakes[0]["dataset_ref"]): _dataset(opening="100", final="110", first="2026-01-01T00:00:00", last="2026-01-02T00:00:00", deal="1"),
        str(intakes[1]["dataset_ref"]): _dataset(opening="110", final="120", first="2026-01-03T00:00:00", last="2026-01-04T00:00:00", deal="1"),
    }
    monkeypatch.setattr(portfolio_preflight, "intake_mt5_excel", lambda _root, _path: intakes.pop(0))
    monkeypatch.setattr(portfolio_preflight, "read_dataset", lambda _root, ref: datasets[ref])
    result = portfolio_preflight.preflight_mt5_excel_batch(tmp_path, ["one.xlsx", "two.xlsx"])
    assert result["status"] == "ELIGIBLE"
    assert result["writes"] == "INDIVIDUAL_M1_INTAKE_ONLY; NO_COMBINED_ARTIFACT"
    assert any(item["code"] == "DEAL_ID_REUSED" for item in result["findings"])


def test_preflight_blocks_balance_discontinuity(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    intakes = [_intake(1), _intake(2)]
    datasets = {
        str(intakes[0]["dataset_ref"]): _dataset(opening="100", final="110", first="2026-01-01T00:00:00", last="2026-01-02T00:00:00", deal="1"),
        str(intakes[1]["dataset_ref"]): _dataset(opening="111", final="120", first="2026-01-03T00:00:00", last="2026-01-04T00:00:00", deal="3"),
    }
    monkeypatch.setattr(portfolio_preflight, "intake_mt5_excel", lambda _root, _path: intakes.pop(0))
    monkeypatch.setattr(portfolio_preflight, "read_dataset", lambda _root, ref: datasets[ref])
    result = portfolio_preflight.preflight_mt5_excel_batch(tmp_path, ["one.xlsx", "two.xlsx"])
    assert result["status"] == "BLOCKED"
    assert any(item["code"] == "BALANCE_DISCONTINUITY" for item in result["findings"])


def test_preflight_requires_two_sources(tmp_path: Path) -> None:
    with pytest.raises(CoreError, match="at least two"):
        portfolio_preflight.preflight_mt5_excel_batch(tmp_path, ["one.xlsx"])


def test_eligible_batch_writes_only_bounded_balance_artifacts(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    preflight = {"preflight_id": "batch-test", "status": "ELIGIBLE", "account_declaration": "USER_SUPPLIED_SINGLE_ACCOUNT", "members": [{"dataset_ref": "mt5:" + "A" * 64, "source_sha256": "A" * 64, "currency": "USD"}]}
    dataset = _dataset(opening="100", final="110", first="2026-01-01T00:00:00", last="2026-01-02T00:00:00", deal="1")
    monkeypatch.setattr(portfolio_preflight, "preflight_mt5_excel_batch", lambda _root, _paths: preflight)
    monkeypatch.setattr(portfolio_preflight, "read_dataset", lambda _root, _ref: dataset)
    result = portfolio_preflight.create_combined_realised_balance(tmp_path, ["one.xlsx", "two.xlsx"])
    assert result["reported_balance_change"] == "10"
    assert (tmp_path / "batches" / "batch-test" / "combined-realised-balance.parquet").is_file()
    assert (tmp_path / "batches" / "batch-test" / "manifest.json").is_file()


def test_combined_daily_drawdown_stays_realised_balance_only(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    preflight = {"preflight_id": "batch-test", "status": "ELIGIBLE", "account_declaration": "USER_SUPPLIED_SINGLE_ACCOUNT", "members": [{"dataset_ref": "mt5:" + "A" * 64, "source_sha256": "A" * 64, "currency": "USD"}]}
    dataset = _dataset(opening="100", final="90", first="2026-01-01T00:00:00", last="2026-01-01T01:00:00", deal="1")
    monkeypatch.setattr(portfolio_preflight, "preflight_mt5_excel_batch", lambda _root, _paths: preflight)
    monkeypatch.setattr(portfolio_preflight, "read_dataset", lambda _root, _ref: dataset)
    result = portfolio_preflight.combined_daily_drawdown(tmp_path, ["one.xlsx", "two.xlsx"])
    assert result["analysis_basis"] == "REALISED_BALANCE_ONLY"
    assert "GAP_UNDETERMINED" in result["warnings"][-1]
