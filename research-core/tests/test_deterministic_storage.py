from __future__ import annotations

import json
import uuid
from pathlib import Path

from trading_research_core.dataset_store import read_dataset, write_dataset


SOURCE_SHA256 = "A" * 64


def imported_source() -> dict[str, object]:
    return {
        "source": {
            "sha256": SOURCE_SHA256,
            "filename": "deterministic-fixture.xlsx",
            "byte_count": 1,
            "worksheet_name": "Deals",
        },
        "settings": {"Currency": "USD"},
        "events": [
            {"source_sequence": 1, "source_timestamp": "2026-01-01T00:00:00", "event_type": "OPENING_BALANCE", "reported_balance": "1000", "source_profit": "0", "source_commission": "0", "source_swap": "0"},
            {"source_sequence": 2, "source_timestamp": "2026-01-02T00:00:00", "event_type": "POSITION_CLOSE", "reported_balance": "1010", "source_profit": "12", "source_commission": "-1", "source_swap": "-1"},
        ],
    }


def artifact_bytes(workspace: Path) -> tuple[bytes, bytes]:
    target = workspace / "datasets" / SOURCE_SHA256
    return ((target / "metadata.json").read_bytes(), (target / "events.parquet").read_bytes())


def test_fresh_workspaces_produce_byte_stable_canonical_artifacts(tmp_path: Path) -> None:
    first = tmp_path / "first"
    second = tmp_path / "second"
    first_result = write_dataset(first, imported_source())
    second_result = write_dataset(second, imported_source())

    assert first_result == second_result
    assert artifact_bytes(first) == artifact_bytes(second)

    metadata = json.loads(artifact_bytes(first)[0])
    assert metadata["schema_version"] == "1.1"
    assert uuid.UUID(metadata["dataset_id"]).version == 5
    assert uuid.UUID(metadata["source_import_id"]).version == 5
    assert uuid.UUID(read_dataset(first, first_result["dataset_ref"])["events"][0]["event_id"]).version == 5
