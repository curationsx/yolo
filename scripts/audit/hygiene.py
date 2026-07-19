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
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

SCRIPT_VERSION = "0.1.0"
SCHEMA_VERSION = "1.1.0"
COHORT_REF = "v0.1-tier-a"
RULESET_VERSION = "hygiene/0.1.0"
TOP_LEVEL_NAME_RE = re.compile(r"^[A-Za-z0-9._-]+$")
MAX_BINARY_SIZE = 5 * 1024 * 1024
MAX_TOP_LEVEL_ENTRIES = 30


SHA_RE = re.compile(r"^[0-9a-f]{40}$", re.IGNORECASE)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the deterministic Tier A hygiene audit and emit a run-record JSON."
    )
    parser.add_argument("target", help="Repository URL or local path to audit")
    parser.add_argument("--out", help="Optional path to write the run-record JSON")
    parser.add_argument(
        "--previous-run",
        dest="previous_run",
        default=None,
        help="UUID of the previous run-record (sets the previous_run lineage field)",
    )
    parser.add_argument(
        "--commit-sha",
        dest="commit_sha",
        default=None,
        help=(
            "Full 40-character immutable commit SHA to audit. "
            "For remote URLs the clone is pinned to exactly this SHA; "
            "the run fails closed if the SHA is invalid or unreachable. "
            "For local paths the current HEAD must match this SHA."
        ),
    )
    return parser.parse_args(argv)


def is_remote_target(target: str) -> bool:
    parsed = urlparse(target)
    return parsed.scheme in {"http", "https", "ssh", "git"} or target.startswith("git@")


def _validate_sha_format(commit_sha: str) -> None:
    """Raise SystemExit if *commit_sha* is not a full 40-character hex SHA."""
    if not SHA_RE.fullmatch(commit_sha):
        raise SystemExit(
            f"Invalid commit SHA: {commit_sha!r}. "
            "Must be a full 40-character lowercase hexadecimal string."
        )


def clone_repository(url: str, commit_sha: str | None = None) -> tempfile.TemporaryDirectory[str]:
    tempdir = tempfile.TemporaryDirectory(prefix="hygiene-audit-")
    clone_path = Path(tempdir.name) / "repo"

    if commit_sha is not None:
        _validate_sha_format(commit_sha)
        # Fetch only the pinned commit: init → remote add → fetch <sha> → checkout
        clone_path.mkdir(parents=True, exist_ok=True)
        try:
            subprocess.run(
                ["git", "init", str(clone_path)],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            subprocess.run(
                ["git", "-C", str(clone_path), "remote", "add", "origin", url],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            subprocess.run(
                ["git", "-C", str(clone_path), "fetch", "--depth", "1", "origin", commit_sha],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            subprocess.run(
                ["git", "-C", str(clone_path), "checkout", "FETCH_HEAD"],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
        except subprocess.CalledProcessError as exc:
            tempdir.cleanup()
            raise SystemExit(
                f"Failed to fetch commit {commit_sha} from {url}: {exc.stderr.strip() or str(exc)}"
            ) from exc

        # Verify the checked-out HEAD matches the requested SHA (fail closed on mismatch).
        try:
            result = subprocess.run(
                ["git", "-C", str(clone_path), "rev-parse", "HEAD"],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
        except subprocess.CalledProcessError as exc:
            tempdir.cleanup()
            raise SystemExit("Could not resolve HEAD after checkout.") from exc
        actual_sha = result.stdout.strip()
        if actual_sha.lower() != commit_sha.lower():
            tempdir.cleanup()
            raise SystemExit(
                f"SHA mismatch: requested {commit_sha} but checked-out HEAD is {actual_sha}. "
                "Refusing to audit an unverified revision."
            )
    else:
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


def resolve_repository(
    target: str, commit_sha: str | None = None
) -> tuple[Path, tempfile.TemporaryDirectory[str] | None]:
    if is_remote_target(target):
        tempdir = clone_repository(target, commit_sha)
        return Path(tempdir.name) / "repo", tempdir

    path = Path(target).expanduser().resolve()
    if not path.exists():
        raise SystemExit(f"Target does not exist: {path}")
    if not path.is_dir():
        raise SystemExit(f"Target is not a directory: {path}")

    if commit_sha is not None:
        _validate_sha_format(commit_sha)
        if not (path / ".git").exists():
            raise SystemExit(
                f"Cannot verify commit SHA for {path}: directory is not a git repository."
            )
        head_sha, _ = git_metadata(path)
        if head_sha is None:
            raise SystemExit(f"Cannot read HEAD for {path}.")
        if head_sha.lower() != commit_sha.lower():
            raise SystemExit(
                f"SHA mismatch: requested {commit_sha} but HEAD is {head_sha}. "
                "Refusing to audit an unverified revision."
            )

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


def make_check_finding(
    check_id: str,
    passed: bool,
    severity_on_fail: str,
    detail: str,
) -> dict[str, object]:
    """Build a per-check finding dict matching the run-record schema.

    When a check passes the severity is always ``"info"``; when it fails the
    severity is taken from the capability manifest (``severity_on_fail``).
    """
    return {
        "check_id": check_id,
        "artifact": "hygiene",
        "confidence": 1.0,
        "passed": passed,
        "severity": "info" if passed else severity_on_fail,
        "detail": detail,
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


def audit_repository(
    root: Path, source: str, previous_run: str | None = None
) -> dict[str, object]:
    start_time = time.monotonic()
    files = repository_files(root)

    # Accumulate bytes inspected across all tracked files.
    bytes_inspected = 0
    for rel_path in files:
        try:
            bytes_inspected += (root / rel_path).stat().st_size
        except OSError:
            pass

    findings: list[dict[str, object]] = []

    # --- Check 1: gitignore_present ---
    gitignore_path = root / ".gitignore"
    gitignore_exists = gitignore_path.exists()
    if gitignore_exists:
        findings.append(
            make_check_finding(
                "gitignore_present",
                True,
                "fail",
                ".gitignore is present at the repository root.",
            )
        )
    else:
        findings.append(
            make_check_finding(
                "gitignore_present",
                False,
                "fail",
                "Missing .gitignore. Fix: add .gitignore entries for node_modules, .env, dist, build, __pycache__, and .DS_Store.",
            )
        )

    # --- Check 2: gitignore_coverage ---
    if gitignore_exists:
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
                make_check_finding(
                    "gitignore_coverage",
                    False,
                    "warn",
                    f".gitignore is missing common junk coverage for {', '.join(missing)}. Fix: add ignore rules for those paths.",
                )
            )
        else:
            findings.append(
                make_check_finding(
                    "gitignore_coverage",
                    True,
                    "warn",
                    ".gitignore covers common secret and junk patterns.",
                )
            )
    else:
        findings.append(
            make_check_finding(
                "gitignore_coverage",
                False,
                "warn",
                ".gitignore is absent; coverage cannot be assessed. Fix: add a .gitignore with common secret and junk patterns.",
            )
        )

    # --- Check 3: sensitive_filenames ---
    sensitive = find_sensitive_filenames(files)
    if sensitive:
        findings.append(
            make_check_finding(
                "sensitive_filenames",
                False,
                "fail",
                f"Sensitive-looking files are committed: {summarise_paths(sensitive)}. Fix: remove them from git and rotate any exposed credentials.",
            )
        )
    else:
        findings.append(
            make_check_finding(
                "sensitive_filenames",
                True,
                "fail",
                "No sensitive-looking filenames detected in the repository tree.",
            )
        )

    # --- Check 4: no_vendored_binary_bulk ---
    bulk = find_bulk_artifacts(files)
    large = find_large_binaries(root, files)
    all_bulk = bulk + [f for f in large if f not in bulk]
    if all_bulk:
        findings.append(
            make_check_finding(
                "no_vendored_binary_bulk",
                False,
                "warn",
                f"Build artifacts or vendored bulk are committed: {summarise_paths(all_bulk)}. Fix: remove generated directories from git and ignore them.",
            )
        )
    else:
        findings.append(
            make_check_finding(
                "no_vendored_binary_bulk",
                True,
                "warn",
                "No unexpected vendored or binary bulk detected.",
            )
        )

    # --- Check 5: readme_nontrivial ---
    if has_nontrivial_readme(root):
        findings.append(
            make_check_finding(
                "readme_nontrivial",
                True,
                "warn",
                "README.md is present and has meaningful content.",
            )
        )
    else:
        findings.append(
            make_check_finding(
                "readme_nontrivial",
                False,
                "warn",
                "README.md is missing or too thin. Fix: add a heading and at least 300 characters describing the project.",
            )
        )

    # --- Check 6: licence_present ---
    if has_license(root):
        findings.append(
            make_check_finding(
                "licence_present",
                True,
                "warn",
                "Licence file is present at the repository root.",
            )
        )
    else:
        findings.append(
            make_check_finding(
                "licence_present",
                False,
                "warn",
                "LICENSE file is missing. Fix: add a standard license file at the repository root.",
            )
        )

    # --- Check 7: top_level_structure ---
    top_level = top_level_entries(files)
    odd_names = [name for name in top_level if not TOP_LEVEL_NAME_RE.fullmatch(name)]
    if odd_names:
        findings.append(
            make_check_finding(
                "top_level_structure",
                False,
                "info",
                f"Top-level names contain spaces or unusual characters: {', '.join(odd_names[:5])}. Fix: rename them to letters, numbers, dots, underscores, or hyphens.",
            )
        )
    elif len(top_level) >= MAX_TOP_LEVEL_ENTRIES:
        findings.append(
            make_check_finding(
                "top_level_structure",
                False,
                "info",
                f"Top-level structure is crowded ({len(top_level)} entries). Fix: keep the repository root under 30 top-level entries.",
            )
        )
    else:
        findings.append(
            make_check_finding(
                "top_level_structure",
                True,
                "info",
                "Top-level directory structure looks coherent.",
            )
        )

    checks_total = len(findings)  # Always 7 for hygiene/0.1.0
    checks_passed = sum(1 for f in findings if f["passed"])

    commit_sha, _ = git_metadata(root)

    wall_clock_seconds = round(time.monotonic() - start_time, 3)

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
        "previous_run": previous_run,
        "cohort_ref": COHORT_REF,
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "execution_context": {
            "model": None,
            "cli_version": f"hygiene.py/{SCRIPT_VERSION} (python {sys.version.split()[0]})",
            "entitlement_type": None,
        },
        "dispute": None,
        "correction": None,
        "wall_clock_seconds": wall_clock_seconds,
        "github_api_requests": 1 if is_remote_target(source) else 0,
        "files_inspected": len(files),
        "bytes_inspected": bytes_inspected,
        "checks_passed": checks_passed,
        "checks_total": checks_total,
        "ruleset_version": RULESET_VERSION,
        "commit_sha": commit_sha,
    }


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    root, tempdir = resolve_repository(args.target, commit_sha=args.commit_sha)
    try:
        record = audit_repository(root, args.target, previous_run=args.previous_run)
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
