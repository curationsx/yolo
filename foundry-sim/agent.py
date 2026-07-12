#!/usr/bin/env python3
"""AoT agent protocol runner — docs/PRD-aot-agent-protocol.md.

Wraps FoundryClient with the community agent protocol:

- Explicit invocation only (this CLI *is* the explicit invocation).
- Persona system prompts loaded from foundry-sim/personas/*.json.
- Depth tiers (Focused / Standard / Deep) mapped to output-token budgets.
- Protocol hard limits (PRD §6.3) — tighter than the client's own caps:
    max output tokens/request  2,048
    max requests/run           10
    max estimated cost/run     USD 0.10
- §6.5 response contract: disclosure header, labeling instructions in the
  system prompt, and the human-decision footer on every response.

Works identically in sim mode (default; zero cost) and azure mode (real).

Usage:
    python foundry-sim/agent.py --persona steward --depth focused \
        --owner "Named Human" "Your request text here"

Read-only by design: this runner never posts to discussions, never writes
to the repository, and never closes anything. A human copies the output.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))

from foundry_client import FoundryClient  # noqa: E402

PERSONAS_DIR = _HERE / "personas"

# ── PRD §6.3 protocol hard limits (tighter than client PRD §5.2 caps) ────────
PROTOCOL_MAX_OUTPUT_TOKENS = 2048
PROTOCOL_MAX_REQUESTS_PER_RUN = 10
PROTOCOL_MAX_COST_PER_RUN_USD = 0.10

# ── PRD §6.1 depth tiers → output-token budgets (resolves PRD §9 question) ──
DEPTH_TIERS: dict[str, int] = {
    "focused": 512,
    "standard": 1024,
    "deep": PROTOCOL_MAX_OUTPUT_TOKENS,
}

# §6.5: every response must label its elements. Enforced via system prompt.
LABELING_INSTRUCTIONS = (
    "Label every element of your answer as one of: **fact**, **assumption**, "
    "**suggestion**, or **open question**. Do not state pricing, model "
    "capabilities, or external-system claims without a cited source. "
    "Be concise; you are operating under a hard output-token budget."
)

HUMAN_DECISION_FOOTER = (
    "Human decision required — the named owner accepts, rejects, "
    "or adapts this response."
)


class ProtocolLimitError(RuntimeError):
    """Raised when a request would exceed a PRD §6.3 protocol hard limit."""


def load_persona(persona_id: str) -> dict[str, Any]:
    """Load a persona JSON by id from foundry-sim/personas/."""
    path = PERSONAS_DIR / f"{persona_id}.json"
    if not path.is_file():
        available = sorted(p.stem for p in PERSONAS_DIR.glob("*.json"))
        raise FileNotFoundError(
            f"Persona {persona_id!r} not found in {PERSONAS_DIR}. "
            f"Available: {', '.join(available) or '(none)'}"
        )
    persona: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    if "system_prompt" not in persona:
        raise ValueError(f"Persona {persona_id!r} is missing 'system_prompt'.")
    return persona


class AgentRun:
    """One agent run = one discussion-thread response (PRD §6.3).

    Enforces the protocol request and cost caps across all requests made
    within the run, on top of the FoundryClient's own per-run caps.
    """

    def __init__(
        self,
        persona_id: str = "steward",
        depth: str = "focused",
        decision_owner: str = "unnamed",
    ) -> None:
        depth = depth.lower().strip()
        if depth not in DEPTH_TIERS:
            raise ValueError(
                f"Unknown depth {depth!r}. Valid tiers: {', '.join(DEPTH_TIERS)}."
            )
        self.persona = load_persona(persona_id)
        self.depth = depth
        self.decision_owner = decision_owner
        self.client = FoundryClient()
        self._requests_made = 0
        self._estimated_cost_usd = 0.0

    # ------------------------------------------------------------- disclosure
    def disclosure_header(self, model_id: str) -> str:
        """PRD §6.5 disclosure line, prepended to every response."""
        label = self.persona.get("label", self.persona.get("id", "Agent"))
        live = "Live" if self.client.mode == "azure" else "Simulated"
        return (
            f"🤖 {label} · {model_id} · Depth: {self.depth.capitalize()} · {live}"
        )

    # ------------------------------------------------------------------- ask
    def ask(self, request_text: str) -> str:
        """Send one protocol-wrapped request; return the formatted response."""
        if self._requests_made >= PROTOCOL_MAX_REQUESTS_PER_RUN:
            raise ProtocolLimitError(
                f"Protocol request cap reached ({PROTOCOL_MAX_REQUESTS_PER_RUN}"
                "/run). See docs/PRD-aot-agent-protocol.md §6.3."
            )
        if self._estimated_cost_usd >= PROTOCOL_MAX_COST_PER_RUN_USD:
            raise ProtocolLimitError(
                f"Protocol cost cap reached (USD "
                f"{PROTOCOL_MAX_COST_PER_RUN_USD:.2f}/run). Run aborted "
                "before sending. See docs/PRD-aot-agent-protocol.md §6.3."
            )

        messages = [
            {
                "role": "system",
                "content": f"{self.persona['system_prompt']}\n\n"
                f"{LABELING_INSTRUCTIONS}",
            },
            {"role": "user", "content": request_text},
        ]
        response = self.client.chat(
            messages,
            max_output_tokens=DEPTH_TIERS[self.depth],
        )
        self._requests_made += 1
        self._estimated_cost_usd += _estimated_cost(response)

        model_id = response.get("model", "auto")
        content = response["choices"][0]["message"]["content"]
        return (
            f"{self.disclosure_header(model_id)}\n\n"
            f"{content}\n\n"
            f"{HUMAN_DECISION_FOOTER}\n"
            f"Decision owner: {self.decision_owner}"
        )


def _estimated_cost(response: dict[str, Any]) -> float:
    """ESTIMATE the response cost from ledger data when available.

    Sim responses carry no cost. Azure responses' costs are already
    estimated by FoundryClient; we approximate conservatively here from
    usage so the protocol cap can abort a run independently of the client.
    """
    usage = response.get("usage") or {}
    total_tokens = usage.get("total_tokens", 0)
    # Conservative flat ESTIMATE: assume every token bills at a mini-tier
    # output rate ceiling (USD 2.00 / 1M tokens). Real attribution lives in
    # the ledger; this exists only to trip the §6.3 cap early.
    return (total_tokens / 1_000_000) * 2.00


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("request", help="The request text for the agent")
    parser.add_argument("--persona", default="steward", help="Persona id (default: steward)")
    parser.add_argument(
        "--depth",
        default="focused",
        choices=sorted(DEPTH_TIERS),
        help="Depth tier (default: focused)",
    )
    parser.add_argument(
        "--owner",
        required=True,
        help="Named human decision owner (PRD §6.1 — required, no default)",
    )
    args = parser.parse_args(argv)

    run = AgentRun(
        persona_id=args.persona, depth=args.depth, decision_owner=args.owner
    )
    print(run.ask(args.request))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
