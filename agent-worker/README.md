# CURATIONS agent gateway

Cloudflare Worker for `api.curations.dev`, with an equivalent Node/Azure
gateway (`ca-yolo-gateway`) for the Azure migration described in
`.azure/deployment-plan.md`.

Both entrypoints reuse the same platform-agnostic route logic
(`src/router.ts`) through a project-owned `Env` contract
(`src/platform/contracts.ts`) — shared handlers never import Cloudflare's
`KVNamespace`, `DurableObjectNamespace`, or `Fetcher` types, or an Azure SDK
type directly. Two adapter layers implement the contract:

- `src/platform/cloudflare.ts` — KV, Durable Objects, the Cloudflare
  Container runtime, and master-key Cosmos REST (`src/cosmos.ts`).
- `src/platform/azure/*` — the Cosmos SDK with managed identity, Foundry with
  a managed-identity bearer token, and an internal HTTPS call to the Copilot
  runtime Container App.

It is the only write gateway for the static Astro site and owns:

- GitHub OAuth identity (`read:user` only),
- explicit one-run GitHub Copilot delegation,
- a private Container running the official Copilot SDK with zero tools,
- Azure OpenAI persona calls,
- server-side model/rate limits,
- Cosmos DB discussions and votes,
- read-only public GitHub repository marker checks,
- opaque CURATIONS sessions in KV (Cloudflare) or Cosmos `gateway-state`
  (Azure).

## Secrets

Set with Wrangler; never commit values:

```bash
npx wrangler secret put AZURE_OPENAI_API_KEY
npx wrangler secret put COSMOS_KEY
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put COPILOT_TOKEN_ENCRYPTION_KEY
```

`COPILOT_TOKEN_ENCRYPTION_KEY` must be 32 random bytes encoded as unpadded
base64url. Generate it without writing the value to source control:

```bash
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
```

`GITHUB_REPOSITORY_TOKEN` is optional. Without it, public repository metadata
uses GitHub's anonymous API allowance. If one is added later, it must be a
read-only token used only for public metadata checks; never reuse a contributor's
OAuth access token or the OAuth app client secret.

Repository verification is deliberately narrow: the Worker reads public
metadata and a small allowlist of marker files at a user-selected stack root.
It does not clone, execute, modify, or deploy community repositories. A marker
is evidence of setup, not an audit or endorsement.

## One-time GitHub OAuth app

GitHub does not expose OAuth app registration through its API. Create the app
under the `curationsx` organization (or the approved CURATIONS owner) with:

- **Application name:** `CURATIONS.DEV Community`
- **Homepage URL:** `https://curations.dev`
- **Authorization callback URL:** `https://api.curations.dev/api/auth/github/callback`
- **Device flow:** disabled

Normal identity sign-in uses state + PKCE, requests only `read:user`, verifies the
profile, then discards GitHub's access token. Only an opaque CURATIONS session
remains.

**Use My Copilot** is a separate, explicit flow. It verifies the same GitHub
identity, encrypts the delegated token, expires it within ten minutes, and
atomically consumes it once. The Container exposes no repository, filesystem,
shell, MCP, skill, plugin, or external tool access. GitHub charges the user's
Copilot plan; the gateway never falls back to Azure.

## Running the Node/Azure gateway locally

```bash
npm ci
export ALLOWED_ORIGINS=http://localhost:4321
export COSMOS_ENDPOINT=... COSMOS_DATABASE=curations
export COSMOS_CONTAINER=engagements COSMOS_VOTES_CONTAINER=votes
export COSMOS_SCORES_CONTAINER=scores COSMOS_DISCUSSIONS_CONTAINER=discussions
export AZURE_OPENAI_ENDPOINT=... AZURE_OPENAI_DEPLOYMENT=gpt-5.4-mini
export COPILOT_RUNTIME_URL=http://127.0.0.1:8081 COPILOT_RUNTIME_SHARED_SECRET=...
export SOFTWARE_TARGETS=cloudflare,supabase
npm run start:azure
```

Configuration is validated all at once at startup (`src/platform/azure/config.ts`)
— a broken revision throws before it starts listening, so Container Apps never
routes traffic to it. Locally, `DefaultAzureCredential` is used; when
`AZURE_CLIENT_ID` is set (the Container Apps production configuration),
`ManagedIdentityCredential` is used instead — no Cosmos or Foundry API key ever
exists in the Azure path.

`/api/live` reports process liveness; `/api/ready` runs bounded, non-billable
Cosmos and Foundry checks; `/api/health` keeps the existing public-compatible
response.

## Local checks

```bash
npm ci
npm run check
npm test
npm run test:coverage
npm --prefix copilot-runtime ci
npm --prefix copilot-runtime test
```

The Azure deployment must remain mini-tier and pay-as-you-go. Do not add PTU,
reserved model capacity, or a prepaid monthly token package.

