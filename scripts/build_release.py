"""Assemble a Trading Research Lab release folder from an explicit allowlist.

The release is never a copy of the repository: only the files listed in
ALLOWLIST are collected, and the result is checked for private or local
material before anything is written. Standard library only.

Usage (from the repository root):
    research-core/.venv/Scripts/python.exe scripts/build_release.py [--no-build]
"""

from __future__ import annotations

import argparse
from hashlib import sha256
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

RELEASE_CHECK_VERSION = "release-check-1"
# (source glob relative to the repository root, destination folder in the release)
ALLOWLIST: list[tuple[str, str]] = [
    ("plugin/manifest.json", "trading-research-lab"),
    ("plugin/main.js", "trading-research-lab"),
    ("plugin/styles.css", "trading-research-lab"),
    ("research-core/pyproject.toml", "research-core"),
    ("research-core/src/trading_research_core/**/*.py", "research-core/src/trading_research_core"),
    ("product-docs/*.md", "docs"),
    ("mql5/Include/*.mqh", "mql5/Include"),
    ("LICENSE", ""),
]
REQUIRED = ["trading-research-lab/manifest.json", "trading-research-lab/main.js", "trading-research-lab/styles.css", "research-core/pyproject.toml"]
FORBIDDEN_PATH_PARTS = {"internal", "journal", "handoffs", "development-journal", "tests", "data", "raw", "dev-vault", "vaults", "__pycache__", ".venv", "node_modules", ".obsidian", "reference"}
FORBIDDEN_NAME = re.compile(r"(\.(xlsx|xml|set|parquet|csv|env|db|sqlite3?|pyc|map|log)$)|(^\.trl-)|(^data\.json$)", re.IGNORECASE)
# Text that must never appear in shipped files.
FORBIDDEN_CONTENT = {
    "PRIVATE_DOC_REFERENCE": re.compile(r"internal[\\/]|CURRENT_HANDOFF|development-journal|DECISION_LOG"),
    "LOCAL_PATH": re.compile(r"[A-Za-z]:[\\/]+(DEV|Users)[\\/]", re.IGNORECASE),
    "EMAIL_ADDRESS": re.compile(r"[A-Za-z0-9._%+-]+@(?!example\.com)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}"),
    "SOURCE_MAP": re.compile(r"sourceMappingURL="),
}
TEXT_SUFFIXES = {".js", ".css", ".json", ".py", ".toml", ".md", ".mqh", ""}


def collect(repo: Path) -> list[tuple[Path, str]]:
    """Every (source, release-relative destination) pair the allowlist selects."""

    pairs: list[tuple[Path, str]] = []
    for pattern, destination in ALLOWLIST:
        base = repo / pattern.split("*")[0].rstrip("/") if "*" in pattern else (repo / pattern).parent
        for source in sorted(repo.glob(pattern)):
            if source.is_file():
                relative = source.relative_to(base).as_posix()
                pairs.append((source, f"{destination}/{relative}".lstrip("/")))
    return pairs


def check(pairs: list[tuple[Path, str]], required: list[str] | None = None) -> list[dict[str, str]]:
    """Findings for missing files and forbidden paths, names, or content; empty means clean."""

    findings: list[dict[str, str]] = []
    destinations = {destination for _, destination in pairs}
    for needed in REQUIRED if required is None else required:
        if needed not in destinations:
            findings.append({"code": "MISSING_REQUIRED_FILE", "path": needed})
    for source, destination in pairs:
        if set(Path(destination).parts[:-1]) & FORBIDDEN_PATH_PARTS:
            findings.append({"code": "FORBIDDEN_PATH", "path": destination})
        if FORBIDDEN_NAME.search(Path(destination).name):
            findings.append({"code": "FORBIDDEN_FILE_TYPE", "path": destination})
        if source.suffix.lower() in TEXT_SUFFIXES:
            text = source.read_text(encoding="utf-8", errors="replace")
            for code, pattern in FORBIDDEN_CONTENT.items():
                match = pattern.search(text)
                if match:
                    findings.append({"code": code, "path": destination, "match": match.group(0)[:60]})
    return findings


def assemble(repo: Path, out: Path) -> dict[str, object]:
    """Check the allowlisted files and, only when clean, copy them with a hash manifest."""

    pairs = collect(repo)
    findings = check(pairs)
    version = json.loads((repo / "plugin" / "manifest.json").read_text(encoding="utf-8"))["version"]
    if findings:
        return {"status": "BLOCKED", "version": version, "findings": findings}
    target = out / f"trading-research-lab-{version}"
    if target.exists():
        shutil.rmtree(target)
    files = []
    for source, destination in pairs:
        path = target / destination
        path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, path)
        data = path.read_bytes()
        files.append({"path": destination, "bytes": len(data), "sha256": sha256(data).hexdigest().upper()})
    manifest = {"release_check_version": RELEASE_CHECK_VERSION, "version": version, "file_count": len(files), "files": files}
    (target / "RELEASE_MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return {"status": "READY", "version": version, "folder": str(target), "file_count": len(files), "findings": []}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Assemble an allowlisted Trading Research Lab release folder.")
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--out", type=Path, default=None, help="Output folder (default: <repo>/dist/release, git-ignored).")
    parser.add_argument("--no-build", action="store_true", help="Package the existing plugin build instead of rebuilding it.")
    args = parser.parse_args(argv)
    repo = args.repo.resolve()
    if not args.no_build:
        subprocess.run("npm run build", cwd=repo / "plugin", check=True, shell=True)
    result = assemble(repo, (args.out or repo / "dist" / "release").resolve())
    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "READY" else 1


if __name__ == "__main__":
    sys.exit(main())
