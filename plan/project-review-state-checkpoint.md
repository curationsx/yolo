# Project Review State Overnight Checkpoint

**Date:** 2026-07-17
**Branch:** `frank/project-review-state`
**Parent:** draft PR #21 (`frank/thin-project-pending`)
**Status:** Work in progress; do not merge or deploy

## Implemented

- Maintainer GitHub numeric-ID allowlist across Cloudflare, Azure, and Bicep.
- Maintainer-only pending review queue.
- Approve, return, reject, hide, and restore transitions with reason, actor, time,
  request ID, and audit history.
- Approval copy explicitly states that publication is not endorsement.
- Point-readable Project route index rather than anonymous cross-partition public
  lookups.
- Public reads only for visible `published` or `stale` Projects.
- Public projection excludes request IDs, moderation history, and internal
  partition fields.
- Public response uses `no-store` so hide or revoke takes effect immediately.
- Builder or maintainer revoke with an audit event and immediate public removal.
- Builder-safe revoke responses do not expose maintainer review history.
- ETag-conditional replacement for review, revoke, and returned-draft
  resubmission so stale approval cannot overwrite revoked consent.
- Same-request resubmission is non-mutating; a returned Project requires a new
  preview and request ID.
- Cross-platform conditional replace support in Cloudflare Cosmos REST and Azure
  Cosmos SDK adapters.

## Verified

- Worker TypeScript check passes.
- Focused Project review-state tests: 5 passed, 0 failed.
- Diff hygiene passes.

## Resume work

1. Add explicit race tests for approve versus revoke and competing review events.
2. Add Cloudflare REST and Azure SDK conditional-replace adapter tests.
3. Add returned-draft fresh-preview resubmission test.
4. Run the full Worker suite and coverage.
5. Run Wrangler dry-run with container rollout disabled.
6. Run independent specification and defect reviews again after the CAS changes.
7. Resolve any findings, then update this draft PR.

## Boundaries

- No production deployment.
- No automatic merge.
- No model call.
- No provider-token persistence.
- No refresh or stale-transition implementation yet.
- Parent pending-intake PR #21 must land before this slice.

