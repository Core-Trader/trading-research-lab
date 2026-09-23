from __future__ import annotations

import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_release import assemble, check, collect  # noqa: E402


def _repo(root: Path) -> Path:
    files = {
        "plugin/manifest.json": json.dumps({"id": "trading-research-lab", "version": "0.0.9"}),
        "plugin/main.js": "console.log('ok');",
        "plugin/styles.css": ".x{}",
        "plugin/src/main.ts": "export {};",
        "plugin/data.json": "{}",
        "research-core/pyproject.toml": "[project]",
        "research-core/src/trading_research_core/__init__.py": "",
        "research-core/src/trading_research_core/importers/mt5.py": "X = 1",
        "research-core/tests/test_x.py": "",
        "internal/handoffs/CURRENT_HANDOFF.md": "private",
        "data/raw/report.xlsx": "raw",
        "product-docs/INSTALL.md": "# Install",
        "LICENSE": "All rights reserved.",
    }
    for relative, text in files.items():
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    cache = root / "research-core/src/trading_research_core/__pycache__"
    cache.mkdir()
    (cache / "x.cpython-314.pyc").write_bytes(b"\0")
    return root


def test_allowlist_selects_only_release_files(tmp_path: Path) -> None:
    destinations = [destination for _, destination in collect(_repo(tmp_path))]
    assert destinations == [
        "trading-research-lab/manifest.json", "trading-research-lab/main.js", "trading-research-lab/styles.css",
        "research-core/pyproject.toml",
        "research-core/src/trading_research_core/__init__.py", "research-core/src/trading_research_core/importers/mt5.py",
        "docs/INSTALL.md", "LICENSE",
    ]


def test_clean_release_is_assembled_with_hashes(tmp_path: Path) -> None:
    result = assemble(_repo(tmp_path / "repo"), tmp_path / "out")
    assert result["status"] == "READY" and result["file_count"] == 8
    folder = tmp_path / "out" / "trading-research-lab-0.0.9"
    manifest = json.loads((folder / "RELEASE_MANIFEST.json").read_text(encoding="utf-8"))
    assert {item["path"] for item in manifest["files"]} >= {"trading-research-lab/main.js", "LICENSE"}
    assert all(len(item["sha256"]) == 64 for item in manifest["files"])
    assert not (folder / "internal").exists() and not list(folder.rglob("*.pyc"))


def test_private_markers_block_the_release(tmp_path: Path) -> None:
    repo = _repo(tmp_path / "repo")
    (repo / "plugin/main.js").write_text("const p = 'C:\\\\DEV\\\\Lab'; // see internal/docs/X.md\n//# sourceMappingURL=data:", encoding="utf-8")
    (repo / "product-docs/CONTACT.md").write_text("Write to someone@realmail.com; examples use you@example.com.", encoding="utf-8")
    result = assemble(repo, tmp_path / "out")
    assert result["status"] == "BLOCKED"
    assert {finding["code"] for finding in result["findings"]} == {"LOCAL_PATH", "PRIVATE_DOC_REFERENCE", "SOURCE_MAP", "EMAIL_ADDRESS"}
    assert not (tmp_path / "out").exists()


def test_forbidden_paths_names_and_missing_files(tmp_path: Path) -> None:
    source = tmp_path / "f.txt"
    source.write_text("", encoding="utf-8")
    findings = check([(source, "internal/x.md"), (source, "docs/report.xlsx"), (source, "research-core/src/x/__pycache__/a.py")], required=["trading-research-lab/main.js"])
    assert sorted(finding["code"] for finding in findings) == ["FORBIDDEN_FILE_TYPE", "FORBIDDEN_PATH", "FORBIDDEN_PATH", "MISSING_REQUIRED_FILE"]
