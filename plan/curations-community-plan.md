# CURATIONS.DEV Community Product Plan

**Status:** Working plan for draft PR #12  
**Purpose:** Sequence the conversation-first community product before backend
expansion  
**Product principle:** Evidence is the trust layer, not the product headline

**Current checkpoint (2026-07-16):** The discovery shell is live as an
illustrative fixture preview. Gate 1 is drafted in PR #12; the remaining Gate 2
proof is the builder onboarding, private Project Review, public preview, and
minimal profile journey.

**Related expansion plans:**

- [`member-profiles-and-prd-showcase.md`](member-profiles-and-prd-showcase.md)
  defines Curations-native profiles, settings, Inbox, standalone public PRD
  Showcases, Copilot CLI purpose breakdowns, and opt-in Rubber Duck Roast.
- [`skills-and-prd-capability-graph.md`](skills-and-prd-capability-graph.md)
  defines the reviewed Skills master, explicit PRD matching, member actions,
  public sourcing and claim, anchored threads, and Startup Toolkit.

## Product direction

CURATIONS.DEV should connect four surfaces:

1. **Community Board** — active Project questions and feedback.
2. **Project Review** — working plan, stack map, gaps, and revisions.
3. **Community Library** — matched prompts, workflows, skills, and Cookbooks.
4. **Member Profile** — Projects, Stack, Feedback, and Library contributions.

The core loop is:

```text
Share a project and working plan
        ↓
GitHub maps the selected public repository and stack
        ↓
The project enters a conversation-first community board
        ↓
People + clearly marked AI guides provide feedback
        ↓
Relevant public skills, prompts, workflows, and Cookbooks are matched
        ↓
The builder chooses what to run with their own Copilot/CLI/terminal
        ↓
A stronger project plan and next version return to the community
```

## Gate 1 — Rewrite PR #12 as the product contract

Keep PR #12 documentation-only and draft.

1. Add a new authoritative `PRD-curations-community.md`.
2. Recast the Project Evidence Registry PRD as the subordinate GitHub intake and
   trust layer.
3. Define the four connected product surfaces.
4. Establish both onboarding paths:
   - **I have a working plan**
   - **Help me create one from my project**
5. Include the conversation-first homepage, plain-language copy, early profiles,
   permission lanes, and terminal deep links.
6. Explicitly reject covert telemetry, `.env` reading, automatic skill
   promotion, sentiment profiling, and unsolicited repository analysis.
7. Record which supplemental ideas were adopted, deferred, or rejected.

PR #12 must not merge until the rewritten product contract receives human
approval.

## Gate 2 — Prove the experience visually

Build a fixture-only homepage and Project thread using the existing Lobsters
Board.

Do not add a database, change OAuth behavior, or make an AI call during this
gate.

The visual proof includes:

- active conversation rows anchored to Projects;
- `Active`, `New`, `Needs Feedback`, and `Recently Improved` views;
- Project-type, stage, and stack tags;
- a Community Pulse rail;
- beginner-friendly "What is a project plan?" copy;
- a Project page with its plan, conversation, stack context, suggestions, and
  revision history;
- a minimal profile showing Projects, Stack, Feedback, and Library; and
- both submission paths.

The visual proof succeeds only if a newcomer can understand the product by
reading five rows without opening methodology documentation.

## Gate 3 — Build one thin end-to-end Project loop

Start with one maintainer-controlled personal public repository, then one invited
builder without publication, one approved public Project, and finally five
invited builders.

```text
GitHub sign-in
  → Choose owned public repository
  → Attach a plan OR create a draft from the repository
  → Confirm detected stack
  → Receive a private Project Review
  → Choose what becomes public
  → Publish a feedback request
  → Human and optional AI replies
  → Record accepted, adapted, or declined advice
  → Publish the next plan revision
```

The reverse-plan path inspects only allowlisted public material:

- README and selected documentation;
- dependency manifests;
- framework configuration;
- repository structure; and
- `.env.example` only when explicitly selected.

It never reads `.env`, credentials, terminal history, or unrelated files.

## Gate 4 — Add the terminal lane

Add a GitHub CLI extension or equivalent local handoff after the Project Review
schema is stable.

The terminal experience:

1. examines the current repository locally;
2. finds the stack and existing plan;
3. returns one useful gap within sixty seconds;
4. links directly to that Project's review; and
5. uploads or publishes nothing without explicit approval.

The web is the community. The terminal is the direct utility lane. Both consume
the same review contract.

## Gate 5 — Introduce skill matching

Begin with the existing Cookbooks and manually reviewed skills.

Every recommendation includes:

- exact source and version;
- license and attribution;
- supported stack versions;
- official documentation;
- last-reviewed date;
- known limitations; and
- public outcomes where available.

After using a recommendation, the builder may explicitly report:

- worked;
- worked after adaptation;
- did not fit; or
- deferred.

That consented outcome — not invisible telemetry — becomes the learning moat.

## Gate 6 — Add trends after real data exists

Do not fabricate an active community from seeded Projects.

Once enough genuine submissions exist, calculate transparent views such as:

- what people are building this week;
- stacks appearing in submitted Projects;
- topics needing feedback;
- skills frequently saved or successfully adapted; and
- Projects recently improved.

Every trend shows its timeframe and sample size. Popularity remains separate
from quality.

## Hard boundaries

Do not build during these gates:

- local background daemons;
- terminal interception;
- `.env` or secret collection;
- sentiment or proficiency scoring;
- automatic global skill promotion;
- enterprise compliance automation;
- reverse-engineering unsolicited popular repositories; or
- autonomous code changes from the community site.

## Immediate sequence

1. Rewrite PR #12 into the broader community contract.
2. Obtain human approval of that contract.
3. Build the fixture-only visual proof.
4. Validate newcomer comprehension before backend expansion.
5. Exercise one maintainer-controlled personal repository privately.
6. Observe one invited builder without publishing.
7. Publish one approved Project.
8. Expand to five invited builders.
9. Reuse the review contract for the terminal lane.
10. Add skill matching and trends only after real Project outcomes exist.
