"""Check that a report ran with the inputs of a given `.set` file.

MT5 can silently run a test with the EA's compiled defaults or a stale preset
(playbook §3.2); the report's own Inputs section is the evidence of what
actually ran. This compares it with the `.set` the owner intended, value by
value, and reports every difference without judging which are deliberate.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from pathlib import Path

from .intake import get_evidence, set_evidence_block
from .mt5_report_summary import read_report_summary
from .mt5_set import intake_parameter_schema, read_schema


CHECK_VERSION = "set-vs-report-check-1"


def check_set_against_report(workspace_root: Path, dataset_ref: str, set_path: str) -> dict[str, object]:
    root = workspace_root.resolve()
    evidence = get_evidence(root, dataset_ref)
    schema = intake_parameter_schema(root, set_path)  # immutable snapshot + hash
    parameters = read_schema(root, str(schema["schema_ref"]))["parameters"]
    report_inputs = read_report_summary(Path(str(evidence["raw_snapshot_path"])))["inputs"]
    intended = {item["name"]: item["value"] for item in parameters}
    differences = [
        {"name": name, "report_value": report_inputs[name], "set_value": value}
        for name, value in intended.items()
        if name in report_inputs and not _same(report_inputs[name], value)
    ]
    only_in_set = sorted(name for name in intended if name not in report_inputs)
    only_in_report = sorted(name for name in report_inputs if name not in intended)
    status = "MATCH" if not differences else "DIFFERS"
    notes = []
    if only_in_set:
        notes.append(f"{len(only_in_set)} input(s) in the .set are not in the report (the EA may have changed since the .set was saved).")
    if only_in_report:
        notes.append(f"{len(only_in_report)} input(s) in the report are not in the .set; they ran with the EA's own values.")
    result = {
        "calculation_version": CHECK_VERSION,
        "dataset_ref": dataset_ref,
        "schema_ref": schema["schema_ref"],
        "set_filename": schema["source"]["filename"],
        "status": status,
        "compared": len(intended) - len(only_in_set),
        "differences": differences,
        "only_in_set": only_in_set,
        "only_in_report": only_in_report,
        "notes": notes,
    }
    set_evidence_block(root, dataset_ref, "set_check", {key: result[key] for key in ("schema_ref", "set_filename", "status", "compared")} | {"difference_count": len(differences)})
    return result


def _same(left: object, right: object) -> bool:
    a, b = _number(left), _number(right)
    if a is not None and b is not None:
        return a == b
    return str(left).strip().lower() == str(right).strip().lower()


def _number(value: object) -> Decimal | None:
    text = str(value).strip().lower()
    if text in {"true", "false"}:
        return Decimal(1 if text == "true" else 0)
    try:
        number = Decimal(text)
    except (InvalidOperation, ValueError):
        return None
    return number if number.is_finite() else None

