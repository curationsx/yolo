# Roadmap

Now / Next / Later. No dates, no promises - direction, honestly stated. Items
move only when someone does the work.

The governing delivery order is the
[CURATIONS.DEV Vibe Coding Community PRD](PRD-curations-community.md). The
[Project Evidence Registry PRD](PRD-project-evidence-registry.md) governs its
subordinate GitHub intake and trust layer. Feature PRDs may not reorder either
contract.

## The explicit v0.1 cut-list
**v0.1 IS:** submit repo → get Tier A report (BYOC running in your Actions) → share a badge. That's it.
**v0.1 IS NOT (deferred ≥ v0.3):** Threads / conversation layer, Cohort ledger + lineage walking, KNOWS: tags + curator identity system, Watching mechanic / homepage pulses, gh-curations CLI extension, Paid tier.

## Now
- Establish the **single-player runnable v0.1 baseline**.
- Maintain the reusable BYOC hygiene audit (`.github/workflows/hygiene-audit-reusable.yml`) allowing non-maintainers to execute a Tier A hygiene audit against an immutable SHA on their own billing tab.
- Maintain exact schemas for deterministic run-records, findings, execution context, and evidence generation.

## Next - Visual proof
- Release a streamlined Astro homepage showing only real public run records. No mock profiles or artificial community density.
- Implement simple badging mechanisms (e.g. "Tier A: Silver") for builders to display on their READMEs.

## Later - Trust gate & Community
- Activate the Open-Core AI Curations (Tier B suggestions).
- Implement the cohort ledger, chronological thread capabilities, and taxonomy elements (KNOWS tags).
- Add human-replies-to-curator capabilities across the platform.

## What we will not do
- Source or crawl repositories their builders did not submit.
- Claim that a PRD or configuration file proves production use or quality.
- Rank Projects or tools as "best" from counts or votes.
- Read `.env`, secrets, terminal history, browser cookies, or unrelated files.
- Auto-install, auto-update, auto-activate, or auto-run external skills.
- Spend CURATIONS model credits for a user who selected **Use My Copilot** or **Run in My Terminal**.
- Collect covert product analytics or behavioral profiles.
- Treat available AI capacity as permission for invisible or unbounded use.
