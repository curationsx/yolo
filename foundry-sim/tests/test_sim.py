#!/usr/bin/env python3
"""Tests for the foundry-sim offline simulator.

Standard-library unittest — no pytest or other dependencies required.
All tests run fully offline with no network calls.

Run:
    python -m unittest foundry-sim/tests/test_sim.py -v
  or:
    python foundry-sim/tests/test_sim.py
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

# Load foundry_client from sibling directory without installing a package
_SIM_DIR = Path(__file__).resolve().parent.parent
_CLIENT_PATH = _SIM_DIR / "foundry_client.py"

spec = importlib.util.spec_from_file_location("foundry_client", _CLIENT_PATH)
_fc_mod = importlib.util.module_from_spec(spec)  # type: ignore[arg-type]
spec.loader.exec_module(_fc_mod)  # type: ignore[union-attr]

FoundryClient = _fc_mod.FoundryClient


class TestSimModeDefault(unittest.TestCase):
    """FoundryClient in default sim mode (FOUNDRY_MODE unset or 'sim')."""

    def setUp(self) -> None:
        os.environ.pop("FOUNDRY_MODE", None)
        os.environ.pop("SIM_PROFILE", None)

    def test_default_mode_is_sim(self) -> None:
        client = FoundryClient()
        self.assertEqual(client.mode, "sim")

    def test_default_profile_is_auto(self) -> None:
        client = FoundryClient()
        self.assertEqual(client.profile, "auto")

    def test_chat_returns_response_dict(self) -> None:
        client = FoundryClient()
        resp = client.chat(
            [{"role": "user", "content": "Help me frame a strategy."}],
            record_to_ledger=False,
        )
        self.assertIn("choices", resp)
        self.assertIsInstance(resp["choices"], list)
        self.assertGreater(len(resp["choices"]), 0)

    def test_chat_response_has_sim_note(self) -> None:
        client = FoundryClient()
        resp = client.chat(
            [{"role": "user", "content": "Hello"}],
            record_to_ledger=False,
        )
        self.assertIn("sim_note", resp)
        self.assertIn("SIMULATED", resp["sim_note"])

    def test_chat_choice_has_message_content(self) -> None:
        client = FoundryClient()
        resp = client.chat(
            [{"role": "user", "content": "Review this workflow"}],
            record_to_ledger=False,
        )
        content = resp["choices"][0]["message"]["content"]
        self.assertIsInstance(content, str)
        self.assertGreater(len(content), 0)

    def test_complete_delegates_to_chat(self) -> None:
        client = FoundryClient()
        resp = client.complete("Debug my pagination bug", record_to_ledger=False)
        self.assertIn("choices", resp)

    def test_list_fixtures_returns_list(self) -> None:
        client = FoundryClient()
        fixtures = client.list_fixtures()
        self.assertIsInstance(fixtures, list)
        # Each item has id and label
        for f in fixtures:
            self.assertIn("id", f)

    def test_fixture_pin_by_id(self) -> None:
        client = FoundryClient()
        if not client.list_fixtures():
            self.skipTest("No fixtures loaded")
        fid = client.list_fixtures()[0]["id"]
        resp = client.chat(
            [{"role": "user", "content": "anything"}],
            fixture_id=fid,
            record_to_ledger=False,
        )
        self.assertIn("choices", resp)

    def test_fixture_pin_unknown_id_raises(self) -> None:
        client = FoundryClient()
        with self.assertRaises(KeyError):
            client.chat(
                [{"role": "user", "content": "test"}],
                fixture_id="nonexistent-id-xyz",
                record_to_ledger=False,
            )

    def test_keyword_routing_workflow(self) -> None:
        """Keyword 'workflow' should select the workflow-review fixture."""
        client = FoundryClient()
        resp = client.chat(
            [{"role": "user", "content": "Review this workflow for checkpoints"}],
            record_to_ledger=False,
        )
        self.assertIn("choices", resp)
        # The workflow fixture content should mention workflow-related content
        content = resp["choices"][0]["message"]["content"]
        self.assertIsInstance(content, str)

    def test_usage_field_present(self) -> None:
        client = FoundryClient()
        resp = client.chat(
            [{"role": "user", "content": "test"}],
            record_to_ledger=False,
        )
        self.assertIn("usage", resp)
        usage = resp["usage"]
        self.assertIn("total_tokens", usage)


class TestAzureModeGuards(unittest.TestCase):
    """FOUNDRY_MODE=azure enforces config + allowlist guards at construction.

    No network calls happen in __init__, so these tests remain fully offline.
    """

    def setUp(self) -> None:
        os.environ["FOUNDRY_MODE"] = "azure"
        for var in ("AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_DEPLOYMENT", "AZURE_OPENAI_API_KEY"):
            os.environ.pop(var, None)

    def tearDown(self) -> None:
        for var in (
            "FOUNDRY_MODE",
            "AZURE_OPENAI_ENDPOINT",
            "AZURE_OPENAI_DEPLOYMENT",
            "AZURE_OPENAI_API_KEY",
        ):
            os.environ.pop(var, None)

    def test_azure_mode_requires_config(self) -> None:
        with self.assertRaises(ValueError) as ctx:
            FoundryClient()
        msg = str(ctx.exception)
        self.assertIn("AZURE_OPENAI_ENDPOINT", msg)
        self.assertIn("PRD-azure-foundry-integration.md", msg)

    def test_azure_mode_blocks_third_party_models(self) -> None:
        os.environ["AZURE_OPENAI_ENDPOINT"] = "https://example.cognitiveservices.azure.com/"
        os.environ["AZURE_OPENAI_DEPLOYMENT"] = "claude-3-opus"
        with self.assertRaises(ValueError) as ctx:
            FoundryClient()
        self.assertIn("allowlist", str(ctx.exception))

    def test_azure_mode_tier2_requires_approval(self) -> None:
        os.environ["AZURE_OPENAI_ENDPOINT"] = "https://example.cognitiveservices.azure.com/"
        os.environ["AZURE_OPENAI_DEPLOYMENT"] = "gpt-4o"
        with self.assertRaises(ValueError) as ctx:
            FoundryClient()
        self.assertIn("maintainer approval", str(ctx.exception))

    def test_azure_mode_constructs_offline_with_allowed_deployment(self) -> None:
        os.environ["AZURE_OPENAI_ENDPOINT"] = "https://example.cognitiveservices.azure.com/"
        os.environ["AZURE_OPENAI_DEPLOYMENT"] = "gpt-5.4-mini"
        client = FoundryClient()
        self.assertEqual(client.mode, "azure")
        self.assertEqual(client.list_fixtures(), [])


class TestAgentProtocol(unittest.TestCase):
    """AoT agent protocol runner (agent.py) — offline, sim mode only.

    Covers PRD-aot-agent-protocol.md §6.1 (depth tiers), §6.3 (hard limits),
    and §6.5 (response contract) without any network call.
    """

    @classmethod
    def setUpClass(cls) -> None:
        # Ensure agent.py binds to the SAME foundry_client module instance the
        # tests monkey-patch, so ledger redirection works.
        sys.modules["foundry_client"] = _fc_mod
        agent_path = _SIM_DIR / "agent.py"
        agent_spec = importlib.util.spec_from_file_location("agent", agent_path)
        cls.agent_mod = importlib.util.module_from_spec(agent_spec)  # type: ignore[arg-type]
        agent_spec.loader.exec_module(cls.agent_mod)  # type: ignore[union-attr]

    def setUp(self) -> None:
        os.environ.pop("FOUNDRY_MODE", None)
        self._tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
        self._tmp.write(b'{"runs": []}')
        self._tmp.close()
        self._orig_ledger = _fc_mod._LEDGER_PATH
        _fc_mod._LEDGER_PATH = Path(self._tmp.name)

    def tearDown(self) -> None:
        _fc_mod._LEDGER_PATH = self._orig_ledger
        Path(self._tmp.name).unlink(missing_ok=True)
        os.environ.pop("FOUNDRY_MODE", None)

    def _run(self, **kwargs):
        defaults = {"persona_id": "steward", "depth": "focused",
                    "decision_owner": "Test Owner"}
        defaults.update(kwargs)
        return self.agent_mod.AgentRun(**defaults)

    def test_response_contract_header_and_footer(self) -> None:
        """§6.5: disclosure header, human-decision footer, named owner."""
        out = self._run().ask("Frame a discovery brief for a new workflow.")
        first_line = out.splitlines()[0]
        self.assertTrue(first_line.startswith("🤖 "))
        self.assertIn("Depth: Focused", first_line)
        self.assertIn("Simulated", first_line)
        self.assertIn("Human decision required", out)
        self.assertIn("Decision owner: Test Owner", out)

    def test_unknown_depth_rejected(self) -> None:
        """§6.1: depth must be a known tier."""
        with self.assertRaises(ValueError) as ctx:
            self._run(depth="ultra")
        self.assertIn("depth", str(ctx.exception).lower())

    def test_unknown_persona_rejected(self) -> None:
        with self.assertRaises(FileNotFoundError):
            self._run(persona_id="does-not-exist")

    def test_depth_tiers_within_protocol_ceiling(self) -> None:
        """§6.3: no tier may exceed the 2,048-token protocol ceiling."""
        tiers = self.agent_mod.DEPTH_TIERS
        self.assertEqual(set(tiers), {"focused", "standard", "deep"})
        for tier, budget in tiers.items():
            with self.subTest(tier=tier):
                self.assertLessEqual(
                    budget, self.agent_mod.PROTOCOL_MAX_OUTPUT_TOKENS
                )

    def test_request_cap_aborts_run(self) -> None:
        """§6.3: request 11 must raise ProtocolLimitError before sending."""
        run = self._run()
        run._requests_made = self.agent_mod.PROTOCOL_MAX_REQUESTS_PER_RUN
        with self.assertRaises(self.agent_mod.ProtocolLimitError):
            run.ask("one more?")

    def test_cost_cap_aborts_run(self) -> None:
        """§6.3: estimated cost at/over USD 0.10 aborts before sending."""
        run = self._run()
        run._estimated_cost_usd = self.agent_mod.PROTOCOL_MAX_COST_PER_RUN_USD
        with self.assertRaises(self.agent_mod.ProtocolLimitError):
            run.ask("one more?")

    def test_persona_system_prompt_reaches_messages(self) -> None:
        """The steward persona must include read-only, decision-deferring language."""
        persona = self.agent_mod.load_persona("steward")
        self.assertIn("never make final decisions", persona["system_prompt"])


class TestUnknownModeRaises(unittest.TestCase):
    def setUp(self) -> None:
        os.environ["FOUNDRY_MODE"] = "bogus"

    def tearDown(self) -> None:
        os.environ.pop("FOUNDRY_MODE", None)

    def test_unknown_mode_raises_value_error(self) -> None:
        with self.assertRaises(ValueError) as ctx:
            FoundryClient()
        msg = str(ctx.exception)
        self.assertIn("sim", msg)
        self.assertIn("azure", msg)


class TestLedger(unittest.TestCase):
    """Ledger recording writes local JSON; no network."""

    def setUp(self) -> None:
        os.environ.pop("FOUNDRY_MODE", None)
        # Redirect ledger to a temp file so tests don't pollute real ledger
        self._tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
        self._tmp.write(b'{"runs": []}')
        self._tmp.close()
        # Monkey-patch the module-level path
        self._orig_ledger = _fc_mod._LEDGER_PATH
        _fc_mod._LEDGER_PATH = Path(self._tmp.name)

    def tearDown(self) -> None:
        _fc_mod._LEDGER_PATH = self._orig_ledger
        Path(self._tmp.name).unlink(missing_ok=True)
        os.environ.pop("FOUNDRY_MODE", None)

    def test_ledger_records_run(self) -> None:
        client = FoundryClient()
        client.chat([{"role": "user", "content": "test ledger"}], record_to_ledger=True)
        ledger = client.get_ledger()
        self.assertGreater(len(ledger.get("runs", [])), 0)

    def test_ledger_run_has_estimate_note(self) -> None:
        client = FoundryClient()
        client.chat([{"role": "user", "content": "test"}], record_to_ledger=True)
        runs = client.get_ledger().get("runs", [])
        self.assertTrue(any("ESTIMATE" in r.get("note", "") for r in runs))

    def test_no_ledger_record_when_disabled(self) -> None:
        client = FoundryClient()
        before = len(client.get_ledger().get("runs", []))
        client.chat([{"role": "user", "content": "test"}], record_to_ledger=False)
        after = len(client.get_ledger().get("runs", []))
        self.assertEqual(before, after)

    def test_estimated_cost_is_float(self) -> None:
        client = FoundryClient()
        client.chat([{"role": "user", "content": "test"}], record_to_ledger=True)
        runs = client.get_ledger().get("runs", [])
        for run in runs:
            self.assertIsInstance(run.get("estimated_cost_usd"), float)


class TestFixtureFiles(unittest.TestCase):
    """Fixture JSON files are valid and contain required fields."""

    def setUp(self) -> None:
        os.environ.pop("FOUNDRY_MODE", None)
        self._fixtures_dir = _SIM_DIR / "fixtures"

    def test_fixture_files_exist(self) -> None:
        self.assertTrue(self._fixtures_dir.exists(), "fixtures/ directory should exist")
        files = list(self._fixtures_dir.glob("*.json"))
        self.assertGreater(len(files), 0, "At least one fixture file should exist")

    def test_fixture_files_are_valid_json(self) -> None:
        for path in self._fixtures_dir.glob("*.json"):
            with self.subTest(file=path.name):
                data = json.loads(path.read_text(encoding="utf-8"))
                self.assertIsInstance(data, dict)

    def test_fixture_files_have_required_fields(self) -> None:
        for path in self._fixtures_dir.glob("*.json"):
            with self.subTest(file=path.name):
                data = json.loads(path.read_text(encoding="utf-8"))
                self.assertIn("id", data)
                self.assertIn("response", data)
                resp = data["response"]
                self.assertIn("choices", resp)
                self.assertIn("usage", resp)

    def test_fixture_responses_have_no_network_markers(self) -> None:
        """Fixture responses must not contain real API URLs or tokens."""
        for path in self._fixtures_dir.glob("*.json"):
            with self.subTest(file=path.name):
                text = path.read_text(encoding="utf-8")
                # Ensure no real Azure endpoint patterns
                self.assertNotIn("openai.azure.com", text)
                self.assertNotIn("api-key:", text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
