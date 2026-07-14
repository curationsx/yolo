---
goal: Operationalize Claude Design's Board render as the visual oracle and safely ship the current YOLO Board work
version: 1.0
date_created: 2026-07-12
last_updated: 2026-07-12
owner: Wyatt Stephens and Frank
status: 'Planned'
tags: [design, visual-oracle, board, cookbooks, astro, cloudflare]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan resumes the uncommitted `feat/catalog-site` work in
`/Users/wyattstephens/yolo` from commit `a2c07fa`. It makes Claude Design's
Inspiration Board render the durable visual acceptance contract, verifies the
GitHub-authenticated community behavior, and lands the work through PR #5
without touching CurationsLA or simplifying the approved artifact.

## 1. Requirements & Constraints

- **REQ-001**: Treat these local Claude Design files as the canonical visual source:
  - `/Users/wyattstephens/Downloads/CurationsX Design System/ui_kits/inspiration-board/board-app.jsx`
  - `/Users/wyattstephens/Downloads/CurationsX Design System/ui_kits/inspiration-board/board-views.jsx`
  - `/Users/wyattstephens/Downloads/CurationsX Design System/ui_kits/inspiration-board/board-cookbooks.jsx`
  - `/Users/wyattstephens/Downloads/CurationsX Design System/tokens/*.css`
  - `/Users/wyattstephens/Downloads/CurationsX Design System/components/community/*.jsx`
- **REQ-002**: Claude Design's Lobste.rs-style Board render is the production visual acceptance contract, not loose inspiration.
- **REQ-003**: Preserve the complete artifact: dense stack rows, score rails, mono metadata, compact tabs, thread indentation, universal feed rail, agent disclosure, stack-tailored cookbooks, public repository proof, and GitHub identity.
- **REQ-004**: Cloud integration may add deployment reliability, observability, rollback, and authentication testing; it must not remove, collapse, hide, or simplify any approved UI surface.
- **REQ-005**: Preserve the current uncommitted implementation. Do not reset, stash, overwrite, or discard any tracked or untracked file.
- **REQ-006**: Public agents may discuss, critique, verify, and cite. They must never execute work inside an end user's repository or account.
- **REQ-007**: Copilot CLI handoff runs on the end user's account and billing. Do not expose `fable5max` or invent unsupported `--cookbook`, `--stack`, `--checkpoint`, `--budget`, or `--max-requests` CLI flags.
- **REQ-008**: Keep anonymous read access. Require GitHub identity only for durable public actions such as publishing, replying, and voting.
- **VIS-001**: Board display typography uses Inter; metadata and code use JetBrains Mono. Fraunces and Instrument Serif must not drive Board, stack-list, proof-rail, or cookbook hierarchy.
- **VIS-002**: Board surfaces use opaque white or paper fills, zero radius, `1px` hairline separators, `2px` primary borders, and hard offset shadows with zero blur.
- **VIS-003**: Coral identifies selected actions and disclosed agents. Blue identifies humans and public repository evidence. Lime is reserved for positive or selected states.
- **VIS-004**: Desktop reference viewport is `1280x800`, matching `_ds_manifest.json`. Mobile reference viewport is `390x844`.
- **VIS-005**: Editorial-scale hero treatments must not replace the compact Board hierarchy.
- **SEC-001**: GitHub OAuth remains `read:user`, state + PKCE, opaque CURATIONS session token, and discarded GitHub access token.
- **SEC-002**: Private repositories must never enter public repository proof or discussion payloads.
- **SEC-003**: One active vote is permitted per GitHub user and target. Durable Object reads and writes must remain chunked to Cloudflare's 128-key limit.
- **CON-001**: Do not modify `/Users/wyattstephens/los-angeles/**`.
- **CON-002**: Do not modify unrelated YOLO lanes, including `foundry-sim/**` and PR #4.
- **CON-003**: Do not perform destructive Cosmos, KV, Durable Object, GitHub, or Cloudflare operations.
- **CON-004**: Do not deploy to production before authenticated behavior, visual acceptance, and PR verification pass.
- **PAT-001**: Source control must become the deployment authority. Do not repeat manual production uploads from an uncommitted working tree.
- **PAT-002**: Final report must include commit SHA(s), files changed, PR #5 URL, Cloudflare preview URL, and production URL after rollout.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Make the Visual Oracle durable and prevent future editorial regression.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Record the starting state: branch `feat/catalog-site`, base commit `a2c07fa`, tracked diff, untracked files, and current Cloudflare production deployment. Store the record outside the repository in the active Copilot session folder. | | |
| TASK-002 | Copy the canonical Board JSX, token CSS, community components, Inspiration Board README, design manifest, and handoff brief byte-for-byte into `catalog-site/design-oracle/claude-board/`. Add `SHA256SUMS` so future agents can detect accidental edits. Exclude this reference directory from the Astro production bundle. | | |
| TASK-003 | Add the exact rule `"The epiphany, operationalized. Claude Design's Board render is the Visual Oracle and the production acceptance contract. Cloud integration may ADD reliability — it may not simplify the artifact."` to `catalog-site/AGENTS.md`. | | |
| TASK-004 | Rewrite `docs/PRD-catalog-surface.md` section 5 so `catalog-site/design-oracle/claude-board/` is the canonical visual source for Board, stack-list, proof, feed, and cookbook surfaces. Explicitly retire the current editorial-first language for those surfaces while retaining CURATIONS tokens. | | |
| TASK-005 | Add `catalog-site/design-oracle/claude-board/ACCEPTANCE.md` mapping each oracle region to its production route, component, required computed styles, and screenshot viewport. | | |

Completion criteria:

- The oracle is available inside the YOLO repository without changing its bytes.
- `catalog-site/AGENTS.md` and `docs/PRD-catalog-surface.md` name the Board render as canonical.
- No CurationsLA file is modified.

### Implementation Phase 2

- GOAL-002: Finish production visual parity without removing implemented behavior.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Update Board-scoped tokens in `catalog-site/src/styles/global.css`: Inter display, JetBrains Mono metadata, white/paper surfaces, `1px` separators, `2px` borders, zero-radius controls, and blur-free hard shadows. Do not globally force Board typography onto unrelated methodology or submission content. | | |
| TASK-007 | Refactor `catalog-site/src/pages/index.astro`, `catalog-site/src/components/SoftwareCard.astro`, and `catalog-site/src/components/SoftwareFilters.ts` from editorial card grids into the oracle's dense stack list: score rail, stack name, category, tags, description, thread count, wiki/discuss links, and a right-side universal feed rail. Preserve search, category, deployment, licensing, and voting behavior. | | |
| TASK-008 | Align `catalog-site/src/layouts/BaseLayout.astro` with `BoardHeader`: CURATIONSX wordmark, compact mono navigation, coral active underline, and GitHub sign-in control. Preserve canonical metadata and accessible navigation. | | |
| TASK-009 | Align `catalog-site/src/components/CompanyBoard.astro` and `catalog-site/src/components/CompanyBoard.ts` with the oracle's company board and thread hierarchy. Preserve public PRD proof, repository verification, sorting, filtering, replies, agent invitation, and vote behavior. | | |
| TASK-010 | Align `catalog-site/src/pages/cookbooks/index.astro` and `catalog-site/src/components/Cookbooks.ts` with `board-cookbooks.jsx`: compact category tabs, bordered cookbook cards, stack selector, dark code block, disclosed steward fit check, and hard-shadow handoff modal. Preserve the truthful standard Copilot CLI command already implemented. | | |
| TASK-011 | Align human and agent presentation with `AuthorBadge.jsx`, `ThreadComment.jsx`, and `UpvoteButton.jsx`: blue human identity, coral agent identity with explicit AI label, compact square vote control, and indented replies. | | |
| TASK-012 | Complete responsive CSS for `1280x800`, `1024x768`, `768x1024`, and `390x844`. On narrow screens, stack the feed rail below primary content without hiding it, preserve score rails, and keep controls at least 44 CSS pixels where interaction requires it. | | |

Completion criteria:

- Board surfaces contain no editorial-scale substitute for the oracle hierarchy.
- All oracle regions remain present at desktop and mobile sizes.
- Existing public proof, community, voting, cookbook, and handoff functionality remains reachable.

### Implementation Phase 3

- GOAL-003: Prove the unfinished authenticated behavior before committing or deploying.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | Exercise anonymous behavior: browse stacks, boards, proof rails, cookbooks, and generated handoff prompts without authentication. Confirm public mutation controls redirect to GitHub sign-in rather than silently failing. | | |
| TASK-014 | Exercise GitHub OAuth through `agent-worker/src/auth.ts` and `catalog-site/src/lib/browser-auth.ts`: state, PKCE, allowed return path, session creation, profile rendering, refresh behavior, and sign-out. | | |
| TASK-015 | Publish one temporary public discussion and one temporary public PRD/repository proof using a designated public test repository. Verify the stored author, GitHub profile link, tags, repository evidence, optional PRD URL, and disclosed persona reply. Remove or clearly label test content after verification. | | |
| TASK-016 | Verify a private repository is rejected before persistence and never appears in the public feed, proof rail, thread payload, or Cosmos query results. | | |
| TASK-017 | Verify voting for software cards, threads, comments, and public repositories: add, remove, duplicate request, refresh persistence, anonymous rejection, and same-user single-vote behavior. | | |
| TASK-018 | Exercise more than 128 vote keys against `agent-worker/src/vote-guard.ts` using deterministic local fixtures to prove chunked `get` and `put` behavior. | | |
| TASK-019 | Verify PRD fit checks remain private and unpersisted unless the visitor explicitly chooses publication while authenticated. | | |

Completion criteria:

- GitHub-authenticated publishing and voting work end-to-end.
- Private repository metadata cannot become public.
- Vote behavior remains correct above Cloudflare's 128-key operation limit.
- No unintended test content remains in production data.

### Implementation Phase 4

- GOAL-004: Turn the Visual Oracle into a repeatable production acceptance gate.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-020 | Start the Astro site and Worker locally with deterministic fixture responses for stack rows, universal feed, company threads, proof entries, cookbook states, and GitHub identity. Do not depend on changing production data for screenshots. | | |
| TASK-021 | Capture the oracle and production surfaces at `1280x800` and `390x844`: stack landing, company board, public proof rail, cookbook list, stack-tailored cookbook, GitHub SSO modal, and Copilot handoff modal. Use identical viewport, device scale factor `1`, font readiness, and crop bounds. | | |
| TASK-022 | Add computed-style assertions for Board regions: Inter display, JetBrains Mono metadata, radius `0px`, no blurred shadows, expected coral/blue disclosure colors, `1px` separators, and `2px` primary borders. | | |
| TASK-023 | Compare production screenshots against the vendored oracle. Reject any difference that removes a region, changes information hierarchy, increases editorial scale, hides metadata, collapses score rails, or weakens human/agent disclosure. | | |
| TASK-024 | Attach desktop and mobile before/after proofs to PR #5. Store working screenshots in the Copilot session folder; commit only stable approved baselines required for future regression checks. | | |

Completion criteria:

- Every acceptance-map row has a desktop and mobile proof.
- No oracle component or information layer is simplified.
- Visual proof is reviewable directly from PR #5.

### Implementation Phase 5

- GOAL-005: Create reviewable commits and update PR #5 without mixing unrelated concerns.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-025 | Commit gateway correctness separately: `fix(gateway): harden public proof and vote quotas`. Include `agent-worker/src/auth.ts`, `community.ts`, `cosmos.ts`, `repository-verification.ts`, `vote-guard.ts`, `quota.ts`, related `index.ts`, `azure.ts`, environment configuration, and tests or documentation required for that behavior. | | |
| TASK-026 | Commit community functionality separately: `feat(board): add GitHub-authenticated public proof and voting`. Include Board client components, browser auth, submission changes, schema changes, catalog data, and repository tooling. | | |
| TASK-027 | Commit cookbook functionality separately: `feat(cookbooks): add stack-tailored Copilot CLI handoff`. Include cookbook schema/data, static prompt endpoints, truthful command generation, page, and client behavior. | | |
| TASK-028 | Commit visual contract separately: `design(board): match Claude Design visual oracle`. Include vendored oracle references, AGENTS/PRD contract updates, Board-scoped CSS, layout, stack list, company board, cookbook presentation, and approved visual baselines. | | |
| TASK-029 | Commit deployment automation separately: `ci(cloudflare): deploy verified main builds`. Include `.github/workflows/catalog-site.yml`, `_headers`, deployment documentation, and smoke checks. | | |
| TASK-030 | Include `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` in every created commit. Push only `feat/catalog-site` and update existing PR #5; do not open a duplicate PR. | | |

Completion criteria:

- Each commit is internally coherent and reviewable.
- PR #5 shows the complete feature and visual proofs.
- No secret, generated local Worker state, `.env`, token, or credential is committed.

### Implementation Phase 6

- GOAL-006: Roll out through Cloudflare with source control as authority.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-031 | Run PR verification from `.github/workflows/catalog-site.yml`; require source doctor, deterministic catalog, Astro build, Worker typecheck, patch hygiene, functional checks, and visual proof artifacts to succeed. | | |
| TASK-032 | Deploy a non-production Cloudflare Pages branch preview for PR #5. Use the existing Worker only for read-only smoke checks unless a separate preview Worker environment is explicitly configured. | | |
| TASK-033 | Re-run anonymous, GitHub-authenticated, public PRD, repository proof, upvote, cookbook, and handoff checks against the preview URL. | | |
| TASK-034 | Merge PR #5 only after preview behavior and Visual Oracle acceptance pass. Let the `main` workflow deploy the Worker before Pages and execute production smoke checks. | | |
| TASK-035 | Verify `https://curations.dev`, `https://curations.dev/cookbooks/`, one stack board, GitHub sign-in, `https://api.curations.dev/api/health`, and the approved desktop/mobile visual captures. | | |
| TASK-036 | If production differs from the approved artifact or authenticated behavior fails, roll back to the previous Cloudflare Worker version and Pages deployment; do not simplify the UI as a hotfix. | | |

Completion criteria:

- Production is deployed from merged source, not a manual upload.
- `curations.dev` matches the approved Board artifact.
- Rollback remains available and documented.

## 3. Alternatives

- **ALT-001**: Continue styling from the current editorial-first PRD. Rejected because Wyatt explicitly made Claude Design's Inspiration Board the canonical source.
- **ALT-002**: Apply only color and font tokens while retaining the current layout. Rejected because the acceptance contract includes density, hierarchy, rows, rails, tabs, and interaction placement.
- **ALT-003**: Rebuild the Astro site in React to reuse the JSX literally. Rejected because the production stack is already functional in Astro and a framework rewrite adds risk without improving fidelity.
- **ALT-004**: Deploy the current uncommitted working tree directly to Cloudflare. Rejected because it repeats the current source/deployment drift and removes reviewable rollback.
- **ALT-005**: Remove repository proof, authenticated voting, or cookbook detail to make visual matching easier. Rejected because cloud and production work may not simplify the artifact.

## 4. Dependencies

- **DEP-001**: Local Claude Design package in `/Users/wyattstephens/Downloads/CurationsX Design System/`.
- **DEP-002**: Astro `^7.0.7` in `catalog-site/package.json`.
- **DEP-003**: Cloudflare Wrangler `^4.110.0`, KV, Durable Objects, and Pages.
- **DEP-004**: Azure OpenAI mini-tier persona gateway and Cosmos DB serverless feed store.
- **DEP-005**: GitHub OAuth application and `read:user` authorization flow.
- **DEP-006**: Inter, JetBrains Mono, Fraunces, and Fira Sans webfonts defined by the design system.
- **DEP-007**: Existing PR #5 at `https://github.com/curationsx/yolo/pull/5`.

## 5. Files

- **FILE-001**: `/Users/wyattstephens/Downloads/CurationsX Design System/ui_kits/inspiration-board/*` — external canonical Board render.
- **FILE-002**: `catalog-site/design-oracle/claude-board/**` — vendored immutable oracle and acceptance map.
- **FILE-003**: `catalog-site/AGENTS.md` — durable Visual Oracle rule.
- **FILE-004**: `docs/PRD-catalog-surface.md` — product and visual contract.
- **FILE-005**: `catalog-site/src/styles/global.css` — Board-scoped tokens and responsive presentation.
- **FILE-006**: `catalog-site/src/layouts/BaseLayout.astro` — Board header, navigation, and GitHub identity.
- **FILE-007**: `catalog-site/src/pages/index.astro` — dense stack landing surface.
- **FILE-008**: `catalog-site/src/components/SoftwareCard.astro` and `SoftwareFilters.ts` — stack rows, voting, and filters.
- **FILE-009**: `catalog-site/src/components/CompanyBoard.astro` and `CompanyBoard.ts` — threads, proof, replies, sorting, filtering, and votes.
- **FILE-010**: `catalog-site/src/pages/cookbooks/index.astro`, `components/Cookbooks.ts`, `lib/cookbooks.ts`, and `lib/cookbook-handoff.ts` — cookbook presentation and handoff.
- **FILE-011**: `catalog-site/src/lib/browser-auth.ts` and `components/AuthButton.astro` — GitHub identity UI.
- **FILE-012**: `agent-worker/src/auth.ts`, `community.ts`, `repository-verification.ts`, `vote-guard.ts`, `quota.ts`, `cosmos.ts`, `index.ts`, and `env.ts` — authenticated community backend.
- **FILE-013**: `cookbooks/**`, `schemas/cookbook-entry.schema.json`, `software/**`, `schemas/software-entry.schema.json`, `catalog.json`, and `tools/yolo.py` — source contracts.
- **FILE-014**: `.github/workflows/catalog-site.yml` and `catalog-site/public/_headers` — verified deployment automation.

## 6. Testing

- **TEST-001**: Run `python3 -m unittest discover -s tools/tests -p 'test_*.py'`.
- **TEST-002**: Run `python3 tools/yolo.py doctor`.
- **TEST-003**: Run `python3 tools/yolo.py catalog` followed by `git diff --exit-code -- catalog.json`.
- **TEST-004**: Run `npm --prefix catalog-site ci` and `npm --prefix catalog-site run build`.
- **TEST-005**: Run `npm --prefix agent-worker ci` and `npm --prefix agent-worker run check`.
- **TEST-006**: Run `cd agent-worker && npx wrangler deploy --dry-run`.
- **TEST-007**: Run `git diff --check` and a secret scan covering `.env`, bearer tokens, OAuth secrets, Azure keys, Cloudflare tokens, and GitHub tokens.
- **TEST-008**: Execute anonymous and authenticated browser matrices for stack browsing, Board reading, publishing, replies, voting, repository proof, cookbook tailoring, and CLI handoff.
- **TEST-009**: Execute private-repository rejection and more-than-128-vote-key regression cases.
- **TEST-010**: Capture and compare Board surfaces at `1280x800` and `390x844` against the vendored oracle and computed-style assertions.
- **TEST-011**: Run Cloudflare preview and production smoke checks for site, cookbook route, stack board, OAuth, and Worker health.

## 7. Risks & Assumptions

- **RISK-001**: The worktree contains a large mixed tracked/untracked change set. Mitigation: no reset or stash; preserve state before edits and split commits by coherent file ownership.
- **RISK-002**: The canonical design currently exists only in Downloads. Mitigation: vendor a byte-identical reference and checksums before further styling.
- **RISK-003**: Dynamic community data makes pixel comparisons unstable. Mitigation: use deterministic local fixtures and computed-style assertions for visual proof.
- **RISK-004**: OAuth callback constraints may prevent full authentication on an arbitrary preview hostname. Mitigation: use an approved preview callback or controlled production-domain test only after non-authenticated preview checks pass.
- **RISK-005**: Cloudflare Pages may serve code that differs from PR #5. Mitigation: make the main-branch workflow authoritative and verify deployed commit metadata.
- **RISK-006**: Large visual edits may accidentally remove functional controls. Mitigation: require the full anonymous/authenticated matrix after every visual pass.
- **ASSUMPTION-001**: The current uncommitted work is the checkpoint described in the prior session: code gates green, desktop/mobile proofs captured, nothing committed, pushed, migrated, or deployed.
- **ASSUMPTION-002**: PR #5 remains the correct delivery vehicle for the catalog, Board, cookbooks, agent gateway, and deployment automation.
- **ASSUMPTION-003**: The visual oracle governs presentation; truthful production behavior may correct mocked text or unsupported CLI syntax without changing the approved visual hierarchy.

## 8. Related Specifications / Further Reading

- [YOLO PR #5](https://github.com/curationsx/yolo/pull/5)
- [Claude Design Inspiration Board README](../catalog-site/design-oracle/claude-board/ui_kits/inspiration-board/README.md)
- [Catalog Surface PRD](../docs/PRD-catalog-surface.md)
- [Astro documentation](https://docs.astro.build/)
- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- [GitHub OAuth documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
