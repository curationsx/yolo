"""Tests for tools/yolo.py — run with:  python -m unittest discover tools/tests"""

import io
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import yolo  # noqa: E402


class TestFrontMatter(unittest.TestCase):
    def test_parses_scalars_and_lists(self):
        text = "---\nid: demo\nversion: 0.1.0\ntags: [a, b-c]\n---\nbody here\n"
        meta, body = yolo.parse_front_matter(text)
        self.assertEqual(meta["id"], "demo")
        self.assertEqual(meta["tags"], ["a", "b-c"])
        self.assertEqual(body, "body here\n")

    def test_strips_trailing_comments(self):
        meta, _ = yolo.parse_front_matter("---\nstatus: draft  # note\n---\n")
        self.assertEqual(meta["status"], "draft")

    def test_missing_front_matter_raises(self):
        with self.assertRaises(ValueError):
            yolo.parse_front_matter("no front matter")

    def test_unterminated_front_matter_raises(self):
        with self.assertRaises(ValueError):
            yolo.parse_front_matter("---\nid: x\n")


class TestSchemaValidation(unittest.TestCase):
    def test_valid_prompt_meta_passes(self):
        schema = yolo.load_schema("prompt.schema.json")
        meta = {"id": "demo", "title": "Demo", "category": "safety",
                "version": "1.0.0", "status": "draft", "license": "MIT",
                "tags": ["safety"]}
        self.assertEqual(yolo.validate_schema(meta, schema), [])

    def test_bad_enum_and_missing_field_reported(self):
        schema = yolo.load_schema("prompt.schema.json")
        meta = {"id": "demo", "title": "Demo", "category": "nonsense",
                "version": "1.0", "status": "draft", "license": "MIT"}
        errors = yolo.validate_schema(meta, schema)
        joined = " | ".join(errors)
        self.assertIn("category", joined)          # bad enum
        self.assertIn("version", joined)           # bad semver pattern
        self.assertIn("missing required field 'tags'", joined)

    def test_additional_properties_rejected(self):
        schema = yolo.load_schema("workflow.schema.json")
        meta = {"id": "w", "title": "W..", "version": "0.1.0", "status": "draft",
                "maturity": "foundation", "license": "MIT", "tags": ["x"],
                "surprise": True}
        errors = yolo.validate_schema(meta, schema)
        self.assertTrue(any("unexpected field 'surprise'" in e for e in errors))


class TestRepositoryArtifacts(unittest.TestCase):
    """The repository's own artifacts must be healthy."""

    def test_prompts_load_clean(self):
        prompts, problems = yolo.load_prompts()
        self.assertEqual(problems, [])
        self.assertGreaterEqual(len(prompts), 8)

    def test_workflows_load_clean(self):
        workflows, problems = yolo.load_workflows()
        self.assertEqual(problems, [])
        self.assertGreaterEqual(len(workflows), 5)

    def test_software_loads_clean(self):
        entries, problems = yolo.load_software()
        self.assertEqual(problems, [])
        self.assertGreater(len(entries), 0)

    def test_cookbooks_load_clean(self):
        entries, problems = yolo.load_cookbooks()
        self.assertEqual(problems, [])
        self.assertEqual(len(entries), 4)
        self.assertEqual(
            set(entries[0]["strong_fit"]) | set(entries[0]["partial_fit"]),
            yolo.COOKBOOK_STACKS,
        )

    def test_taxonomy_clean(self):
        self.assertEqual(yolo.check_taxonomy(), [])

    def test_catalog_is_current(self):
        catalog_path = yolo.REPO_ROOT / "catalog.json"
        self.assertTrue(catalog_path.exists(), "catalog.json missing")
        self.assertEqual(catalog_path.read_text(encoding="utf-8"),
                         yolo.catalog_text(), "catalog.json is stale")

    def test_doctor_passes(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            code = yolo.cmd_doctor()
        self.assertEqual(code, 0, buf.getvalue())


class TestCommands(unittest.TestCase):
    def _run(self, *argv):
        buf = io.StringIO()
        with redirect_stdout(buf):
            code = yolo.main(list(argv))
        return code, buf.getvalue()

    def test_list_prompts(self):
        code, out = self._run("list", "prompts")
        self.assertEqual(code, 0)
        self.assertIn("rubber-duck-debugging", out)

    def test_list_cookbooks(self):
        code, out = self._run("list", "cookbooks")
        self.assertEqual(code, 0)
        self.assertIn("rubber-duck", out)

    def test_list_unknown_target(self):
        code, _ = self._run("list", "unicorns")
        self.assertEqual(code, 2)

    def test_search_hits(self):
        code, out = self._run("search", "research")
        self.assertEqual(code, 0)
        self.assertIn("source-synthesis", out)

    def test_search_miss(self):
        code, _ = self._run("search", "zzz-no-such-term-zzz")
        self.assertEqual(code, 1)

    def test_show_prompt_cookbook_and_software(self):
        code, out = self._run("show", "rubber-duck-debugging")
        self.assertEqual(code, 0)
        self.assertIn("Prompt text", out)
        code, out = self._run("show", "rubber-duck")
        self.assertEqual(code, 0)
        self.assertIn("source_prompt", out)
        code, out = self._run("show", "git")
        self.assertEqual(code, 0)
        self.assertIn("git-scm.com", out)

    def test_show_missing(self):
        code, _ = self._run("show", "nope-not-here")
        self.assertEqual(code, 1)

    def test_help(self):
        code, out = self._run("--help")
        self.assertEqual(code, 0)
        self.assertIn("doctor", out)


if __name__ == "__main__":
    unittest.main()
