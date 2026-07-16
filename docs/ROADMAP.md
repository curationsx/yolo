# Roadmap

Now / Next / Later. No dates, no promises — direction, honestly stated. Items
move only when someone does the work.

The governing delivery order is the
[Project Evidence Registry PRD](PRD-project-evidence-registry.md). Feature PRDs
remain implementation references and may not reorder its trust gates.

## Now

- Governing Project Evidence Registry product contract.
- Published Astro Board surface on Azure Static Web Apps at `curations.dev`.
- Azure Container Apps gateway, Cosmos DB persistence, GitHub identity, and
  bounded Azure AI Foundry integration.
- Curated software directory with neutral records and a Git-backed submission
  path.
- Existing public-repository check for six tool families, currently embedded in
  per-tool discussions rather than a first-class Project.
- Versioned Cookbooks with **Use My Copilot** and **Run in My Terminal**. No
  silent CURATIONS-funded fallback.
- Prompt and workflow libraries, taxonomy, schemas, offline CLI, quality model,
  and contribution guide.
- Local `foundry-sim` emulator for deterministic, zero-cost fixture testing.

## Next — Phase 0 trust gate

- Make public agent invocation explicit and default-off.
- Replace generic "verified" presentation with declaration, observation,
  consent, review, and freshness language.
- Enforce repository-owner match for existing public-PRD submissions.
- Surface or reject fork, archived, stale, unavailable, and revoked states.
- Add builder revocation and maintainer moderation paths.
- Rename the two distinct actions: **Propose a tool** and **Submit your Project**.
- Make Project evidence methodology public and inspectable.
- Retire or hard-gate the legacy Cloudflare production deployment lane after the
  completed Azure domain cutover.
- Complete Phase 0 before opening Project submissions.

## Next — Phase 1 thin pilot

- Add first-class Project, Snapshot, and ToolClaim records.
- Add `/projects/`, `/projects/{owner}/{repo}/`, and `/submit/project/`.
- Pin PRD and evidence reads to one repository commit.
- Pilot with five invited builders, personal public repositories, and
  Cloudflare/Supabase evidence rules.
- Require an exact public-page preview, explicit consent, and manual review.
- Test the falsification criteria in the governing PRD before expansion.

## Later — earned after the pilot

- Refresh history, organization/collaborator consent, additional evidence rules,
  and separate declared/observed aggregate counts.
- Human comments and peer review only after moderation controls exist.
- Project-scoped Bookbags containing exact, reviewed, version-pinned Cookbook
  references.
- Optional catalog-grounded persona recommendations that users explicitly save
  or run.
- Profiles, human-mediated mentoring, build attestations, and broader Project
  collections after each prior boundary is proven.
- CURATIONS Credits only as a separately approved hosted-execution product.
- Opt-in public-repository discovery only through a separate future PRD.

## What we will not do

- Source or crawl repositories their builders did not submit.
- Claim that a PRD or configuration file proves real-world production use.
- Rank tools or projects as "best" from counts or votes.
- Auto-install, auto-update, auto-activate, or auto-run external skills.
- Spend CURATIONS model credits for a user who selected **Use My Copilot** or
  **Run in My Terminal**.
- Collect product analytics or behavioral profiles. Necessary security,
  rate-limit, reliability, and cost logs must be content-minimized, documented,
  and retained only as long as needed.
- Treat available AI capacity as permission for invisible or unbounded use.
