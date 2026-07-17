# Agent Identity Card — YOLO Steward

> Required by `docs/PRD-aot-agent-protocol.md` §6.2 before any community pilot.
> This file is the **versioned identity card** — changes require a change-log
> entry below and a named human approver (resolves PRD §9: the card lives in
> the repository, not a pinned discussion).

| Field | Value |
| --- | --- |
| **Agent name** | YOLO Steward |
| **Persona definition** | `foundry-sim/personas/steward.json` |
| **Model and provider** | `gpt-5.4-mini` (version 2026-03-17) — first-party Azure OpenAI deployment `gpt-5.4-mini` on resource `yolo-foundry` (eastus2), GlobalStandard pay-as-you-go billing. In sim mode: no model, fixture responses only. |
| **Permissions** | **Read + suggest only.** May read the text a human explicitly pastes into an invocation and return labeled suggestions. May **not** post, label, close, merge, or modify discussions, PRs, or repository content. No repository write access exists in the runner. |
| **Invocation** | Explicit only: `python foundry-sim/agent.py --persona steward --depth <tier> --owner "<named human>" "<request>"`. Never scheduled, never triggered by links or posts. |
| **Contact** | Repository maintainer — @curationsx (named human decision owner is required per invocation and printed in every response). |

## Hard limits (PRD §6.3 — enforced in `foundry-sim/agent.py`)

| Limit | Value | Enforcement |
| --- | --- | --- |
| Max output tokens / request | 2,048 (Deep tier ceiling; Focused = 512, Standard = 1,024) | Passed per-request; clamped again by `foundry_client.py` |
| Max requests / run | 10 | `ProtocolLimitError` raised before send |
| Max estimated cost / run | USD 0.10 | `ProtocolLimitError` raised before send — run aborts and notifies; it does not truncate (resolves PRD §9) |
| Request timeout | 30 s | `foundry_client.py` per API call; fail-open with a surfaced error |
| Model allowlist | First-party Azure OpenAI mini tier only | `foundry_client.py` Tier 1 allowlist (`docs/PRD-azure-foundry-integration.md` §5.1) |

Every response carries the §6.5 contract: a disclosure header
(`🤖 YOLO Steward · <model> · Depth: <tier> · <Simulated|Live>`), element
labeling (**fact / assumption / suggestion / open question**), and the footer
`Human decision required — the named owner accepts, rejects, or adapts this
response.`

## Staging status (PRD §6.4)

| Stage | Status |
| --- | --- |
| 1. Sim gate (fictional fixtures, no network) | ✅ Passed 2026-07-12 — full test suite green incl. protocol tests |
| 2. Internal pilot (1–3 discussions, human review of every response) | 🚧 In progress — first live invocation 2026-07-12 |
| 3. Community pilot (opt-in, monitored) | ⬜ Not started |
| 4. General availability | ⬜ Not started |

## Change log

| Date | Change | Human approver |
| --- | --- | --- |
| 2026-07-12 | Initial identity card. Runner (`agent.py`), steward persona, protocol hard limits, and depth tiers created. Model: `gpt-5.4-mini` (2026-03-17) on `yolo-foundry`. | @curationsx (Wyatt) — approved "move to implementation" 2026-07-12 |
