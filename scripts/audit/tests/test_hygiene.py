from __future__ import annotations

import importlib.util
import json
from pathlib import Path

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
