# PRD — Azure AI Foundry Integration

**Status:** Draft · **Owner:** CurationsX · **Scope:** Real Azure AI Foundry integration design — **explicitly gated behind the `foundry-sim` local emulator**

> ⚠️ **This integration is NOT enabled in the current build.** `FOUNDRY_MODE=azure` raises a clear error. The local offline simulator (`foundry-sim/`) is the only active mode. Read this PRD to understand the design and prepare for a future real connection. Do not connect keys or incur spend until the sim stage is validated.

## 1. Purpose

Document the design for connecting the CurationsX YOLO repository to Azure AI Foundry using first-party Azure OpenAI deployments, with guardrails that keep all spend within Microsoft for Startups (Founders Hub) credit terms. Establish the `FOUNDRY_MODE=sim|azure` seam so switching from the emulator to the real client is a configuration change, not a code rewrite.

## 2. Background

The `foundry-sim/` package provides a local, zero-cost emulation of Azure AI Foundry behavior (see `foundry-sim/README.md`). Before any real Azure keys are connected, the maintainer uses the simulator to see the visuals, build personas and workflows, and judge ROI.

When the sim stage is validated, the real integration follows the same `FoundryClient` interface — same `client.chat(messages)` call, same response shape — with `FOUNDRY_MODE=azure` and the Azure env vars set.

### Startup Credits guardrails

Microsoft for Startups (Founders Hub) Azure credits have a critical limitation that directly shapes this design:

| Spend type | Covered by Azure Startup Credits? |
| --- | --- |
| Azure OpenAI models (GPT-4o, GPT-4o mini, GPT-4 Turbo, etc.) | ✅ Yes — first-party Azure services |
| Third-party / Marketplace models in Foundry (e.g., Anthropic Claude, Fireworks, Llama via Marketplace) | ❌ No — billed directly to card even when credits exist |
| GitHub Actions / Codespaces / metered billing | ❌ No — separate GitHub billing bucket |

**This integration is restricted to first-party Azure OpenAI deployments only.** Third-party and Marketplace model IDs are blocked by an explicit allowlist. This is not a preference — it is a hard guardrail to prevent unexpected charges against your payment method.

## 3. Goals

1. **Define the real Azure integration design** so it is ready to implement when the sim stage is validated.
2. **Specify auth** — Entra ID (`DefaultAzureCredential`) as default, API key as local-dev fallback only.
3. **Document the first-party-only allowlist** that blocks third-party / Marketplace model IDs.
4. **Specify budget alerts and per-run caps** that enforce the bounded-spend principle.
5. **Keep the `FOUNDRY_MODE` seam clean** — same client interface, config change only.

## 4. Non-Goals

- Enabling `FOUNDRY_MODE=azure` in this build.
- Using third-party or Marketplace models (Claude, Fireworks, Llama via Marketplace, etc.).
- Committing secrets, keys, or endpoints to the repository.
- Replacing the sim emulator as the default mode.
- Capturing or showcasing agent session logs.

## 5. Startup Credits Guardrails

### 5.1 First-party model allowlist

Only the following Azure OpenAI deployment name patterns are permitted. Any deployment name not on this list must be rejected before a request is made:

```python
FIRST_PARTY_ALLOWED_PREFIXES = [
    "gpt-4o",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-35-turbo",
    "gpt-3.5-turbo",
    "text-embedding-ada",
    "text-embedding-3",
    "dall-e",
    "whisper",
    "tts",
]
```

Rejection behavior: raise `ValueError` with a message that names the disallowed deployment and links to this PRD.

### 5.2 Per-run token and request caps

| Cap | Default | Enforcement |
| --- | --- | --- |
| Max output tokens / request | 4,096 | Set in API call parameters; hard cap |
| Max requests / run | 50 | Enforced in client; raise after limit |
| Max estimated cost / run | USD 1.00 | Computed from `rates.json`; abort if exceeded |
| Request timeout | 30 s | `httpx` timeout parameter |

### 5.3 Budget alerts

Set the following Azure Cost Management alerts in the Azure portal for the subscription:
- 80% of monthly credit budget → email alert to maintainer.
- 100% of monthly credit budget → email alert to maintainer + block further spend.

These alerts are a manual setup step in the Azure portal; they are not configured by code in this repository.

> **Important:** Azure budgets generate *notifications only* — they do not automatically stop or deallocate resources. Treat every budget as an alarm, not a circuit breaker. Any "block further spend" behavior requires an explicit action group / automation, which must be designed and approved separately.

### 5.4 Billing model — pay-as-you-go only (hard rule)

The Azure Foundry integration MUST use **Standard (pay-as-you-go) token-based billing only**.

- **Never** provision PTU (Provisioned Throughput Units), reserved capacity, or any pre-paid monthly package. These bill continuously regardless of usage — a prior accidental provisioned-capacity dependency cost roughly **USD 499/day** with zero usage.
- Prefer the most cost-effective standard token option available for the required model (e.g., Global Standard deployment of a small/mini model tier).
- Any deployment SKU other than Standard requires explicit written approval from the maintainer before creation.

**Maintainer approval (2026-07-12):** Azure AI Foundry is approved as the future host for the real integration, under these conditions:

- Spend draws on the **Microsoft for Startups credits** on the existing subscription.
- Models are **OpenAI-family mini/small tiers** (e.g., a `*-mini` deployment) on Standard pay-as-you-go token billing.
- All rules in this section (no PTU, no pre-paid) continue to apply.

### 5.5 Billing separation note

GitHub metered billing (Actions, Codespaces, Copilot) is billed separately from Azure credits. Do not assume Azure credits offset GitHub charges. Monitor both billing buckets independently.

## 6. Functional Requirements

### 6.1 Authentication

Auth follows this priority order:

1. **Entra ID — `DefaultAzureCredential`** (default, recommended for production).
   - Uses managed identity, workload identity, or developer credentials automatically.
   - No secret in code or environment. Rotates automatically.
   - Set `AZURE_CLIENT_ID` if using a user-assigned managed identity.

2. **API key — local development fallback only.**
   - Read from `AZURE_OPENAI_API_KEY` environment variable.
   - Never committed to the repository.
   - Used only when `DefaultAzureCredential` is unavailable (local dev without managed identity).

### 6.2 Configuration (environment variables only)

All configuration is via environment variables. No values are committed to the repository. See `.env.example` for the list of variable names.

| Variable | Required | Description |
| --- | --- | --- |
| `FOUNDRY_MODE` | Yes | `sim` (default) or `azure`. Must be explicitly set to `azure` to enable. |
| `SIM_PROFILE` | No | Persona hint for sim mode. Default: `auto`. |
| `AZURE_OPENAI_ENDPOINT` | azure mode | Full endpoint URL, e.g. `https://<resource>.openai.azure.com/` |
| `AZURE_OPENAI_DEPLOYMENT` | azure mode | Deployment name (checked against first-party allowlist) |
| `AZURE_OPENAI_API_VERSION` | azure mode | API version, e.g. `2024-02-01` |
| `AZURE_CLIENT_ID` | No | Client ID for user-assigned managed identity (Entra ID) |
| `AZURE_OPENAI_API_KEY` | No | Local-dev fallback only. Prefer `DefaultAzureCredential`. |

### 6.3 Python dependencies (future real integration)

The following dependencies belong to the real Azure integration and are **not installed or required by the sim**. They should be captured as an optional dependency set in `automation/pyproject.toml` when the real integration is built:

```toml
[project.optional-dependencies]
azure = [
    "openai>=1.30",
    "azure-identity>=1.17",
    "httpx>=0.27",
    "pydantic>=2.7",
]
```

The `foundry-sim/` simulator and all current tooling remain standard-library-only.

### 6.4 Client interface (unchanged from sim)

The real Azure client must implement the same interface as `FoundryClient`:
- `client.chat(messages, *, fixture_id=None, record_to_ledger=True)` → response dict
- `client.complete(prompt, ...)` → response dict
- `client.list_fixtures()` → list (returns empty in azure mode)
- `client.get_ledger()` → ledger dict

Switching from sim to azure is `FOUNDRY_MODE=azure` — no changes to personas, workflows, or calling code.

## 7. Mermaid: Sim / Azure seam

```mermaid
flowchart TD
    ENV{FOUNDRY_MODE?}
    ENV -- sim (default) --> SIM([foundry-sim\nfoundry_client.py\nFixture responses\nNo network · No cost])
    ENV -- azure --> GUARD{Deployment in\nfirst-party\nallowlist?}
    GUARD -- No --> ERR([ValueError:\nBlocked deployment\nSee PRD §5.1])
    GUARD -- Yes --> AUTH{DefaultAzureCredential\nor API key fallback}
    AUTH --> CAPS{Per-run caps\nwithin limits?}
    CAPS -- Exceeded --> ABORT([Abort + notify\nmaintainer])
    CAPS -- OK --> AZURE([Azure OpenAI API\nReal response\nBilled to first-party credits])
    AZURE --> LED([Ledger: real token counts\n+ ESTIMATE cost from rates.json])
```

## 8. Mermaid: Auth flow

```mermaid
flowchart LR
    START([azure mode requested]) --> DC[DefaultAzureCredential\nentra ID / managed identity]
    DC -- success --> TOKEN([****** secret in code])
    DC -- unavailable in\nlocal dev --> KEY[AZURE_OPENAI_API_KEY\nenv var\nnever committed]
    TOKEN --> CALL([API call with\nper-run caps enforced])
    KEY --> CALL
```

## 9. `.env.example`

See `.env.example` in the repository root. That file lists variable names only — no values, no secrets. Add actual values to your local `.env` file (git-ignored) or to GitHub Actions secrets.

## 10. Success Criteria

- `FOUNDRY_MODE=azure` raises a clear error in the current build (implemented).
- `FOUNDRY_MODE=sim` (default) runs fully offline with no network calls (implemented).
- When the real integration is built: all requests go through the first-party allowlist check; no third-party model can be invoked.
- Budget alerts set in Azure portal; per-run caps enforced in code.
- No secrets committed; `tools/yolo.py doctor` passes unchanged.

## 11. Open Questions

- Which Azure region will host the OpenAI deployment (affects latency and data residency)?
- Should `DefaultAzureCredential` be the only auth path in production, or should Workload Identity Federation be configured for CI/CD?
- What is the initial monthly token budget cap to set in Azure Cost Management?
- Which API version (`AZURE_OPENAI_API_VERSION`) will be locked at first deployment?

## 12. Milestones

1. **M1 — Sim validated:** `foundry-sim` emulator runs fully offline; all tests pass; dashboard shows correct topology and ESTIMATE cost.
2. **M2 — Design approved:** This PRD reviewed and approved by maintainer.
3. **M3 — Azure provisioning:** Azure OpenAI resource created; first-party deployment configured; budget alerts set.
4. **M4 — Auth configured:** `DefaultAzureCredential` tested with managed identity; API key fallback documented.
5. **M5 — Integration tested:** Real integration tested against the first-party deployment; per-run caps validated; cost ledger updated with real token counts.
6. **M6 — Community pilot:** First real agent invocation under the protocol in `docs/PRD-aot-agent-protocol.md`.
