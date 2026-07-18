#!/usr/bin/env python3
"""Tier A deterministic hygiene audit for public repositories."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path
from urllib.parse import urlparse

SCRIPT_VERSION = "0.1.0"
SCHEMA_VERSION = "1.0.0"
COHORT_REF = "v0.1-tier-a"
TOP_LEVEL_NAME_RE = re.compile(r"^[A-Za-z0-9._-]+$")
MAX_BINARY_SIZE = 5 * 1024 * 1024
MAX_TOP_LEVEL_ENTRIES = 30


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the deterministic Tier A hygiene audit and emit a run-record JSON."
    )
    parser.add_argument("target", help="Repository URL or local path to audit")
    parser.add_argument("--out", help="Optional path to write the run-record JSON")
    return parser.parse_args(argv)


def is_remote_target(target: str) -> bool:
    parsed = urlparse(target)
    return parsed.scheme in {"http", "https", "ssh", "git"} or target.startswith("git@")


def clone_repository(url: str) -> tempfile.TemporaryDirectory[str]:
    tempdir = tempfile.TemporaryDirectory(prefix="hygiene-audit-")
    clone_path = Path(tempdir.name) / "repo"
    try:
        subprocess.run(
            ["git", "clone", "--depth", "1", url, str(clone_path)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        tempdir.cleanup()
        raise SystemExit(exc.stderr.strip() or str(exc)) from exc
    return tempdir


def resolve_repository(target: str) -> tuple[Path, tempfile.TemporaryDirectory[str] | None]:
    if is_remote_target(target):
        tempdir = clone_repository(target)
        return Path(tempdir.name) / "repo", tempdir

    path = Path(target).expanduser().resolve()
    if not path.exists():
        raise SystemExit(f"Target does not exist: {path}")
    if not path.is_dir():
        raise SystemExit(f"Target is not a directory: {path}")
    return path, None


def tracked_files(root: Path) -> list[Path] | None:
    if not (root / ".git").exists():
        return None

    try:
        completed = subprocess.run(
            ["git", "-C", str(root), "ls-files", "-z"],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except subprocess.CalledProcessError:
        return None

    files: list[Path] = []
    for raw_path in completed.stdout.split(b"\x00"):
        if not raw_path:
            continue
        relative = Path(raw_path.decode("utf-8"))
        candidate = root / relative
        if candidate.is_file():
            files.append(relative)
    return sorted(files)


def repository_files(root: Path) -> list[Path]:
    tracked = tracked_files(root)
    if tracked is not None:
        return tracked

    files: list[Path] = []
    for path in root.rglob("*"):
        if ".git" in path.parts or not path.is_file():
            continue
        files.append(path.relative_to(root))
    return sorted(files)


def git_metadata(root: Path) -> tuple[str | None, str | None]:
    if not (root / ".git").exists():
        return None, None

    def read_value(*args: str) -> str | None:
        try:
            completed = subprocess.run(
                ["git", "-C", str(root), *args],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
        except subprocess.CalledProcessError:
            return None
        value = completed.stdout.strip()
        return value or None

    return read_value("rev-parse", "HEAD"), read_value("config", "--get", "remote.origin.url")


def build_repo_fingerprint(root: Path, source: str, files: list[Path]) -> str:
    head_sha, remote_url = git_metadata(root)
    payload = {"tracked_files": [str(path) for path in files]}
    if head_sha or remote_url:
        payload.update({"remote_url": remote_url, "head_sha": head_sha})
        if not remote_url:
            payload["source"] = source
    else:
        payload["source"] = str(root.resolve())
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def make_finding(severity: str, detail: str) -> dict[str, object]:
    return {
        "artifact": "hygiene",
        "confidence": 1.0,
        "detail": detail,
        "severity": severity,
    }


def summarise_paths(paths: list[Path], limit: int = 5) -> str:
    listed = [str(path) for path in sorted(paths)[:limit]]
    summary = ", ".join(listed)
    extra = len(paths) - len(listed)
    if extra > 0:
        summary += f", +{extra} more"
    return summary


def load_gitignore_patterns(root: Path) -> list[str]:
    gitignore_path = root / ".gitignore"
    if not gitignore_path.exists():
        return []

    patterns: list[str] = []
    for raw_line in gitignore_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or line.startswith("!"):
            continue
        patterns.append(line.lower())
    return patterns


def has_gitignore_coverage(patterns: list[str], token: str) -> bool:
    for pattern in patterns:
        normalized = pattern
        while normalized.startswith("./"):
            normalized = normalized[2:]
        normalized = normalized.lstrip("/")
        if token == ".env":
            if normalized == ".env" or normalized.startswith(".env"):
                return True
            continue
        if token in normalized:
            return True
    return False


def find_sensitive_filenames(files: list[Path]) -> list[Path]:
    matches: list[Path] = []
    for path in files:
        name = path.name
        if name == ".env" or name.endswith(".pem") or name == "id_rsa" or name == "credentials.json":
            matches.append(path)
    return matches


def find_bulk_artifacts(files: list[Path]) -> list[Path]:
    matches: list[Path] = []
    for path in files:
        if "node_modules" in path.parts or "dist" in path.parts:
            matches.append(path)
    return matches


def is_probably_binary(path: Path) -> bool:
    try:
        with path.open("rb") as handle:
            chunk = handle.read(4096)
    except OSError:
        return False
    if b"\x00" in chunk:
        return True
    try:
        chunk.decode("utf-8")
    except UnicodeDecodeError:
        return True
    return False


def find_large_binaries(root: Path, files: list[Path]) -> list[Path]:
    matches: list[Path] = []
    for relative in files:
        path = root / relative
        try:
            if path.stat().st_size > MAX_BINARY_SIZE and is_probably_binary(path):
                matches.append(relative)
        except OSError:
            continue
    return matches


def readme_path(root: Path) -> Path | None:
    for name in ("README.md", "README.MD"):
        candidate = root / name
        if candidate.exists():
            return candidate
    return None


def has_nontrivial_readme(root: Path) -> bool:
    candidate = readme_path(root)
    if candidate is None:
        return False

    body = candidate.read_text(encoding="utf-8", errors="ignore")
    return len(body.strip()) > 300 and any(line.lstrip().startswith("#") for line in body.splitlines())


def has_license(root: Path) -> bool:
    for name in ("LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"):
        if (root / name).exists():
            return True
    return False


def top_level_entries(files: list[Path]) -> list[str]:
    entries = {path.parts[0] for path in files if path.parts}
    return sorted(entries)


def badge_level(findings: list[dict[str, object]]) -> str:
    severities = [finding["severity"] for finding in findings]
    warn_count = severities.count("warn")
    if "fail" in severities:
        return "needs-work"
    if warn_count == 0:
        return "gold"
    if warn_count == 1:
        return "silver"
    return "bronze"


def audit_repository(root: Path, source: str) -> dict[str, object]:
    files = repository_files(root)
    findings: list[dict[str, object]] = []

    gitignore_path = root / ".gitignore"
    if not gitignore_path.exists():
        findings.append(
            make_finding(
                "warn",
                "Missing .gitignore. Fix: add .gitignore entries for node_modules, .env, dist, build, __pycache__, and .DS_Store.",
            )
        )
    else:
        patterns = load_gitignore_patterns(root)
        expected = [
            ("node_modules", "node_modules"),
            (".env", ".env"),
            ("dist", "dist"),
            ("build", "build"),
            ("__pycache__", "__pycache__"),
            (".DS_Store", ".ds_store"),
        ]
        missing = [label for label, token in expected if not has_gitignore_coverage(patterns, token)]
        if missing:
            findings.append(
                make_finding(
                    "warn",
                    f".gitignore is missing common junk coverage for {', '.join(missing)}. Fix: add ignore rules for those paths.",
                )
            )

    sensitive_filenames = find_sensitive_filenames(files)
    if sensitive_filenames:
        findings.append(
            make_finding(
                "fail",
                f"Sensitive-looking files are committed: {summarise_paths(sensitive_filenames)}. Fix: remove them from git and rotate any exposed credentials.",
            )
        )

    bulk_artifacts = find_bulk_artifacts(files)
    if bulk_artifacts:
        findings.append(
            make_finding(
                "fail",
                f"Build artifacts or vendored bulk are committed: {summarise_paths(bulk_artifacts)}. Fix: remove generated directories from git and ignore them.",
            )
        )

    large_binaries = find_large_binaries(root, files)
    if large_binaries:
        findings.append(
            make_finding(
                "fail",
                f"Large binaries over 5 MB are committed: {summarise_paths(large_binaries)}. Fix: remove them from git or move them to releases/storage.",
            )
        )

    if not has_nontrivial_readme(root):
        findings.append(
            make_finding(
                "warn",
                "README.md is missing or too thin. Fix: add a heading and at least 300 characters describing the project and how to use it.",
            )
        )

    if not has_license(root):
        findings.append(
            make_finding(
                "warn",
                "LICENSE file is missing. Fix: add a standard license file at the repository root.",
            )
        )

    top_level = top_level_entries(files)
    odd_names = [name for name in top_level if not TOP_LEVEL_NAME_RE.fullmatch(name)]
    if odd_names:
        findings.append(
            make_finding(
                "warn",
                f"Top-level names contain spaces or unusual characters: {', '.join(odd_names[:5])}. Fix: rename them to letters, numbers, dots, underscores, or hyphens.",
            )
        )

    if len(top_level) >= MAX_TOP_LEVEL_ENTRIES:
        findings.append(
            make_finding(
                "warn",
                f"Top-level structure is crowded ({len(top_level)} entries). Fix: keep the repository root under 30 top-level entries.",
            )
        )

    if not findings:
        findings.append(
            make_finding(
                "info",
                "Hygiene checks passed. Fix: keep running `python scripts/audit/hygiene.py .` before publishing new runs.",
            )
        )

    return {
        "run_id": str(uuid.uuid4()),
        "repo_fingerprint": build_repo_fingerprint(root, source, files),
        "matrix_cells": ["hygiene"],
        "findings": findings,
        "tokens_spent": 0,
        "script_versions": {
            "hygiene": SCRIPT_VERSION,
            "run_record_schema": SCHEMA_VERSION,
        },
        "previous_run": None,
        "cohort_ref": COHORT_REF,
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "badge_level": badge_level(findings),
        "execution_context": {
            "model": None,
            "cli_version": f"hygiene.py/{SCRIPT_VERSION} (python {sys.version.split()[0]})",
            "entitlement_type": None,
        },
        "dispute": None,
        "correction": None,
    }


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    root, tempdir = resolve_repository(args.target)
    try:
        record = audit_repository(root, args.target)
    finally:
        if tempdir is not None:
            tempdir.cleanup()

    payload = json.dumps(record, indent=2) + "\n"
    if args.out:
        Path(args.out).write_text(payload, encoding="utf-8")
    sys.stdout.write(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
