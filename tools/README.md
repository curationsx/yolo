# Tools

## `yolo.py` — the repository companion 🦆

A single-file, standard-library-only CLI (Python 3.9+). Offline by design: no network, no telemetry, no dependencies, nothing to install. It never executes prompts against any model API — it manages the artifacts, humans run the prompts.

```bash
python tools/yolo.py doctor              # validate all artifacts
python tools/yolo.py list prompts        # index of prompts
python tools/yolo.py list workflows      # index of workflows
python tools/yolo.py list software       # index of software entries
python tools/yolo.py search "research"   # search artifacts by text
python tools/yolo.py show rubber-duck-debugging
python tools/yolo.py catalog             # (re)generate catalog.json
```

### What `doctor` checks

- Every prompt and workflow has parseable front matter that validates against its schema in [schemas/](../schemas/) (required fields, enums, semver, slug patterns, no unknown fields).
- Every prompt and workflow contains its required Markdown sections in the documented format.
- Filenames follow the conventions; ids are unique.
- `software/entries.json` validates against its schema.
- `taxonomy/taxonomy.json` is versioned and covers all eleven AoT dimensions.
- `catalog.json` exists and exactly matches what `catalog` would generate (deterministic check).

Exit code 0 means healthy; 1 means problems (listed); suitable for CI.

### Tests

```bash
python -m unittest discover tools/tests
```

The suite covers the front-matter parser, the schema validator, every CLI command, and — deliberately — the health of the repository's own artifacts, so a broken artifact fails the tests.

### Design constraints (on purpose)

- **Standard library only.** Cloning is installing.
- **Deterministic.** `catalog` output is sorted and stable; `doctor` can verify it byte-for-byte.
- **No execution of prompts.** This tool curates artifacts; humans and their chosen tools run them.
- **Cross-platform.** Pure Python, `pathlib` throughout, no shell calls.
