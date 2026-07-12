#!/usr/bin/env python3
"""foundry_client — offline simulator shim for Azure AI Foundry.

Standard-library-only. No network calls. No cost in sim mode.

Modes (set via FOUNDRY_MODE env var, default: sim):
  sim   — returns deterministic fixture responses; no network, no billing.
  azure — raises NotImplementedError directing you to the PRD. Not enabled.

Auto profile (set via SIM_PROFILE env var, default: auto):
  auto  — does not pin a specific model; emulates blended routing behavior
          so personas/workflows can be layered on top of Copilot auto engines.

Interface mirrors the Azure OpenAI chat completion shape so switching to the
real client later is a config change, not a rewrite. See PRD-azure-foundry-integration.md.

Usage:
    from foundry_client import FoundryClient
    client = FoundryClient()
    response = client.chat([{"role": "user", "content": "Hello"}])
    print(response["choices"][0]["message"]["content"])
"""

from __future__ import annotations

import json
import os
import random
import time
from pathlib import Path
from typing import Any

_HERE = Path(__file__).resolve().parent
_FIXTURES_DIR = _HERE / "fixtures"
_LEDGER_PATH = _HERE / "ledger.json"
_RATES_PATH = _HERE / "rates.json"
_COST_PRECISION = 8  # decimal places for estimated USD cost in ledger


class FoundryClient:
    """Client shim whose interface mirrors Azure OpenAI chat completions.

    In sim mode: returns deterministic canned fixture responses.
    In azure mode: raises NotImplementedError — see PRD.

    Attributes:
        mode: 'sim' or 'azure' (from FOUNDRY_MODE env var).
        profile: SIM_PROFILE value (default 'auto').
    """

    def __init__(self) -> None:
        self.mode = os.environ.get("FOUNDRY_MODE", "sim").lower().strip()
        self.profile = os.environ.get("SIM_PROFILE", "auto").lower().strip()
        self._fixtures: list[dict[str, Any]] = []
        self._rates: dict[str, Any] = {}

        if self.mode == "azure":
            raise NotImplementedError(
                "FOUNDRY_MODE=azure is not enabled in this build.\n"
                "This repository ships only the local offline simulator.\n"
                "See docs/PRD-azure-foundry-integration.md for the full design,\n"
                "auth setup (DefaultAzureCredential), and the first-party-only\n"
                "model allowlist required to stay within Startup Credits terms."
            )
        if self.mode != "sim":
            raise ValueError(
                f"Unknown FOUNDRY_MODE={self.mode!r}. Valid values: 'sim' (default) or 'azure'."
            )

        self._load_fixtures()
        self._load_rates()

    # ------------------------------------------------------------------ public

    def chat(
        self,
        messages: list[dict[str, str]],
        *,
        fixture_id: str | None = None,
        record_to_ledger: bool = True,
    ) -> dict[str, Any]:
        """Send a chat completion request (sim: returns a fixture response).

        Args:
            messages: List of {"role": ..., "content": ...} dicts, same shape
                      as Azure OpenAI chat.completions.create(messages=...).
            fixture_id: Pin a specific fixture by its 'id' field. If None,
                        a fixture is selected by keyword matching or randomly.
            record_to_ledger: Whether to append this run to ledger.json.

        Returns:
            A dict matching the Azure OpenAI ChatCompletion response shape.
            Always includes a 'sim_note' field to distinguish it from a real response.
        """
        fixture = self._select_fixture(messages, fixture_id)
        response = dict(fixture["response"])
        response["sim_note"] = "SIMULATED — no network call, no cost"
        response["profile"] = self.profile

        if record_to_ledger:
            self._record_ledger(response)

        return response

    def complete(
        self,
        prompt: str,
        *,
        fixture_id: str | None = None,
        record_to_ledger: bool = True,
    ) -> dict[str, Any]:
        """Text completion convenience wrapper (delegates to chat)."""
        return self.chat(
            [{"role": "user", "content": prompt}],
            fixture_id=fixture_id,
            record_to_ledger=record_to_ledger,
        )

    def list_fixtures(self) -> list[dict[str, str]]:
        """Return a summary list of available fixtures (id, label, description)."""
        return [
            {
                "id": f["id"],
                "label": f.get("label", ""),
                "description": f.get("description", ""),
            }
            for f in self._fixtures
        ]

    def get_ledger(self) -> dict[str, Any]:
        """Return the current ledger contents."""
        if _LEDGER_PATH.exists():
            return json.loads(_LEDGER_PATH.read_text(encoding="utf-8"))
        return {"runs": []}

    # ----------------------------------------------------------------- private

    def _load_fixtures(self) -> None:
        if not _FIXTURES_DIR.exists():
            return
        for path in sorted(_FIXTURES_DIR.glob("*.json")):
            try:
                self._fixtures.append(json.loads(path.read_text(encoding="utf-8")))
            except (json.JSONDecodeError, KeyError):
                pass  # skip malformed fixtures

    def _load_rates(self) -> None:
        if _RATES_PATH.exists():
            self._rates = json.loads(_RATES_PATH.read_text(encoding="utf-8"))

    def _select_fixture(
        self, messages: list[dict[str, str]], fixture_id: str | None
    ) -> dict[str, Any]:
        if not self._fixtures:
            return self._fallback_fixture(messages)

        if fixture_id:
            for f in self._fixtures:
                if f.get("id") == fixture_id:
                    return f
            raise KeyError(f"Fixture id {fixture_id!r} not found.")

        # Keyword match on last user message
        last_user = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"),
            "",
        ).lower()
        keywords = {
            "debug": "fixture-aot-rubber-duck",
            "bug": "fixture-aot-rubber-duck",
            "pagination": "fixture-aot-rubber-duck",
            "workflow": "fixture-aot-workflow-review",
            "clinic": "fixture-aot-workflow-review",
            "review": "fixture-aot-workflow-review",
            "brief": "fixture-aot-strategy-brief",
            "strategy": "fixture-aot-strategy-brief",
            "discovery": "fixture-aot-strategy-brief",
        }
        for kw, fid in keywords.items():
            if kw in last_user:
                for f in self._fixtures:
                    if f.get("id") == fid:
                        return f

        # Fall back to random fixture
        return random.choice(self._fixtures)

    def _fallback_fixture(self, messages: list[dict[str, str]]) -> dict[str, Any]:
        """Return a minimal synthetic fixture when no fixture files are loaded."""
        last_user = next(
            (m["content"] for m in reversed(messages) if m.get("role") == "user"),
            "(no user message)",
        )
        prompt_tokens = len(last_user.split())
        completion_tokens = 12
        return {
            "id": "sim-fallback",
            "response": {
                "id": "sim-chatcmpl-fallback",
                "object": "chat.completion",
                "model": "auto",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": (
                                f"[SIM] No fixtures loaded. Echoing your prompt: {last_user!r}"
                            ),
                        },
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": prompt_tokens + completion_tokens,
                },
            },
        }

    def _record_ledger(self, response: dict[str, Any]) -> None:
        """Append a run record to ledger.json with ESTIMATE cost."""
        ledger = self.get_ledger()
        usage = response.get("usage", {})
        model_key = response.get("model", "auto")
        models = self._rates.get("models", {})
        rate = models.get(model_key, models.get("auto", {}))
        input_rate = rate.get("input", 0.001)
        output_rate = rate.get("output", 0.003)
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        estimated_cost = (
            prompt_tokens / 1000 * input_rate
            + completion_tokens / 1000 * output_rate
        )

        run = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "response_id": response.get("id", ""),
            "model": model_key,
            "profile": self.profile,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": usage.get("total_tokens", 0),
            "estimated_cost_usd": round(estimated_cost, _COST_PRECISION),
            "note": "ESTIMATE — sim mode only, no billing",
        }
        ledger.setdefault("runs", []).append(run)
        _LEDGER_PATH.write_text(json.dumps(ledger, indent=2) + "\n", encoding="utf-8")
