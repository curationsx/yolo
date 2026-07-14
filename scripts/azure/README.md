# scripts/azure — Operational tooling for the Yolo Azure migration

Implements the "Azure operational scripts" lane of
`.azure/deployment-plan.md`. Every script here is **default-safe**:

- Dry run is the default everywhere. Nothing mutates Azure, Cloudflare, or a
  certificate authority unless you pass the documented `--apply` (and, for
  the highest-stakes tools, an exact `--confirm <phrase>`).
- Nothing here prints a secret. `lib/common.sh` (bash) and
  `lib/redaction.mjs` (Node) redact secret-shaped values as a backstop.
- Every script refuses to run against an uncommitted git working tree where
  that matters (source control is the deployment authority).
- No script deletes a Cloudflare Worker script or Pages deployment. No
  script invokes Owner-only bootstrap implicitly.

## Layout

```
scripts/azure/
  bootstrap.sh          Owner-only prerequisite/quota checks + one-time bootstrap invocation
  build-images.sh       az acr build for gateway + Copilot runtime, immutable Git SHA tags
  deploy.sh             Contributor-safe runtime deployment (Container Apps + SWA)
  certificate.sh        ACME DNS-01 certificate prep (plan/generate-csr only by default)
  verify.mjs            Read-only endpoint/TLS/header/redaction verification, any BASE URL
  reconcile-scores.mjs  Vote/score reconciliation (fixture or real Cosmos, dry-run default)
  cutover.mjs           Cloudflare DNS cutover + rollback tool (fixture or real, dry-run default)
  lib/                  Shared bash + Node helpers (config, safety gates, redaction, HTTP, etc.)
  test/                 Bash test harness + node:test suites, all fixture/mock-based
```

## Running the tests

```bash
cd scripts/azure
npm test              # both suites
npm run test:bash      # argument parsing, dry-run, confirmation gates (bash)
npm run test:node      # verify/reconcile/cutover core logic + CLI smoke tests (Node)
```

Both suites are entirely offline: the bash suite stubs `az` and `gh` with
fixture binaries and uses a throwaway git repository; the Node suite uses
local JSON fixtures standing in for Cloudflare/Cosmos state and injectable
fetch/TLS/verify implementations. No script in this directory touches a
real Azure, Cloudflare, GitHub, or Cosmos account during tests (except one
documented, read-only, human-verified smoke check of the real Cloudflare
API — see `cutover.mjs` below).

## Dependencies

**`npm ci`/`npm test`/`npm run test:*` never require any dependency to be
installed** — every script and every test in this directory is
fixture/dry-run-by-default and works from a bare checkout with zero
`node_modules`.

The **one exception**: `reconcile-scores.mjs`'s real (non-`--fixture`)
Cosmos mode dynamically imports `@azure/cosmos`/`@azure/identity` at
runtime. These are pinned as ordinary `dependencies` in this directory's
own `package.json` (matching `agent-worker/package.json`'s current
`^4.9.3`/`^4.13.1` ranges) with a committed `package-lock.json`, so the
install is source-reproducible rather than an untracked, undocumented
ad-hoc step. **Run `npm ci --prefix scripts/azure` once before the first
real (non-`--fixture`) reconciliation** in any fresh checkout, CI job, or
ops job invocation — whichever workflow/job actually invokes real
reconciliation is responsible for this step (this lane only owns
`scripts/azure/**`; wiring it into `.github/workflows/**` or the ops job's
own entrypoint is a coordination item for whichever lane owns those
files).

## Script reference

### bootstrap.sh

Owner-only, one-time bootstrap wrapper. Runs every prerequisite check
(`az`/`azd`/`git`/`jq`/`gh` present, signed-in Owner role, required resource
providers registered, ACR/Key Vault name availability, Container Apps
consumption-core quota, budget contact email configured, GitHub environment
branch policies — see below) and only invokes `az deployment sub create
--template-file infra/bootstrap.bicep ...` when given both `--apply` and
`--confirm bootstrap-<resource-group>`. Refuses on a dirty git worktree.
Never printed: any secret value.

**Budget contact email (plan acceptance criterion "Azure budget active"):**
`infra/bootstrap.bicep`'s `budgetContactEmails` parameter defaults to an
empty array, and the committed `infra/main.parameters.json` intentionally
leaves it empty — an email address is not something to commit to source
control — which makes the Bicep template **skip creating the
`$YOLO_BUDGET_AMOUNT` budget entirely**. `--budget-contact-email
<email[,email...]>` (or the `$YOLO_BUDGET_CONTACT_EMAIL` env var) supplies
it at apply time instead: `--apply` **refuses to run** without one
configured, and when applying, the address(es) are passed inline as
`--parameters budgetContactEmails=[...]` directly to `az deployment sub
create` — never written to any committed file. Dry run reports only
*whether* a contact is configured (`budget:contact-email` check,
pass/skip) — the address itself is never printed, in dry run, `--json`
output, or the apply-time log line.

**GitHub environment branch policies (OIDC hardening):** an
environment-scoped federated subject
(`repo:curationsx/yolo:environment:<name>`) only narrows *which token* a
workflow job can mint — it does **not** by itself restrict *which git ref*
may use that environment. That restriction is a separate GitHub API
resource: each environment's own deployment branch policy. Every run of
`bootstrap.sh` (dry run or `--apply`) verifies, via `gh api`:

- `production` has a **custom branch policy restricted to exactly `main`**
  — any other branch, or a wildcard pattern, fails the check closed.
- `azure-staging` has a custom branch policy that includes the **current
  git branch** (and `main`, for when it merges) — a wildcard pattern also
  fails closed.
- `gh` is authenticated (`gh auth status`).

`bootstrap.sh --configure-github-environments --confirm
configure-github-environments [--staging-branches <comma,list>]` applies
these policies for real (idempotent — safe to re-run as feature branches
rotate through staging, and self-healing — it prunes any non-`main` branch
it finds on `production`). This is a GitHub API resource, not an Azure one,
so it is deliberately a separate action from `apply_bootstrap`'s Bicep
deployment. Verify manually at any time with: `gh api
repos/curationsx/yolo/environments/<name>/deployment-branch-policies`.
Production remains `workflow_dispatch`/manual only at the workflow-trigger
level (`.github/workflows/azure-deploy.yml`, outside this lane's scope) —
the branch policy above is the second, independent layer of protection.

### build-images.sh

Builds the gateway and Copilot runtime images with `az acr build` (no local
Docker). Tags are the current (or explicitly pinned) Git commit SHA —
mutable tags like `latest` are rejected. Dry run prints the exact commands;
`--apply` submits the remote builds. Refuses on an uncommitted git
worktree **unconditionally** — including when `--sha` is given explicitly
to pin a specific already-verified commit — so a dirty tree can never
silently slip an unverified change into an image tagged with a *different*
(older, committed) SHA.

### deploy.sh

Applies `infra/runtime.bicep`-scoped, Contributor-safe deployment only:
updates the two Container Apps to caller-supplied **immutable** image refs
and publishes the Astro `dist/` artifact to Static Web Apps. Structurally
refuses to ever invoke Owner bootstrap. Dry run by default.

**`--deployment-revision <marker>` (required for `--apply`):** a non-secret
marker — e.g. the GitHub Actions run ID — forcing a fresh Container Apps
revision on every deploy. Staging and production commonly deploy the same
image SHA, and the GitHub OAuth Key Vault references
(`github-client-id`/`github-client-secret`) are deliberately versionless;
without a genuinely new revision, Container Apps can reuse a still-running
revision whose secret values were already read from Key Vault at a
previous (e.g. staging) version, silently keeping a stale OAuth secret
cached through a same-image staging→production rollout. Hashed (SHA-256,
truncated, letter-prefixed) into a sanitized, always-valid
`--revision-suffix` passed to **both** `az containerapp update` calls —
the same input always yields the same suffix for both apps. Mirrors
`infra/modules/apps.bicep`'s own `deploymentRevision` /
`sanitizedRevisionSuffix` (`'r${uniqueString(deploymentRevision)}'`)
mechanism for deploys that go through the Bicep template instead of this
direct Contributor path. Dry run allows omitting it (warns only, and never
shows a `--revision-suffix` in the preview); `--apply` refuses without it.

**Static Web Apps publish:** invoked via `npx --yes @azure/static-web-apps-cli@2.0.9`
— a pinned version, never a bare `swa` binary — since neither this
script's own dependencies nor the workflow that calls it install the `swa`
CLI globally; a bare `swa` call would fail with "command not found" the
first time this actually runs in CI. The SWA CLI's own `--env` flag (a
*preview environment* selector, unrelated to this script's own
`--environment azure-staging|production` GitHub Environment label used for
the Container Apps image deploy above) is **always** hardcoded to
`production` regardless of `--environment` — the Static Web Apps resource
itself does not yet have a separate staging deployment slot or
custom-domain-live staging host, so both `azure-staging` and `production`
runs must publish to the same SWA resource's production/default
environment for the generated default hostname (used for human review, and
queried by `verify.mjs`) to actually serve the build.

`--verify-gateway [--gateway-verify-timeout <secs>] [--gateway-verify-poll-interval <secs>]`
triggers post-deploy gateway health verification — but **never** by calling
the gateway's URL directly. The staging (and production) gateway's ingress
is restricted to an explicit IP allow-list (plan Sec. "Network
boundaries"), so a GitHub-hosted runner can neither reach it nor should it
try — the only acceptable "fix" for a blocked check is *not weakening that
restriction*. Instead, this triggers the `caj-yolo-ops` Container Apps Job
(`az containerapp job start`), which runs *inside* the same Container Apps
environment and can reach the gateway without touching the IP restriction
at all, then polls the job execution to completion and fails clearly if it
doesn't succeed. For checks that genuinely need to run from outside Azure
(the public Static Web App, or an operator on an allow-listed IP), use
`verify.mjs` directly instead — see below.

### certificate.sh

Prepares the temporary ACME DNS-01 certificate workflow for
`api.curations.dev` only. Default `--plan` mode only prints the workflow steps.
`--generate-csr` creates a private key + CSR in a `0700` directory (key file
`0600`), auto-cleaned by an EXIT/INT/TERM trap unless `--keep-workdir` is
passed — its file path is never printed to logs (only the non-sensitive CSR
path is).

`--apply --confirm issue-api-curations-dev` **really executes** the
automated path end to end when `CLOUDFLARE_API_TOKEN` is set in the
environment (never a CLI flag, never logged): it creates an isolated
Python venv and a `certbot-dns-cloudflare` credentials file
(`dns_cloudflare_api_token = ...`, built directly from the env var) at
`0600`, both inside the same private `0700` working directory as Certbot's
forced `--config-dir`/`--work-dir`/`--logs-dir` (never the global Certbot
paths); installs the pinned, mutually compatible `certbot==5.6.0` +
`acme==5.6.0` + `certbot-dns-cloudflare==5.6.0` trio into that venv; runs
`certbot certonly
--dns-cloudflare` (which creates *and* removes the `_acme-challenge` TXT
record itself — no manual DNS step); packages the result into a
password-protected PFX; uploads it via `az containerapp env certificate
upload --certificate-name <generated-name>`; verifies the upload by
comparing the local PFX's SHA-1 thumbprint against `az containerapp env
certificate list`'s reported thumbprint for that same name (warns, but
does not fail, on a mismatch — a brief Azure propagation delay is
possible); and lets the EXIT/INT/TERM trap securely remove the entire
temporary directory (venv, credentials file, PFX, PFX password, and all
Certbot state together). `az containerapp env certificate upload` has no
file-based password option — `--password` is a plain CLI
argument, an inherent Azure CLI interface limitation, not a choice made
here; the value is read from its `0600` file only for the instant of that
one call and never logged. Without a Cloudflare token, `--apply` falls
back to detecting a system-installed certbot/acme.sh and only *preparing*
(never executing) the manual-DNS-01 flow (operator creates the TXT record
by hand) — automating a human DNS step with no Cloudflare credential to
do it with isn't possible.

`--convert-to-pfx --cert <path> --key <path> [--chain <path>] --out
<path.pfx> [--password-file <path>]` remains a real, independently usable
subcommand for packaging an already-obtained cert+key (e.g. from the
manual-DNS-01 path): it exports a password-protected PFX via `openssl
pkcs12 -export -passout file:...` (never `pass:...`, which would otherwise
expose the password in the process list). If `--password-file` isn't
given, a random password is generated into its own `0600` file inside the
same private working directory; that password value is never printed
(only its storage path is, when useful for chaining).

The Azure-managed certificate for `api.curations.dev` cannot issue until
the gateway's default-deny IP restriction is removed (DigiCert must reach
the app), so this temporary certificate is what bridges TLS during
`cutover.mjs`'s `cut-api` step. `curations.dev`/`www.curations.dev` don't
need this workflow at all — see `cutover.mjs` below.

**Test seam:** `YOLO_CERT_PIP_BIN`/`YOLO_CERT_CERTBOT_BIN` override the
venv's own absolute `pip`/`certbot` binary paths — empty (unset) in
production, so `--apply` always uses the real venv's own binaries; only
`scripts/azure/test/**` sets them, to fixture scripts
(`test/fixtures/bin/pip`, `test/fixtures/bin/certbot`) that never reach
PyPI/Let's Encrypt. The fixture `certbot` copies a fixed, pre-generated,
self-signed test-only certificate/key pair
(`test/fixtures/data/fake-api-{fullchain,privkey}.pem` — never a real key)
into Certbot's expected layout, so its SHA-1 thumbprint is stable and
known in advance, letting tests assert the thumbprint-verification step
actually matches.

**Never echoed, anywhere, under any mode:** the ACME TXT challenge value,
the Cloudflare API token, the PFX export password, or the private key's
file path.

### verify.mjs

Read-only verification against any configurable `--gateway-url`/`--site-url`
(staging or production): `/api/live|ready|health`, public site routes, TLS
certificate validity, required security headers, and a secret-leak scan of
every response body. Only issues `GET`/`HEAD`/`OPTIONS`; there is no flag
that allows a write. Exit code reflects overall pass/fail for CI use.

**`--gateway-url` and the staging IP restriction:** the staging (and
production) gateway only accepts traffic from Wyatt's IP. Never invoke this
tool with `--gateway-url` against that gateway from a GitHub-hosted runner
or any other non-allow-listed network — see `deploy.sh --verify-gateway`
for the correct way to check gateway health from CI (it runs from *inside*
Azure via the `caj-yolo-ops` job instead). `--site-url` **alone** — no
`--gateway-url` at all — never touches the gateway and is always safe to
run from anywhere, including CI, since the Static Web App has no IP
restriction. Passing neither URL, or an invalid combination (e.g.
`--check-www-redirect` without both `--www-url` and `--site-url`), fails
immediately with a specific error rather than doing nothing silently.

`--check-www-redirect --www-url <url> --site-url <url>` additionally
confirms production parity: `https://www.curations.dev/` must still return
a `301` to `https://curations.dev/`, exactly as it does today on
Cloudflare. Azure Static Web Apps provides this by marking `curations.dev`
as the app's default custom domain (every other bound hostname, including
`www` and the generated `*.azurestaticapps.net` hostname, then redirects to
it automatically) — a manual Azure Portal action, since the Azure CLI has
no documented command for it yet (see `cutover.mjs`'s `set-default-domain`
step below). This check is the authoritative way to confirm that action
took effect; it is deliberately never faked with host-matching rules in
`staticwebapp.config.json`. It performs exactly one `GET` with redirect
following disabled (`redirect: "manual"`) — still read-only.

### reconcile-scores.mjs

Rebuilds a target mirror's score counts from authoritative `votes`
partitions (see plan's "Azure State Model"). There are **two distinct
mirrors**, never interchangeable, selected by the **required** `--mode`
flag (no default — the tool refuses to run without it):

1. **`--mode backfill`** — pre-cutover, before Azure serves any traffic.
   Writes the **same-partition Azure score metadata document** living
   *inside the `votes` container itself* — `{id: "score",
   doc_type: "score", target_id, count, updated_at}`, partitioned by
   `target_id` (matches `agent-worker/src/platform/azure/community.ts`'s
   `ScoreDoc`/`reconcileScoreFromVotes` exactly). No timing gate.
2. **`--mode post-cutover`** — after `api.curations.dev`'s DNS is cut to
   Azure, Cloudflare's proxied DNS TTL (`300s`) means some
   resolvers/clients keep reaching the legacy Cloudflare Worker for a
   while, which can still write `votes` *without* updating Azure's score
   metadata. This targets the **same same-partition mirror as
   `--mode backfill`** (it's the same read/write target, just re-run after
   the race window closes). This is the **only** mode with a timing gate:
   `--apply` **requires** either `--cutover-manifest <path>` (a
   `cutover.mjs` rollback manifest — its recorded `cut-api` step timestamp
   is used) or an explicit `--since <iso-timestamp>`, and refuses to write
   until at least `--min-wait-seconds` (default `600` — one full old-DNS
   TTL, never less than 10 minutes) have elapsed since the API was cut.
   Dry run is **never** gated by this. Supplying `--cutover-manifest`/
   `--since` with any other `--mode` is a hard error — those phases are
   never time-gated.
3. **`--mode pre-rollback`** — immediately before falling back to
   Cloudflare. Writes the **separate legacy `scores` container** —
   `{id: target_id, scope: "global", target_id, count, updated_at}`,
   partitioned by the single `scope: "global"` value (matches
   `agent-worker/src/community.ts`'s `ScoreDoc`,
   `agent-worker/src/vote-guard.ts`, and
   `reconcileLegacyScoresContainer`) — so Cloudflare's compatibility store
   is correct again before rollback. No timing gate.

All three modes share the same authoritative `votes` read
(`fetchVotesFromContainer`): it counts BOTH legacy Cloudflare-Worker vote
documents (`{id, target_id, user_id, created_at}`, **no** `doc_type` field
at all) and Azure-native vote documents (`doc_type: "vote"`), excluding the
same-partition score metadata document (`id: "score"`) — this is what lets
every phase absorb a true legacy-shaped vote correctly. The reconciliation
is idempotent by construction (always "authoritative count now vs. mirror
count now", written as an upsert), so re-running any mode any number of
times — including back-to-back, or repeatedly if even later votes trickle
in during the post-cutover race window — safely converges without
double-counting.

`--fixture <path>` mode is fully offline (reads/writes local JSON, used by
this task and by most of the test suite — its `{votes, scores}` shape is
this tool's own generic abstraction and applies identically regardless of
which real mirror `--mode` would select). Real Cosmos mode requires
`--cosmos-endpoint` and dynamically imports `@azure/cosmos` +
`@azure/identity` only when actually connecting — pinned, ordinary
`dependencies` with a committed `package-lock.json` (see "Dependencies"
above; run `npm ci --prefix scripts/azure` first); it automatically
targets the `votes` container itself for `backfill`/`post-cutover`, or the
separate `--scores-container` for `pre-rollback`. **Credential
selection:** when the standard `AZURE_CLIENT_ID` env var is set (as
`caj-yolo-ops`'s user-assigned managed identity binding does), uses
`ManagedIdentityCredential(AZURE_CLIENT_ID)` directly; falls back to
`DefaultAzureCredential()` only when `AZURE_CLIENT_ID` is unset (e.g. a
local `az login` session). Dry run always reports the diff; `--apply
--confirm reconcile-scores` writes (subject to the post-cutover wait gate
above).

### cutover.mjs

Snapshots Cloudflare's root/www CNAMEs and the `api.curations.dev` Worker
Custom Domain, then — only with `--apply --confirm curations.dev` (or
`--confirm rehearse-cutover` with `--rehearse`) — runs the plan in this
order:

1. **`validate-swa-root` / `validate-swa-www`** — prevalidates *both*
   `curations.dev` and `www.curations.dev` as Azure Static Web Apps custom
   hostnames using the `dns-txt-token` method (`az staticwebapp hostname set
   --validation-method dns-txt-token` in real mode), while Cloudflare is
   still serving production. Each publishes its own `_dnsauth.<hostname>`
   validation TXT record in Cloudflare. This is purely additive — it never
   touches the existing CNAMEs/proxying, so it cannot affect live traffic —
   and the tool waits (bounded, injectable-delay poll) for Azure to report
   each hostname `Ready` before continuing. Azure requires a second
   `hostname set` after the TXT record is public, and live validation can
   take several minutes; the tool retriggers that operation, waits up to
   five minutes, and skips any hostname already `Ready` so interrupted runs
   resume without requiring Azure's retired validation token.
2. **`verify-asuid-api`** — additive, and deliberately run *before*
   `cut-api` ever touches the Worker Custom Domain: reads
   `ca-yolo-gateway`'s non-secret `properties.customDomainVerificationId`
   (`az containerapp show --query properties.customDomainVerificationId`
   in real mode — only this single field, never the full resource) and
   publishes it as the `asuid.api.curations.dev` TXT record Azure Container
   Apps requires to prove hostname ownership before it will allow a bind
   (plan's "API Certificate Cutover" step 5). Like the SWA validation
   token, this value is not a secret — it's designed to be published
   publicly — and it's fed through the exact same
   `upsertDnsRecord(txtRecordName, { type: "TXT", content: ... })` path the
   `validate-swa-*` steps already use.
3. **`cut-api`** — `api.curations.dev` is a Cloudflare **Worker Custom
   Domain** (`/accounts/{account_id}/workers/domains/{domain_id}`), which
   auto-manages a proxied placeholder `AAAA 100::` record. This step (a)
   detaches the custom domain, (b) polls (bounded, injectable delay) until
   that managed `AAAA` record has actually disappeared — Cloudflare's
   removal isn't necessarily instantaneous, and creating the Azure CNAME
   any earlier could collide with the still-present managed record — and
   only then (c) creates a DNS-only (unproxied) CNAME to the Azure gateway
   FQDN. TLS here is bridged by the temporary ACME certificate from
   `certificate.sh` until the gateway's IP restriction is lifted and
   Azure's managed certificate can issue. The old Cloudflare **Advanced
   Certificate** for `api.curations.dev` is not auto-deleted by any of this
   and this tool never deletes it either — it stays intact through the
   full seven-day rollback window.
4. **`bind-api-hostname`** — a separate, explicitly verified step
   immediately after `cut-api`'s CNAME is created: binds
   `api.curations.dev` + the already-uploaded temporary certificate
   (`certificate.sh --apply`'s exact `--certificate-name`, supplied via the
   acceptance file's `apiCertificateName` field or `--staging-api-certificate-name`
   for `--rehearse`) to the gateway via `az containerapp hostname bind
   --certificate <name>`. Kept distinct from `cut-api` itself so a
   DNS-only success (CNAME created, but the bind rejected for any reason)
   shows up as its own failed/pending manifest step, never silently folded
   into "cut-api succeeded".
5. **`cut-root` / `cut-www`** — now that both hostnames are already
   `Ready`, Cloudflare CNAME-flattens the apex directly to the Azure Static
   Web App hostname (no separate apex workaround needed), and `www` follows
   the same way. Azure issues each hostname's managed certificate
   automatically once the CNAME resolves to the Static Web App — no ACME
   bridging is needed for `curations.dev`/`www.curations.dev`.
6. **`set-default-domain`** (manual Portal gate) — production parity
   requires `https://www.curations.dev/` to keep 301-redirecting to
   `https://curations.dev/`, exactly as it does today on Cloudflare. Azure
   Static Web Apps provides this by marking `curations.dev` as the app's
   *default custom domain*, but the Azure CLI currently has no documented
   command for it — this tool cannot automate it, and it deliberately does
   **not** fake the redirect with host-matching rules in
   `staticwebapp.config.json`. This step performs no mutation at all: it is
   only marked complete when `--confirmed-manual-steps set-default-domain`
   is passed, which should only happen after the operator has (a) set
   `curations.dev` as the default domain in the Azure Portal, and (b)
   independently confirmed the 301 with
   `verify.mjs --check-www-redirect --www-url https://www.curations.dev/
   --site-url https://curations.dev/`. Reaching this step without that flag
   is **not treated as a failure** — every traffic-affecting DNS mutation
   has already succeeded — the tool just stops cleanly, sets the manifest
   status to `awaiting-manual-step`, and returns `requiresManualStep` with
   the exact instructions, both in `--json` output and on the manifest.

`--acceptance <path>`'s JSON now requires `apiCertificateName` alongside
`apiHostname`/`staticWebAppHostname`/`tempCertReady` — the exact
`--certificate-name` `certificate.sh --apply` uploaded, needed for
`bind-api-hostname`. `--rehearse` takes the equivalent
`--staging-api-certificate-name` flag.

Every step is verified before the next one runs, and the rollback manifest
is written to disk after each mutation (not just at the end) — including
when a step *fails to apply* (e.g. the managed AAAA record never clears),
not just when its post-mutation verification fails — so a crash mid-cutover
always leaves a resumable/rollback-able trail.

**Cloudflare client:** `--fixture <path>` uses a local JSON file standing
in for both Cloudflare zone state — DNS records, the Worker Custom Domain
binding, and the untouched Advanced Certificate — and Azure Static Web Apps
hostname-validation state; no network access. Omitting `--fixture` uses
`loadCloudflareClient`'s real-mode `ComposedRealClient`, which pairs three
independent real clients behind one facade so callers never special-case
which one handles a given method:

- `RealCloudflareClient` — Cloudflare DNS/Workers, authenticated from
  `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` read from the environment
  (never a CLI flag, never logged) — this has been verified read-only
  against the live `curationsdev` Cloudflare account (see "API
  assumptions" below).
- `RealAzureSwaHostnameClient` — the `validate-swa-*` steps, backed by the
  already-authenticated `az` CLI (`az staticwebapp hostname set
  --validation-method dns-txt-token --no-wait`, then `hostname show`
  polling for the returned `validationToken`). This needs no Cloudflare
  credential at all — it's a separate Azure resource concern — and feeds
  the `dns-txt-token` value (not a secret; it is *designed* to be
  published as a public DNS TXT record) directly into the exact same
  `upsertDnsRecord(txtRecordName, { type: "TXT", content: validationToken })`
  Cloudflare TXT-record path `--fixture` mode already exercises, without
  ever logging the token itself. Overridable via `YOLO_STATIC_WEB_APP`/
  `YOLO_RESOURCE_GROUP` env vars (matching `lib/config.sh`'s bash-side
  defaults: `stapp-yolo-prod`/`rg-yolo-prod`).
- `RealAzureGatewayClient` — the `verify-asuid-api` and `bind-api-hostname`
  steps, also backed by the `az` CLI. `getCustomDomainVerificationId()`
  runs `az containerapp show --query properties.customDomainVerificationId`
  (that one non-secret field only, via `--query` — never the full resource
  JSON); `bindApiHostname()` runs `az containerapp hostname bind --hostname
  <h> --certificate <name>`; `getApiHostnameBindingStatus()` runs
  `az containerapp hostname list` and reports `"Bound"` only for a matching
  hostname with a non-`"Disabled"` `bindingType`. Overridable via
  `YOLO_GATEWAY_APP`/`YOLO_RESOURCE_GROUP`/`YOLO_CONTAINERAPPS_ENV` env
  vars (matching `lib/config.sh`'s defaults: `ca-yolo-gateway`/
  `rg-yolo-prod`/`cae-yolo-prod`).

All the same safety gates (dry run default, `--apply` + exact `--confirm`,
one mutation at a time, verify-after-each, rollback manifest) apply
identically in real mode.

**Apply-mode preflight:** immediately after the `--apply --confirm
curations.dev` gate passes, and before the *first* mutation is attempted,
`runCutover` calls `client.preflight()`. On `RealCloudflareClient` this
independently checks (a) zone-scoped access by resolving the zone ID for
`curations.dev`, and (b) account-scoped access by listing Workers Custom
Domains for the account — reporting a specific, actionable error naming
which of the two failed. This deliberately does **not** call Cloudflare's
`GET /user/tokens/verify` endpoint: a token can be fully valid and
correctly scoped for both of the reads above yet still 401 on
`/user/tokens/verify` (observed live against the real
`CLOUDFLARE_API_TOKEN` in this environment — a known Cloudflare quirk, not
a broken token), so self-verify would produce a false negative. Dry runs
never call `preflight()`; `FixtureCloudflareClient.preflight()` is a
no-op success so fixture-driven tests stay hermetic.

`--rollback <manifest>` reverses `cut-api` precisely: delete the Azure
CNAME, reattach the Worker Custom Domain with
`PUT /accounts/{account_id}/workers/domains` (hostname/service/environment/
zone_id from the manifest — never a fabricated record with the old
content), then poll until Cloudflare has recreated the managed `AAAA`
record before declaring that step verified. Root/www CNAMEs are restored to
their original Pages target. SWA hostname-validation records are left in
place (harmless, reusable on a future re-cutover), and the Advanced
Certificate is never touched by rollback either.

Refuses immediately, before reading any Cloudflare state, if `--acceptance`
(Azure gateway/static hostnames + temp certificate readiness) is missing or
incomplete, unless `--rehearse` is used. Rollback manifests are written
under `${YOLO_CUTOVER_STATE_DIR:-~/.curationsx-yolo/cutover}` — outside git
by default.

## API assumptions requiring later verification

- `bootstrap.sh`'s GitHub environment branch-policy check/configure
  functions target `GET/PUT repos/:owner/:repo/environments/:name` (for
  `deployment_branch_policy.custom_branch_policies`) and
  `GET/POST/DELETE repos/:owner/:repo/environments/:name/deployment-branch-policies[/:id]`
  (for the branch pattern allow-list), per GitHub's published Environments
  API. Exercised only against the fixture `gh` stand-in in this task —
  re-verify field names and required scopes (`gh auth status` alone isn't a
  guarantee of the `repo`/environment-admin permissions the PUT/POST/DELETE
  calls need) against the real `curationsx/yolo` repository before relying
  on `--configure-github-environments` for real.
- `certificate.sh`'s Cloudflare-token path assumes `certbot-dns-cloudflare`
  accepts a credentials file containing `dns_cloudflare_api_token = ...`
  and a `--dns-cloudflare-credentials <path>` flag alongside
  `--config-dir`/`--work-dir`/`--logs-dir` (per its published
  documentation), and that the pinned `certbot==5.6.0`/`acme==5.6.0`/
  `certbot-dns-cloudflare==5.6.0` versions are current, compatible
  releases at install time — bump deliberately, not implicitly, once a
  newer pinned trio is verified. Also assumes `az containerapp env
  certificate upload` accepts `--certificate-name <name>` to pin the
  resulting resource's name and `--password <value>` for the PFX password
  (confirmed against the installed Azure CLI extension's live help), and
  that the password has no file-based alternative (an inherent interface
  limitation, not a choice made here). The install and certificate-issuance
  sequence has been exercised against real PyPI and Let's Encrypt; upload
  and verification remain covered by
  `test/fixtures/bin/pip`/`test/fixtures/bin/certbot` and the fixture
  `az` binary until the authorized Azure upload completes.
- `cutover.mjs`'s `set-default-domain` step assumes that, as of this
  writing, the Azure CLI has **no documented command** for marking a
  Static Web Apps custom domain as the default (the setting that makes
  other bound hostnames, including `www` and the generated
  `*.azurestaticapps.net` hostname, 301-redirect to it). Re-check the
  current `az staticwebapp` command reference before every cutover — if
  Azure has since shipped a CLI (or REST/Bicep) way to set this, automate
  it here instead of leaving it as a manual Portal gate.
- `cutover.mjs`'s real (non-fixture) Cloudflare client (`RealCloudflareClient`)
  targets the Cloudflare DNS records API (`GET/POST/PUT/DELETE
  /zones/:zone_id/dns_records[/:id]`, zone resolved via
  `GET /zones?name=...` and cached) and the Workers Custom Domains API
  (`GET/DELETE /accounts/:account_id/workers/domains[/:id]`,
  `PUT /accounts/:account_id/workers/domains` to reattach). **Read-only
  calls (`getDnsRecord`, `getWorkerCustomDomain`) were verified live**
  against the real `curationsdev` Cloudflare account for `curations.dev`,
  `www.curations.dev`, and `api.curations.dev` using the environment's
  `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` — the responses matched
  this tool's modeling exactly (apex/`www` proxied CNAMEs to
  `curations-dev.pages.dev`; `api.curations.dev` as a proxied `AAAA
  100::` record with a matching Worker Custom Domain binding). No write
  method (`upsertDnsRecord`, `deleteDnsRecord`, `removeWorkerCustomDomain`,
  `attachWorkerCustomDomain`) has been exercised against the live account —
  those remain unverified until an explicit, authorized production cutover.
  It also assumes the pre-existing Cloudflare Advanced Certificate for
  `api.curations.dev` is unaffected by detaching/reattaching the custom
  domain, and that AAAA add/remove timing is not necessarily instantaneous
  (hence the bounded polls in `cut-api` and rollback's `restore-api`) —
  neither of those has been exercised for real either.
- `cutover.mjs`'s `RealAzureSwaHostnameClient` targets `az staticwebapp
  hostname set --validation-method dns-txt-token --no-wait` and
  `az staticwebapp hostname show` (to poll status and read the returned
  `validationToken`), and assumes the TXT record name Azure expects is
  `_dnsauth.<hostname>` for both the apex and `www` (confirmed against
  Azure's Static Web Apps custom-domain documentation, but not against a
  live `az staticwebapp` resource in this task). `validationToken`'s exact
  format is also unconfirmed live — some Azure CLI/API versions have been
  observed to return the bare token value, others the full
  zone-file-style TXT line (e.g. `_dnsauth.host. IN TXT "token"`) —
  `extractSwaValidationTokenValue` defensively extracts just the value in
  the latter case, but this is unverified against a real resource. The
  `status` field's real value vocabulary (this tool only checks for the
  literal string `"Ready"`) is likewise assumed, not confirmed live.
  Re-verify all of the above once a real `stapp-yolo-prod` Static Web App
  resource exists.
- `cutover.mjs`'s `RealAzureGatewayClient` targets `az containerapp show
  --query properties.customDomainVerificationId`, `az containerapp
  hostname bind --hostname <h> --certificate <name>`, and
  `az containerapp hostname list`, and assumes the TXT record name Azure
  Container Apps expects is `asuid.<hostname>` (confirmed against Azure's
  Container Apps custom-domain documentation, but not against a live
  `ca-yolo-gateway` resource in this task). `hostname list`'s response
  shape (`[{name, bindingType, ...}]`, with `bindingType` something other
  than `"Disabled"` once bound) and `hostname bind`'s exact required flag
  set are likewise assumed from Azure CLI's published reference, not
  confirmed live. `bindApiHostname` requires the exact `--certificate-name`
  `certificate.sh --apply` uploaded (plumbed through the acceptance file's
  new `apiCertificateName` field, or `--staging-api-certificate-name` for
  `--rehearse`) — the two scripts' coordination on this exact string is
  unverified end-to-end against a live Azure account. Re-verify all of the
  above once `ca-yolo-gateway` and a real uploaded certificate exist.
- `reconcile-scores.mjs`'s real Cosmos mode assumes `@azure/cosmos`'s
  `CosmosClient` accepts an `aadCredentials` option backed by a
  `TokenCredential` from `@azure/identity` (either
  `ManagedIdentityCredential` or `DefaultAzureCredential`, per
  `resolveAzureCredential`'s `AZURE_CLIENT_ID` selection — see the
  `reconcile-scores.mjs` section above). `resolveAzureCredential` itself
  is unit-tested against both fake and the real `@azure/identity`
  constructors (proving the call shape — a single client-id string, or no
  args — is accepted), but the end-to-end result (that
  `ManagedIdentityCredential` actually authenticates successfully as
  `caj-yolo-ops`'s user-assigned identity against a live Cosmos account)
  is **not** exercised in this task; re-verify once `caj-yolo-ops` and its
  managed identity binding exist for real. The container field
  schema itself is **confirmed** (not assumed) against the actual
  persisted shapes in `agent-worker/src/community.ts` (`VoteDoc`,
  `ScoreDoc`), `agent-worker/src/vote-guard.ts`, and
  `agent-worker/src/platform/azure/community.ts`: the `votes` container's
  real fields are `id`/`target_id`/`user_id`/`created_at` (plus optional
  `doc_type: "vote"`; legacy Cloudflare-Worker-written vote docs have no
  `doc_type` at all — a vote document's mere existence is the vote, there
  is no downvote/`direction` concept in this schema); the same-partition
  Azure score metadata document (backfill/post-cutover mirror) is
  `id`/`doc_type: "score"`/`target_id`/`count`/`updated_at`, partitioned by
  `target_id`; and the separate legacy `scores` container's (pre-rollback
  mirror) real fields are `id`/`scope: "global"`/`target_id`/`count`/
  `updated_at`, partitioned on `scope`. `target`/`viewerId`/`direction` are
  this tool's own internal, in-memory diff-computation names
  (`computeReconciliation`'s parameter shape) — they are translated to/from
  the real field names at the query/upsert boundary and never appear in a
  persisted document. An earlier revision of the pre-rollback write-back
  path incorrectly persisted `{id, target, count}` instead of `{id, scope:
  "global", target_id, count, updated_at}`, which would have broken the
  container's partition-key routing and made repeat reconciliation runs
  unable to read their own prior writes back correctly — this has been
  corrected to match the confirmed real shape exactly, and an earlier
  revision conflated the two distinct mirrors entirely (there was no
  `--mode` selector and no same-partition Azure score metadata read/write
  path at all) — this has also been corrected: `--mode` is now required
  and selects the correct mirror explicitly.
  `runCosmosMode`'s query/diff/write logic is factored into five exported
  functions — `fetchVotesFromContainer`,
  `fetchAzureScoreMetadataFromContainer`, `writeAzureScoreMetadata`,
  `fetchLegacyScoresFromContainer`, `writeLegacyScores` (composed by
  `reconcileFromContainers`) — specifically so
  `scripts/azure/test/reconcile-scores.test.mjs` can exercise this exact
  query text (including the
  `NOT IS_DEFINED(c.doc_type) OR c.doc_type = 'vote'` legacy-absorption
  predicate) and both exact write-back shapes against lightweight fake
  containers (`test/helpers/fake-cosmos-container.mjs`) that seed a true
  legacy-shaped vote doc with no `doc_type` field at all and prove it is
  absorbed in all three modes — without installing
  `@azure/cosmos`/`@azure/identity` or reaching a live account. Still
  unexercised against a **live** Cosmos account; re-verify once
  `@azure/cosmos` is installed and a real account exists.
- `reconcile-scores.mjs`'s post-cutover wait gate assumes Cloudflare's
  proxied DNS TTL for `api.curations.dev` remains `300` seconds
  (`CLOUDFLARE_DNS_TTL_SECONDS`); re-check the live Cloudflare DNS record's
  TTL before relying on the default `--min-wait-seconds` (`600`).
- `bootstrap.sh`'s quota check reads a usage entry named `"Consumption
  Cores"` (falling back to `"Cores"`) from
  `az containerapp env list-usages`; confirm the exact `name.value` string
  Azure returns once a real Container Apps environment exists.
- `bootstrap.sh`'s `apply_bootstrap` passes `budgetContactEmails` to
  `az deployment sub create` as `--parameters budgetContactEmails=<json-array>`
  (a JSON-array-shaped string built by `jq`, e.g. `["a@b.com"]`), which is
  the standard Azure CLI convention for overriding an `array`-typed Bicep
  parameter inline — confirmed against Azure CLI's documented `--parameters`
  behavior but not exercised against a real `az deployment sub create`
  call in this task (only the fixture `az` binary, which just records the
  literal argument). Re-verify once a real Owner bootstrap run is
  authorized.
- `deploy.sh` publishes via `npx --yes @azure/static-web-apps-cli@2.0.9`
  (pinned) with a deployment token, hardcoding the SWA CLI's own `--env` to
  `production` regardless of this script's `--environment` GitHub
  Environment label (see the `deploy.sh` section above for the full
  rationale). `npx --yes` fetching/caching this pinned version on first use
  in CI is a reasonable, standard assumption but has not been exercised
  against a real GitHub Actions runner in this task; confirm the runner has
  network access to the npm registry (or a private mirror/proxy) and that
  this matches whatever `.github/workflows/azure-deploy.yml` ultimately
  uses.
- `deploy.sh --verify-gateway`'s `trigger_gateway_verification()` assumes
  `az containerapp job start --name caj-yolo-ops ...` returns an object
  with `.name` (the execution name to poll) and that
  `az containerapp job execution show` exposes completion state at
  `.properties.status` with values including `Succeeded`/`Failed`. Neither
  has been exercised against a real Container Apps Job in this task (only
  the fixture `az` binary) — confirm exact field names once `caj-yolo-ops`
  exists for real, and adjust the `jq`-style field extraction if Azure's
  actual schema differs.
- `cutover.mjs`'s `RealCloudflareClient.preflight()` assumes
  `GET /zones?name=<zone>` and `GET /accounts/:account_id/workers/domains`
  are sufficient, minimal, side-effect-free probes for confirming a
  token's real zone- and account-level access respectively, and
  deliberately avoids `GET /user/tokens/verify` (observed live to 401 for
  the environment's actual `CLOUDFLARE_API_TOKEN` even though both probe
  endpoints above succeed for it) — re-confirm this quirk hasn't changed
  before relying on `preflight()` as the sole apply-mode access gate.
