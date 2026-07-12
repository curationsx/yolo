#!/usr/bin/env python3
"""foundry_client — Azure AI Foundry client with offline simulator mode.

Standard-library-only. No network calls and no cost in sim mode.

Modes (set via FOUNDRY_MODE env var, default: sim):
  sim   — returns deterministic fixture responses; no network, no billing.
  azure — real Azure OpenAI chat completions against a first-party deployment.
          Guarded by the PRD §5.1 two-tier allowlist and §5.2 per-run caps.
          Requires AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT.

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
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

_HERE = Path(__file__).resolve().parent
_FIXTURES_DIR = _HERE / "fixtures"
_LEDGER_PATH = _HERE / "ledger.json"
_AZURE_LEDGER_PATH = _HERE / "ledger.azure.json"  # git-ignored; real-mode runs only
_RATES_PATH = _HERE / "rates.json"
_COST_PRECISION = 8  # decimal places for estimated USD cost in ledger

# ── PRD §5.1 — two-tier first-party allowlist ────────────────────────────────
# Tier 1: approved for this integration (mini/small tiers, Standard PAYG only).
FIRST_PARTY_ALLOWED_PREFIXES = [
    "gpt-5.4-mini",
    "gpt-5-mini",
    "gpt-4.1-mini",
    "gpt-4o-mini",
    "text-embedding-3-small",
]
# Tier 2: first-party but requires explicit maintainer sign-off (full-size models).
FIRST_PARTY_APPROVAL_REQUIRED_PREFIXES = [
    "gpt-5",
    "gpt-4o",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-35-turbo",
    "text-embedding-3-large",
    "text-embedding-ada",
    "dall-e",
    "whisper",
    "tts",
]

# ── PRD §5.2 — per-run caps ──────────────────────────────────────────────────
MAX_OUTPUT_TOKENS_PER_REQUEST = 4096
MAX_REQUESTS_PER_RUN = 50
MAX_ESTIMATED_COST_PER_RUN_USD = 1.00
REQUEST_TIMEOUT_SECONDS = 30


def _check_allowlist(deployment: str) -> None:
    """Enforce the PRD §5.1 two-tier first-party allowlist."""
    name = deployment.lower()
    if any(name.startswith(p) for p in FIRST_PARTY_ALLOWED_PREFIXES):
        return
    if any(name.startswith(p) for p in FIRST_PARTY_APPROVAL_REQUIRED_PREFIXES):
        raise ValueError(
            f"Deployment {deployment!r} is first-party but requires explicit "
            "maintainer approval (Tier 2 — full-size/specialty model). "
            "See docs/PRD-azure-foundry-integration.md §5.1."
        )
    raise ValueError(
        f"Deployment {deployment!r} is not on the first-party allowlist. "
        "Third-party / Marketplace models are blocked to stay within "
        "Microsoft for Startups credit terms. "
        "See docs/PRD-azure-foundry-integration.md §5.1."
    )


class FoundryClient:
    """Client whose interface mirrors Azure OpenAI chat completions.

    In sim mode: returns deterministic canned fixture responses.
    In azure mode: calls the real first-party deployment with allowlist + caps.

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
            self._init_azure()
            self._load_rates()
            return
        if self.mode != "sim":
            raise ValueError(
                f"Unknown FOUNDRY_MODE={self.mode!r}. Valid values: 'sim' (default) or 'azure'."
            )

        self._ledger_path = _LEDGER_PATH
        self._load_fixtures()
        self._load_rates()

    def _init_azure(self) -> None:
        """Validate azure-mode configuration. Offline — no network calls here."""
        endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "").strip()
        deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "").strip()
        if not endpoint or not deployment:
            raise ValueError(
                "FOUNDRY_MODE=azure requires AZURE_OPENAI_ENDPOINT and "
                "AZURE_OPENAI_DEPLOYMENT environment variables. "
                "See docs/PRD-azure-foundry-integration.md §6.2 and .env.example."
            )
        _check_allowlist(deployment)
        self._endpoint = endpoint.rstrip("/")
        self._deployment = deployment
        self._api_key = os.environ.get("AZURE_OPENAI_API_KEY", "").strip() or None
        self._requests_made = 0
        self._run_cost_usd = 0.0
        self._ledger_path = Path(
            os.environ.get("FOUNDRY_LEDGER_PATH", "").strip() or _AZURE_LEDGER_PATH
        )

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
            Sim responses include a 'sim_note' field; azure responses are real.
        """
        if self.mode == "azure":
            return self._azure_chat(messages, record_to_ledger=record_to_ledger)
        fixture = self._select_fixture(messages, fixture_id)
        response = dict(fixture["response"])
        response["sim_note"] = "SIMULATED — no network call, no cost"
        response["profile"] = self.profile

        if record_to_ledger:
            self._record_ledger(response)

        return response

    def _azure_chat(
        self,
        messages: list[dict[str, str]],
        *,
        record_to_ledger: bool = True,
    ) -> dict[str, Any]:
        """Real Azure OpenAI chat completion via the v1 REST API (stdlib urllib).

        Enforces PRD §5.2 per-run caps before any network call. Records real
        token counts to the git-ignored azure ledger (PRD §6.5).
        """
        if self._requests_made >= MAX_REQUESTS_PER_RUN:
            raise RuntimeError(
                f"Per-run request cap reached ({MAX_REQUESTS_PER_RUN}). "
                "See docs/PRD-azure-foundry-integration.md §5.2."
            )
        if self._run_cost_usd >= MAX_ESTIMATED_COST_PER_RUN_USD:
            raise RuntimeError(
                f"Per-run estimated cost cap reached "
                f"(USD {MAX_ESTIMATED_COST_PER_RUN_USD:.2f}). "
                "See docs/PRD-azure-foundry-integration.md §5.2."
            )

        url = f"{self._endpoint}/openai/v1/chat/completions"
        body = {
            "model": self._deployment,
            "messages": messages,
            "max_completion_tokens": MAX_OUTPUT_TOKENS_PER_REQUEST,
        }
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["api-key"] = self._api_key
        else:
            headers["Authorization"] = f"Bearer {self._azure_bearer_token()}"

        req = urllib.request.Request(
            url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
                response: dict[str, Any] = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")[:500]
            raise RuntimeError(
                f"Azure OpenAI request failed ({e.code}): {detail}"
            ) from e

        self._requests_made += 1
        response["profile"] = self.profile
        self._run_cost_usd += self._estimate_cost(response)
        if record_to_ledger:
            self._record_ledger(response)
        return response

    def _azure_bearer_token(self) -> str:
        """Fetch an Entra ID bearer token via the Azure CLI (stdlib-only path).

        The PRD prefers DefaultAzureCredential; until the optional azure
        dependency set is installed, the Azure CLI's cached login provides the
        same Entra-backed, no-secret-in-code behavior for local development.
        """
        cached = getattr(self, "_bearer_cache", None)
        if cached and cached[1] - time.time() > 120:
            return cached[0]
        import subprocess

        result = subprocess.run(
            [
                "az", "account", "get-access-token",
                "--resource", "https://cognitiveservices.azure.com",
                "--query", "accessToken", "-o", "tsv",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0 or not result.stdout.strip():
            raise RuntimeError(
                "No AZURE_OPENAI_API_KEY set and no Azure CLI login available "
                "for Entra ID auth. Run 'az login' or set the key for local dev. "
                "See docs/PRD-azure-foundry-integration.md §6.1."
            )
        token = result.stdout.strip()
        self._bearer_cache = (token, time.time() + 3000)
        return token

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
        path = getattr(self, "_ledger_path", _LEDGER_PATH)
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
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

    def _estimate_cost(self, response: dict[str, Any]) -> float:
        """ESTIMATE the USD cost of a response from rates.json (not billing truth)."""
        usage = response.get("usage", {})
        model_key = response.get("model", "auto")
        models = self._rates.get("models", {})
        rate = models.get(model_key, models.get("auto", {}))
        input_rate = rate.get("input", 0.001)
        output_rate = rate.get("output", 0.003)
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        return (
            prompt_tokens / 1000 * input_rate
            + completion_tokens / 1000 * output_rate
        )

    def _record_ledger(self, response: dict[str, Any]) -> None:
        """Append a run record to the mode-appropriate ledger with ESTIMATE cost.

        Sim mode → tracked ledger.json. Azure mode → git-ignored
        ledger.azure.json with real token counts (PRD §6.5).
        """
        ledger = self.get_ledger()
        usage = response.get("usage", {})
        estimated_cost = self._estimate_cost(response)

        run = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "response_id": response.get("id", ""),
            "model": response.get("model", "auto"),
            "profile": self.profile,
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
            "total_tokens": usage.get("total_tokens", 0),
            "estimated_cost_usd": round(estimated_cost, _COST_PRECISION),
            "note": (
                "ESTIMATE cost — real Azure run; token counts are actual"
                if self.mode == "azure"
                else "ESTIMATE — sim mode only, no billing"
            ),
        }
        ledger.setdefault("runs", []).append(run)
        path = getattr(self, "_ledger_path", _LEDGER_PATH)
        path.write_text(json.dumps(ledger, indent=2) + "\n", encoding="utf-8")
