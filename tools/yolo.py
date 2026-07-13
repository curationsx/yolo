#!/usr/bin/env python3
"""yolo — the CurationsX YOLO repository companion. 🦆

Offline, standard-library-only tooling to discover and validate the
repository's artifacts. No network. No telemetry. No dependencies.

Usage:
    python tools/yolo.py doctor              # validate all artifacts
    python tools/yolo.py list prompts        # index of prompts
    python tools/yolo.py list workflows      # index of workflows
    python tools/yolo.py list cookbooks      # index of cookbook revisions
    python tools/yolo.py list software       # index of software entries
    python tools/yolo.py search <term>       # search artifacts by text
    python tools/yolo.py show <id>           # show one artifact's details
    python tools/yolo.py catalog             # (re)generate catalog.json

Requires Python 3.9+.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

PROMPT_SECTIONS = [
    "Purpose and non-goals",
    "Required inputs",
    "Prompt text",
    "Expected output contract",
    "Limitations and failure modes",
    "Human review requirements",
    "Privacy and data handling",
    "Evaluation checks",
    "Example usage",
]

WORKFLOW_SECTIONS = [
    "Overview",
    "Actors",
    "Inputs and preconditions",
    "Steps",
    "Tools (replaceable categories)",
    "Evidence captured",
    "Failure modes",
    "Rollback and recovery",
    "Privacy considerations",
    "Success measures",
]

TAXONOMY_DIMENSIONS = [
    "intent", "actors", "inputs", "context", "models_tools", "actions",
    "outputs", "human_controls", "evidence_provenance", "risks",
    "feedback_learning",
]

COOKBOOK_STACKS = {
    "ollama", "supabase", "cloudflare", "n8n", "langfuse", "obsidian",
}


# ---------------------------------------------------------------- parsing

def parse_front_matter(text: str) -> tuple[dict, str]:
    """Parse the simple YAML front matter subset used in this repository.

    Supports ``key: value`` scalars and ``key: [a, b, c]`` inline lists.
    Returns (front_matter_dict, body). Raises ValueError on malformed input.
    """
    if not text.startswith("---\n"):
        raise ValueError("missing front matter (file must start with '---')")
    end = text.find("\n---\n", 4)
    if end == -1:
        raise ValueError("unterminated front matter (no closing '---')")
    block, body = text[4:end], text[end + 5:]
    data: dict = {}
    for lineno, line in enumerate(block.splitlines(), start=2):
        if not line.strip() or line.strip().startswith("#"):
            continue
        if ":" not in line:
            raise ValueError(f"line {lineno}: expected 'key: value'")
        key, _, raw = line.partition(":")
        key, raw = key.strip(), raw.strip()
        if raw.startswith("#"):
            raw = ""
        raw = re.sub(r"\s+#.*$", "", raw)  # strip trailing comments
        if raw.startswith("[") and raw.endswith("]"):
            items = [i.strip().strip("'\"") for i in raw[1:-1].split(",")]
            data[key] = [i for i in items if i]
        else:
            data[key] = raw.strip("'\"")
    return data, body


def markdown_sections(body: str) -> list[str]:
    """Return the ``##`` section headings of a Markdown body."""
    return [m.group(1).strip() for m in re.finditer(r"^## (.+)$", body, re.M)]


# ------------------------------------------------- minimal schema validation

def validate_schema(value, schema: dict, path: str = "$") -> list[str]:
    """Validate ``value`` against the JSON-Schema subset used in schemas/.

    Supports: type, required, properties, additionalProperties(false),
    enum, pattern, minLength, minItems, items, and local ``$ref: "#"``.
    Returns a list of error strings (empty means valid).
    """
    errors: list[str] = []
    t = schema.get("type")
    if t == "object":
        if not isinstance(value, dict):
            return [f"{path}: expected object, got {type(value).__name__}"]
        for req in schema.get("required", []):
            if req not in value:
                errors.append(f"{path}: missing required field '{req}'")
        props = schema.get("properties", {})
        for key, sub in props.items():
            if key in value:
                errors.extend(validate_schema(value[key], sub, f"{path}.{key}"))
        if schema.get("additionalProperties") is False:
            for key in value:
                if key not in props:
                    errors.append(f"{path}: unexpected field '{key}'")
    elif t == "string":
        if not isinstance(value, str):
            return [f"{path}: expected string, got {type(value).__name__}"]
        if "enum" in schema and value not in schema["enum"]:
            errors.append(f"{path}: '{value}' not one of {schema['enum']}")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errors.append(f"{path}: '{value}' does not match {schema['pattern']!r}")
        if len(value) < schema.get("minLength", 0):
            errors.append(f"{path}: shorter than minLength {schema['minLength']}")
    elif t == "array":
        if not isinstance(value, list):
            return [f"{path}: expected array, got {type(value).__name__}"]
        if len(value) < schema.get("minItems", 0):
            errors.append(f"{path}: fewer than minItems {schema['minItems']}")
        item_schema = schema.get("items")
        if item_schema:
            for i, item in enumerate(value):
                errors.extend(validate_schema(item, item_schema, f"{path}[{i}]"))
    if "$ref" in schema and schema["$ref"] == "#":
        # resolved by caller supplying the root schema as items — see load_software
        pass
    return errors


def load_schema(name: str) -> dict:
    return json.loads((REPO_ROOT / "schemas" / name).read_text(encoding="utf-8"))


# ---------------------------------------------------------------- loaders

def load_prompts() -> tuple[list[dict], list[str]]:
    """Load prompt artifacts. Returns (artifacts, problems)."""
    return _load_markdown_dir("prompts", load_schema("prompt.schema.json"),
                              PROMPT_SECTIONS, kind="prompt")


def load_workflows() -> tuple[list[dict], list[str]]:
    return _load_markdown_dir("workflows", load_schema("workflow.schema.json"),
                              WORKFLOW_SECTIONS, kind="workflow")


def _load_markdown_dir(dirname: str, schema: dict, required_sections: list[str],
                       kind: str) -> tuple[list[dict], list[str]]:
    artifacts, problems = [], []
    directory = REPO_ROOT / dirname
    for path in sorted(directory.glob("*.md")):
        if path.name == "README.md":
            continue
        rel = path.relative_to(REPO_ROOT)
        try:
            meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
        except ValueError as exc:
            problems.append(f"{rel}: {exc}")
            continue
        for err in validate_schema(meta, schema, "$"):
            problems.append(f"{rel}: {err}")
        sections = markdown_sections(body)
        for section in required_sections:
            if section not in sections:
                problems.append(f"{rel}: missing required section '## {section}'")
        if kind == "prompt":
            cat, pid = meta.get("category", "?"), meta.get("id", "?")
            expected = f"{pid}.md" if pid.startswith(f"{cat}-") or pid == cat else f"{cat}-{pid}.md"
            if path.name != expected:
                problems.append(f"{rel}: filename should be '{expected}'")
        elif kind == "workflow":
            expected = f"{meta.get('id', '?')}.md"
            if path.name != expected:
                problems.append(f"{rel}: filename should be '{expected}'")
        meta["_file"] = str(rel)
        meta["_kind"] = kind
        meta["_body"] = body
        artifacts.append(meta)
    ids = [a.get("id") for a in artifacts]
    for dup in {i for i in ids if ids.count(i) > 1}:
        problems.append(f"{dirname}/: duplicate id '{dup}'")
    return artifacts, problems


def load_software() -> tuple[list[dict], list[str]]:
    problems: list[str] = []
    path = REPO_ROOT / "software" / "entries.json"
    rel = path.relative_to(REPO_ROOT)
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [], [f"{rel}: {exc}"]
    schema = load_schema("software-entry.schema.json")
    collection = schema["definitions"]["collection"]
    for err in validate_schema(doc, collection, "$"):
        problems.append(f"{rel}: {err}")
    entries = doc.get("entries", []) if isinstance(doc, dict) else []
    for i, entry in enumerate(entries):
        for err in validate_schema(entry, schema, f"$.entries[{i}]"):
            problems.append(f"{rel}: {err}")
        if isinstance(entry, dict):
            entry["_kind"] = "software"
            entry["_file"] = str(rel)
    ids = [e.get("id") for e in entries if isinstance(e, dict)]
    for dup in {i for i in ids if ids.count(i) > 1}:
        problems.append(f"{rel}: duplicate id '{dup}'")
    return [e for e in entries if isinstance(e, dict)], problems


def load_cookbooks() -> tuple[list[dict], list[str]]:
    """Load cookbook revisions and verify their prompt-source contracts."""
    problems: list[str] = []
    path = REPO_ROOT / "cookbooks" / "entries.json"
    rel = path.relative_to(REPO_ROOT)
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [], [f"{rel}: {exc}"]

    schema = load_schema("cookbook-entry.schema.json")
    collection = schema["definitions"]["collection"]
    for err in validate_schema(doc, collection, "$"):
        problems.append(f"{rel}: {err}")

    entries = doc.get("entries", []) if isinstance(doc, dict) else []
    prompt_by_file = {
        prompt["_file"]: prompt
        for prompt in load_prompts()[0]
    }
    for i, entry in enumerate(entries):
        for err in validate_schema(entry, schema, f"$.entries[{i}]"):
            problems.append(f"{rel}: {err}")
        if not isinstance(entry, dict):
            continue

        source_path = entry.get("source_prompt", "")
        source = prompt_by_file.get(source_path)
        if not source:
            problems.append(
                f"{rel}: $.entries[{i}].source_prompt: "
                f"'{source_path}' is not a valid prompt artifact"
            )
        else:
            expected = {
                "source_prompt_id": source.get("id"),
                "source_version": source.get("version"),
                "source_status": source.get("status"),
                "category": source.get("category"),
            }
            for field, value in expected.items():
                if entry.get(field) != value:
                    problems.append(
                        f"{rel}: $.entries[{i}].{field}: "
                        f"expected '{value}' from {source_path}"
                    )

        strong = set(entry.get("strong_fit", []))
        partial = set(entry.get("partial_fit", []))
        overlap = strong & partial
        if overlap:
            problems.append(
                f"{rel}: $.entries[{i}]: stack fit overlaps: "
                f"{', '.join(sorted(overlap))}"
            )
        covered = strong | partial
        if covered != COOKBOOK_STACKS:
            missing = COOKBOOK_STACKS - covered
            extra = covered - COOKBOOK_STACKS
            detail = []
            if missing:
                detail.append(f"missing {', '.join(sorted(missing))}")
            if extra:
                detail.append(f"unknown {', '.join(sorted(extra))}")
            problems.append(
                f"{rel}: $.entries[{i}]: stack fit must cover all stacks "
                f"({'; '.join(detail)})"
            )

        entry["_kind"] = "cookbook"
        entry["_file"] = str(rel)

    ids = [e.get("id") for e in entries if isinstance(e, dict)]
    for dup in {i for i in ids if ids.count(i) > 1}:
        problems.append(f"{rel}: duplicate id '{dup}'")
    return [e for e in entries if isinstance(e, dict)], problems


def check_taxonomy() -> list[str]:
    problems: list[str] = []
    path = REPO_ROOT / "taxonomy" / "taxonomy.json"
    rel = path.relative_to(REPO_ROOT)
    try:
        doc = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"{rel}: {exc}"]
    if not re.fullmatch(r"\d+\.\d+\.\d+", str(doc.get("version", ""))):
        problems.append(f"{rel}: 'version' must be semver")
    dims = doc.get("dimensions", {})
    for dim in TAXONOMY_DIMENSIONS:
        if dim not in dims:
            problems.append(f"{rel}: missing dimension '{dim}'")
        elif not dims[dim].get("concepts"):
            problems.append(f"{rel}: dimension '{dim}' has no concepts")
    for dim in dims:
        if dim not in TAXONOMY_DIMENSIONS:
            problems.append(f"{rel}: unknown dimension '{dim}' (update tools/yolo.py if intentional)")
    return problems


# ---------------------------------------------------------------- catalog

def build_catalog() -> dict:
    """Build the deterministic catalog structure from repository artifacts."""
    prompts, _ = load_prompts()
    workflows, _ = load_workflows()
    cookbooks, _ = load_cookbooks()
    software, _ = load_software()

    def public(meta: dict) -> dict:
        return {k: v for k, v in sorted(meta.items())
                if not k.startswith("_")} | {"file": meta["_file"]}

    return {
        "$comment": "Generated by 'python tools/yolo.py catalog'. Do not edit by hand.",
        "prompts": [public(p) for p in prompts],
        "workflows": [public(w) for w in workflows],
        "cookbooks": [public(c) for c in cookbooks],
        "software": [public(s) for s in software],
    }


def catalog_text() -> str:
    return json.dumps(build_catalog(), indent=2, sort_keys=True) + "\n"


# ---------------------------------------------------------------- commands

def cmd_doctor() -> int:
    problems: list[str] = []
    prompts, p1 = load_prompts()
    workflows, p2 = load_workflows()
    cookbooks, p3 = load_cookbooks()
    software, p4 = load_software()
    problems += p1 + p2 + p3 + p4 + check_taxonomy()

    if not prompts:
        problems.append("prompts/: no prompt artifacts found")
    if not workflows:
        problems.append("workflows/: no workflow artifacts found")

    catalog_path = REPO_ROOT / "catalog.json"
    if catalog_path.exists():
        if catalog_path.read_text(encoding="utf-8") != catalog_text():
            problems.append("catalog.json: stale — regenerate with 'python tools/yolo.py catalog'")
    else:
        problems.append("catalog.json: missing — generate with 'python tools/yolo.py catalog'")

    checked = len(prompts) + len(workflows) + len(cookbooks) + len(software)
    if problems:
        print(f"🦆 doctor: {len(problems)} problem(s) across {checked} artifact(s):\n")
        for problem in problems:
            print(f"  ✗ {problem}")
        return 1
    print(f"🦆 doctor: all checks passed — {len(prompts)} prompts, "
          f"{len(workflows)} workflows, {len(cookbooks)} cookbooks, "
          f"{len(software)} software entries healthy.")
    return 0


def cmd_list(what: str) -> int:
    if what == "prompts":
        items, _ = load_prompts()
        rows = [(i["id"], i.get("category", ""), i.get("status", ""),
                 i.get("version", ""), i.get("title", "")) for i in items]
        _table(("ID", "CATEGORY", "STATUS", "VERSION", "TITLE"), rows)
    elif what == "workflows":
        items, _ = load_workflows()
        rows = [(i["id"], i.get("maturity", ""), i.get("status", ""),
                 i.get("version", ""), i.get("title", "")) for i in items]
        _table(("ID", "MATURITY", "STATUS", "VERSION", "TITLE"), rows)
    elif what == "software":
        items, _ = load_software()
        rows = [(i["id"], i.get("category", ""), i.get("deployment", ""),
                 i.get("name", "")) for i in items]
        _table(("ID", "CATEGORY", "DEPLOYMENT", "NAME"), rows)
    elif what == "cookbooks":
        items, _ = load_cookbooks()
        rows = [(i["id"], i.get("category", ""), i.get("release_status", ""),
                 i.get("version", ""), i.get("title", "")) for i in items]
        _table(("ID", "CATEGORY", "STATUS", "VERSION", "TITLE"), rows)
    else:
        print(
            f"unknown list target '{what}' "
            "(expected: prompts, workflows, cookbooks, software)"
        )
        return 2
    return 0


def cmd_search(term: str) -> int:
    term_lower = term.lower()
    hits = []
    for meta in load_prompts()[0] + load_workflows()[0]:
        haystack = " ".join([meta.get("title", ""), meta.get("id", ""),
                             " ".join(meta.get("tags", [])), meta.get("_body", "")]).lower()
        if term_lower in haystack:
            hits.append((meta["_kind"], meta["id"], meta.get("title", "")))
    for entry in load_software()[0]:
        haystack = " ".join(str(v) for k, v in entry.items()
                            if not k.startswith("_")).lower()
        if term_lower in haystack:
            hits.append(("software", entry["id"], entry.get("name", "")))
    for cookbook in load_cookbooks()[0]:
        haystack = " ".join(str(v) for k, v in cookbook.items()
                            if not k.startswith("_")).lower()
        if term_lower in haystack:
            hits.append(("cookbook", cookbook["id"], cookbook.get("title", "")))
    if not hits:
        print(f"no matches for '{term}'")
        return 1
    _table(("KIND", "ID", "TITLE"), hits)
    return 0


def cmd_show(artifact_id: str) -> int:
    for meta in load_prompts()[0] + load_workflows()[0]:
        if meta.get("id") == artifact_id:
            print(f"{meta.get('title')}  [{meta['_kind']}]")
            print(f"  {'file:':<10}{meta['_file']}")
            for key in ("category", "maturity", "status", "version", "license"):
                if key in meta:
                    print(f"  {key + ':':<10}{meta[key]}")
            print(f"  {'tags:':<10}{', '.join(meta.get('tags', []))}")
            print("  sections:")
            for section in markdown_sections(meta["_body"]):
                print(f"    - {section}")
            print(f"\nOpen {meta['_file']} for the full artifact.")
            return 0
    for entry in load_software()[0]:
        if entry.get("id") == artifact_id:
            print(f"{entry.get('name')}  [software]")
            for key in ("category", "deployment", "primary_use",
                        "notable_strength", "verify_before_use", "reference"):
                print(f"  {key}: {entry.get(key)}")
            return 0
    for cookbook in load_cookbooks()[0]:
        if cookbook.get("id") == artifact_id:
            print(f"{cookbook.get('title')}  [cookbook]")
            for key in ("category", "version", "release_status", "source_prompt",
                        "source_version", "source_status"):
                print(f"  {key}: {cookbook.get(key)}")
            print(f"  strong_fit: {', '.join(cookbook.get('strong_fit', []))}")
            print(f"  partial_fit: {', '.join(cookbook.get('partial_fit', []))}")
            return 0
    print(f"no artifact with id '{artifact_id}' (try: python tools/yolo.py list prompts)")
    return 1


def cmd_catalog() -> int:
    path = REPO_ROOT / "catalog.json"
    text = catalog_text()
    changed = not path.exists() or path.read_text(encoding="utf-8") != text
    path.write_text(text, encoding="utf-8")
    print(f"catalog.json {'updated' if changed else 'already up to date'} "
          f"({len(build_catalog()['prompts'])} prompts, "
          f"{len(build_catalog()['workflows'])} workflows, "
          f"{len(build_catalog()['cookbooks'])} cookbooks, "
          f"{len(build_catalog()['software'])} software entries)")
    return 0


def _table(headers: tuple, rows: list) -> None:
    if not rows:
        print("(none)")
        return
    widths = [max(len(str(headers[i])), *(len(str(r[i])) for r in rows))
              for i in range(len(headers))]
    line = "  ".join(str(h).ljust(widths[i]) for i, h in enumerate(headers))
    print(line)
    print("  ".join("-" * w for w in widths))
    for row in rows:
        print("  ".join(str(c).ljust(widths[i]) for i, c in enumerate(row)))


def main(argv: list[str]) -> int:
    if len(argv) < 1 or argv[0] in ("-h", "--help", "help"):
        print(__doc__.strip())
        return 0
    cmd, args = argv[0], argv[1:]
    if cmd == "doctor":
        return cmd_doctor()
    if cmd == "list" and len(args) == 1:
        return cmd_list(args[0])
    if cmd == "search" and len(args) >= 1:
        return cmd_search(" ".join(args))
    if cmd == "show" and len(args) == 1:
        return cmd_show(args[0])
    if cmd == "catalog":
        return cmd_catalog()
    print(f"unrecognized command: {cmd} {' '.join(args)}\n")
    print(__doc__.strip())
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
