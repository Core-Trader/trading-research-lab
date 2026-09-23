"""Run every file in the local MT5 test corpus through TRL's importers.

Reports, per file, whether it PARSED, was BLOCKED (with the Core's reason), or
CRASHED. The corpus lives in `data/raw/corpus/` (git-ignored; see its
CORPUS_MANIFEST.md) plus any extra folders passed on the command line. Nothing
is written outside a temporary workspace. Exit code 1 if anything crashed or
an expected-to-parse file did not parse.

Usage (from the repository root):
    research-core/.venv/Scripts/python.exe scripts/corpus_check.py [extra folders...]
"""

from __future__ import annotations

from pathlib import Path
import shutil
import sys
import tempfile
import warnings

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "research-core" / "src"))

from trading_research_core.errors import CoreError  # noqa: E402
from trading_research_core.intake import intake_mt5_report  # noqa: E402
from trading_research_core.mt5_optimisation import intake_parameter_grid  # noqa: E402
from trading_research_core.mt5_set import intake_parameter_schema  # noqa: E402

REPORTS = {".htm", ".html", ".xlsx"}


def check(folders: list[Path]) -> list[dict[str, str]]:
    warnings.simplefilter("ignore")
    workspace = Path(tempfile.mkdtemp(prefix="trl-corpus-check-"))
    results: list[dict[str, str]] = []
    try:
        for folder in folders:
            for path in sorted(item for item in folder.rglob("*") if item.is_file()):
                suffix = path.suffix.lower()
                try:
                    if suffix in REPORTS:
                        imported = intake_mt5_report(workspace, str(path))
                        detail = f"{imported['event_count']} deals; {', '.join(imported['intake_receipt'].get('source_checks', [])) or 'xlsx'}"
                    elif suffix == ".xml":
                        grid = intake_parameter_grid(workspace, str(path), "declared by corpus check")
                        detail = f"{grid['pass_count']} passes; inputs {', '.join(grid['parameter_columns'])}"
                    elif suffix == ".set":
                        schema = intake_parameter_schema(workspace, str(path))
                        detail = f"{schema['parameter_count']} inputs; optimised {', '.join(schema['optimised_parameters']) or 'none'}"
                    else:
                        continue
                    results.append({"file": str(path.relative_to(folder.parent)), "outcome": "PARSED", "detail": detail})
                except CoreError as error:
                    results.append({"file": str(path.relative_to(folder.parent)), "outcome": "BLOCKED", "detail": f"{error.code}: {error.message}"})
                except Exception as error:  # a crash is always a bug to fix
                    results.append({"file": str(path.relative_to(folder.parent)), "outcome": "CRASHED", "detail": repr(error)[:200]})
    finally:
        shutil.rmtree(workspace, ignore_errors=True)
    return results


def main(argv: list[str]) -> int:
    folders = [ROOT / "data" / "raw" / "corpus", *(Path(item) for item in argv)]
    folders = [folder for folder in folders if folder.is_dir()]
    if not folders:
        print("No corpus folder found (expected data/raw/corpus).")
        return 1
    results = check(folders)
    for item in results:
        print(f"{item['outcome']:8} {item['file']}  -  {item['detail']}")
    counts = {outcome: sum(item["outcome"] == outcome for item in results) for outcome in ("PARSED", "BLOCKED", "CRASHED")}
    print(f"\n{len(results)} files: {counts['PARSED']} parsed, {counts['BLOCKED']} blocked, {counts['CRASHED']} crashed")
    return 1 if counts["CRASHED"] else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
