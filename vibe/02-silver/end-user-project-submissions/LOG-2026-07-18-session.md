---
status: log
category: brain-dumps
title: Session Log — Audit Orchestration decisions (verbatim curator response)
created: 2026-07-18
relates_to: audit-orchestration.md
---

# Session Log — 2026-07-18 (verbatim)

> Verbatim copy of the AI Curator response that locked in the three open questions.

---

Excellent — all three answers are architecturally sound, and each one actually *simplifies* the system rather than complicating it. Let me lock them in and sharpen the edges.

## 1. Re-runs: owner-triggered only ✅

Right call, and yes — that was my meaning: only the verified, SSO-authenticated PRD owner can trigger runs. Community members get *read + comment* rights on published findings, never *execute* rights. This gives you:

- **A hard token-abuse firewall**: compute only ever burns on an authenticated owner action, scoped to their own repo. No drive-by audit spam, no griefing vector where the community pings expensive runs against someone's project.
- **A natural rate-limit surface**: per-owner run quotas (e.g., N re-runs per artifact per month, tier-able later) become trivially enforceable because there's exactly one trigger identity.
- **Mix-and-match as engagement mechanic**: the capability matrix becomes the re-run UI itself. Run 1 was "everything I checked at intake." Run 3 might be "just Skills × Growth, because I refactored." Partial runs are cheaper for you *and* more intentional for them — the run-record simply marks which cells of the matrix were exercised, so deltas stay honest ("Hygiene unchanged since Run 1 — not re-audited").

One guard to write into the PRD: community comments can *suggest* a re-run ("this finding looks stale"), which surfaces as a nudge to the owner — social pressure without compute exposure. Engagement preserved, tokens protected.

## 2. Cohorts as time-slices, not user-clusters — this reframe matters

This answer quietly dissolved the consent problem, and I want to name why: in your model, **a cohort is a temporal snapshot of aggregate inquiry patterns, not a pool of shared repo data.** User A's repo never informs user B's suggestions directly. What travels between cohorts is:

- The *categorical inquiry buckets* (what were people asking about in Q3 2026 — skills gaps, CRM patterns, deploy targets)
- The *live-grounding delta* (what has the world learned since that snapshot)

So the consent disclosure at intake shrinks to one honest sentence: *"Your inquiry categories contribute to anonymized, time-stamped trend aggregates."* No repo contents, no code patterns, no cross-pollination of proprietary anything. That's a dramatically easier trust sell.

Structurally, what you've described is a **temporal knowledge ledger**:

- **Cohort A (Q3 2026)** = frozen inquiry snapshot. Immutable once closed. This is critical — you said "not lose track of the original inquiries," which means cohorts are *append-only archives*, never retroactively edited.
- **Cohort B, C... Z** = subsequent snapshots, each enriched by live ground-search at formation time.
- **The elongated conversation** = when an end-user re-runs in Q1 2027, the orchestrator walks the ledger: original inquiry (Cohort A) → every intervening snapshot → current live grounding (Cohort Z). The suggestion isn't "here's what's new," it's *"here's what's new relative to what you originally asked, with the full lineage of how the answer evolved."*

That lineage is the moonshot detail. Nobody else can say: "In Q3 2026 you asked about CRM skills. The best answer then was X. It became Y in Q1 2027 when [tech] shipped. Here's the diff, and here's why." That's not a recommendation engine — that's an *institutional memory* for the end-user's own project. And it composes perfectly with your immutable run-records: cohort ledger (macro, worldwide trends) × run-records (micro, this repo's journey) = the two axes of every suggestion.

Practical note: your instinct to also allow *event-bounded* cohorts (major tech release) alongside quarter-bounded ones is right — just make cohort boundaries a first-class, versioned config in `taxonomy/`, so a cohort is defined by `{open_date, close_date, trigger: calendar|event, event_ref}`. Cheap now, priceless in Cohort M.

## 3. Manual runs + open-core / private-moat — not selfish, standard

Manual-only runs are correct for the engagement thesis: **the re-run is the return visit.** Scheduled runs would optimize freshness at the cost of the habit loop, and the habit loop *is* the community. (Keep the passive nudge — "40 commits since last run" — as a notification, never an execution.)

On the "selfish, maybe" point — no. What you're describing is the **open-core model**, and it's how nearly every credible open-source-adjacent platform survives:

| Layer | Open (the repo) | Private (Azure) |
|---|---|---|
| **Contracts** | Run-record schemas, artifact definitions, capability-matrix format, taxonomy structure | — |
| **Interfaces** | How scripts compose, how cohorts are defined, the suggestion-plan format users execute via their own `gh`/Copilot | — |
| **Intelligence** | — | The cohort ledger itself, refined domain scripts, orchestrator weighting, trend-ingestion pipeline, run-record corpus |

The community gets full transparency on *how judgments are structured* — which is what trust requires. What stays private is the *accumulated learning* — which is what sustainability requires. Your own PLAYBOOK/MANIFESTO framing supports this: proof rails public, engine room private. And your point about the status quo is the actual justification: a commons where everyone links everything every-whichway with no continuity *is the failure mode you're fixing*. The private ledger isn't hoarding — it's the load-bearing wall that makes a public commons coherent.

## Where this leaves the PRD section

All three open questions are now closed:

1. **Triggers**: owner-only, matrix-scoped, quota-bounded; community suggests, never executes.
2. **Cohorts**: temporal, immutable, inquiry-level aggregates; lineage-walking at re-run; consent = one-line disclosure.
3. **Cadence**: manual with passive nudges; open-core split with contracts public, ledger private.

This section is genuinely ready to graduate **Bronze → Silver**.
