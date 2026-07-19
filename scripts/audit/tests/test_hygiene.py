from __future__ import annotations

import importlib.util
import json
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
HYGIENE_PATH = ROOT / "scripts" / "audit" / "hygiene.py"
VALIDATE_PATH = ROOT / "scripts" / "audit" / "validate.py"


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


hygiene = load_module(HYGIENE_PATH, "hygiene")
validate = load_module(VALIDATE_PATH, "validate_run_record")


def write_clean_repo(root: Path) -> None:
    root.joinpath("README.md").write_text(
        "# Clean Repo\n\n" + "This repository is intentionally tidy for the hygiene audit tests. " * 8,
        encoding="utf-8",
    )
    root.joinpath("LICENSE").write_text("MIT\n", encoding="utf-8")
    root.joinpath(".gitignore").write_text(
        "\n".join([
            "node_modules/",
            ".env",
            "dist/",
            "build/",
            "__pycache__/",
            ".DS_Store",
        ])
        + "\n",
        encoding="utf-8",
    )
    root.joinpath("app.py").write_text("print('ok')\n", encoding="utf-8")


def get_finding(record: dict, check_id: str) -> dict:
    """Return the finding with the given check_id, or raise."""
    return next(f for f in record["findings"] if f["check_id"] == check_id)


def test_clean_repo_passes_all_checks(tmp_path: Path) -> None:
    write_clean_repo(tmp_path)

    record = hygiene.audit_repository(tmp_path, str(tmp_path))

    assert record["checks_passed"] == record["checks_total"] == 7
    assert record["ruleset_version"] == "hygiene/0.1.0"
    assert validate.validate_record(record) == []
    assert all(finding["severity"] in {"info", "warn", "fail"} for finding in record["findings"])


def test_missing_gitignore_fails_gitignore_present(tmp_path: Path) -> None:
    write_clean_repo(tmp_path)
    tmp_path.joinpath(".gitignore").unlink()

    record = hygiene.audit_repository(tmp_path, str(tmp_path))

    gitignore_finding = get_finding(record, "gitignore_present")
    assert gitignore_finding["passed"] is False
    assert gitignore_finding["severity"] == "fail"
    coverage_finding = get_finding(record, "gitignore_coverage")
    assert coverage_finding["passed"] is False
    assert record["checks_total"] == 7
    assert validate.validate_record(record) == []


def test_committed_env_file_fails_sensitive_filenames(tmp_path: Path) -> None:
    write_clean_repo(tmp_path)
    tmp_path.joinpath(".env").write_text("SECRET=1\n", encoding="utf-8")

    record = hygiene.audit_repository(tmp_path, str(tmp_path))

    sensitive_finding = get_finding(record, "sensitive_filenames")
    assert sensitive_finding["passed"] is False
    assert sensitive_finding["severity"] == "fail"
    assert ".env" in sensitive_finding["detail"]
    assert record["checks_total"] == 7
    assert validate.validate_record(record) == []


def test_this_repo_emits_a_valid_run_record() -> None:
    record = hygiene.audit_repository(ROOT, str(ROOT))

    assert record["matrix_cells"] == ["hygiene"]
    assert record["checks_total"] == 7
    assert record["ruleset_version"] == "hygiene/0.1.0"
    assert isinstance(record["wall_clock_seconds"], float)
    assert record["github_api_requests"] == 0
    assert record["files_inspected"] > 0
    assert record["bytes_inspected"] > 0
    assert validate.validate_record(record) == []
    json.dumps(record)


# ---------------------------------------------------------------------------
# Pinned commit SHA tests
# ---------------------------------------------------------------------------


def _init_git_repo(root: Path) -> str:
    """Initialise a git repo at *root*, commit all files, and return HEAD SHA."""
    subprocess.run(["git", "init", str(root)], check=True, capture_output=True)
    subprocess.run(
        ["git", "-C", str(root), "config", "user.email", "ci@test"],
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "-C", str(root), "config", "user.name", "CI"],
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "-C", str(root), "add", "."],
        check=True,
        capture_output=True,
    )
    subprocess.run(
        ["git", "-C", str(root), "commit", "-m", "init"],
        check=True,
        capture_output=True,
    )
    result = subprocess.run(
        ["git", "-C", str(root), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def test_commit_sha_arg_is_accepted(tmp_path: Path) -> None:
    """--commit-sha argument must be parsed without error."""
    args = hygiene.parse_args([".", "--commit-sha", "a" * 40])
    assert args.commit_sha == "a" * 40


def test_lowercase_sha_is_accepted_before_git_io() -> None:
    hygiene._validate_sha_format("a" * 40)


def test_uppercase_sha_is_rejected_before_git_io(monkeypatch: pytest.MonkeyPatch) -> None:
    """Uppercase SHA must fail fast before any git subprocess call."""

    def fail_if_called(*args, **kwargs):
        raise AssertionError("subprocess.run should not be called for invalid SHA")

    monkeypatch.setattr(hygiene.subprocess, "run", fail_if_called)
    with pytest.raises(SystemExit, match="Invalid commit SHA"):
        hygiene.resolve_repository("https://github.com/curationsx/yolo.git", commit_sha="A" * 40)


def test_invalid_sha_format_raises(tmp_path: Path) -> None:
    """An obviously malformed SHA (too short) must be rejected before any git I/O."""
    with pytest.raises(SystemExit, match="Invalid commit SHA"):
        hygiene.resolve_repository(str(tmp_path), commit_sha="not-a-sha")


def test_correct_sha_local_repo_passes(tmp_path: Path) -> None:
    """resolve_repository with the actual HEAD SHA must succeed on a local git repo."""
    write_clean_repo(tmp_path)
    actual_sha = _init_git_repo(tmp_path)

    root, tempdir = hygiene.resolve_repository(str(tmp_path), commit_sha=actual_sha)
    assert tempdir is None
    assert root == tmp_path.resolve()


def test_sha_mismatch_local_repo_fails_closed(tmp_path: Path) -> None:
    """resolve_repository must raise SystemExit when the supplied SHA does not match HEAD."""
    write_clean_repo(tmp_path)
    _init_git_repo(tmp_path)

    wrong_sha = "0" * 40
    with pytest.raises(SystemExit, match="SHA mismatch"):
        hygiene.resolve_repository(str(tmp_path), commit_sha=wrong_sha)


def test_pinned_sha_appears_in_run_record(tmp_path: Path) -> None:
    """The run-record commit_sha field must equal the pinned SHA when one is supplied."""
    write_clean_repo(tmp_path)
    actual_sha = _init_git_repo(tmp_path)

    root, _ = hygiene.resolve_repository(str(tmp_path), commit_sha=actual_sha)
    record = hygiene.audit_repository(root, str(tmp_path))

    assert record["commit_sha"] == actual_sha
    assert validate.validate_record(record) == []


def test_tokens_spent_is_zero(tmp_path: Path) -> None:
    """tokens_spent must always be 0 for Tier A (no LLM calls)."""
    write_clean_repo(tmp_path)
    record = hygiene.audit_repository(tmp_path, str(tmp_path))
    assert record["tokens_spent"] == 0


def test_corpus_run_records_are_valid() -> None:
    """Every committed run-record under docs/audits/run-records/ must be schema-valid."""
    records_dir = ROOT / "docs" / "audits" / "run-records"
    record_files = sorted(records_dir.glob("*.json"))
    assert record_files, "Expected at least one committed run-record"

    problems: dict[str, list[str]] = {}
    for path in record_files:
        record = json.loads(path.read_text(encoding="utf-8"))
        errs = validate.validate_record(record)
        if errs:
            problems[path.name] = errs

    if problems:
        lines = []
        for name, errs in problems.items():
            lines.append(f"{name}:")
            lines.extend(f"  {e}" for e in errs)
        raise AssertionError("Invalid committed run-records:\n" + "\n".join(lines))
