# PRD - CURATIONS.DEV Vibe Coding Community

**Status:** Draft governing contract for human approval
**Owner:** CURATIONSX
**Approved direction:** 2026-07-16
**Canonical product:** `https://curations.dev`
**Source repository:** `curationsx/yolo`

## 0. Authority

On merge, this document is the governing product contract for CURATIONS.DEV. It
controls product purpose, the canonical social object, public information
architecture, onboarding, permission boundaries, and delivery order.

| Document | Relationship to this PRD |
| --- | --- |
| [`PRD-project-evidence-registry.md`](PRD-project-evidence-registry.md) | Subordinate GitHub intake and trust-layer contract. It defines consent, deterministic observations, evidence language, snapshots, review, freshness, and revocation. |
| [`../plan/community-discovery-architecture.md`](../plan/community-discovery-architecture.md) | Approved detailed discovery, taxonomy, linking, sorting, voting, and following contract. |
| [`../plan/curations-community-plan.md`](../plan/curations-community-plan.md) | Working delivery plan. It may clarify sequencing but may not override this contract. |
| [`PRD-catalog-surface.md`](PRD-catalog-surface.md) | Current directory, Board, identity, persona, and Cookbook implementation reference. |
| [`PRD-community-discussion-board.md`](PRD-community-discussion-board.md) | Optional GitHub Discussions surface. It is not the canonical Project community or data store. |
| [`PRD-aot-agent-protocol.md`](PRD-aot-agent-protocol.md) | Subordinate permission and disclosure contract for explicitly requested AI participation. |
| [`PRD-azure-foundry-integration.md`](PRD-azure-foundry-integration.md) | Subordinate model-hosting and spend-control contract. Foundry capacity is not permission to invoke AI. |

The copied Claude Design Board remains the Visual Oracle for density, hierarchy,
typography, identity color, and interaction structure. Historical names and mock
copy in that package are not product requirements.

## 1. Product contract

> CURATIONS.DEV is a conversation-first Vibe Coding community where a builder
> shares a public GitHub Project and working plan, asks a human question, receives
> human and explicitly requested AI guidance, chooses what to use, and returns
> with a stronger plan or Project revision.

The Project is the durable center. A human feedback question is the social front
door. Evidence is the trust layer. AI is a disclosed helper. The builder remains
the decision-maker and executes with tools and billing they control.

CURATIONS.DEV is not primarily a software directory, evidence dashboard, prompt
marketplace, hosted coding agent, or popularity chart. Those capabilities support
the community improvement loop; they do not replace it.

## 2. Problem and product moat

Builders currently spread the useful parts of a Vibe Coding Project across
separate places:

1. a public repository contains the implementation;
2. a PRD or working plan contains intent and decisions;
3. a chat contains suggestions that often disappear;
4. a software directory explains tools without Project context;
5. a community thread offers feedback without a versioned outcome; and
6. skills, prompts, and workflows are difficult to judge for fit.

The unoccupied connection is:

```text
public Project + versioned working plan + human question
        -> human and disclosed AI feedback
        -> matched, source-linked artifacts
        -> builder-owned execution
        -> accepted, adapted, declined, or deferred outcome
        -> stronger plan or Project revision
```

The moat is not hidden telemetry or generic AI access. It is a public,
inspectable improvement history connecting intent, context, advice, human
decisions, and Project revisions.

## 3. Audiences and jobs

### 3.1 Builders sharing work

> "Help me explain what I am building, ask a useful question, and improve my
> working plan without taking control of my repository."

They need clear onboarding, a private review before publication, exact public
previews, human feedback, optional AI guidance, and control over every revision.

### 3.2 Builders researching approaches

> "Show me how other Projects approached a similar problem, which stacks appear
> together, and what advice proved useful."

They need conversation-first discovery, public repositories and plans, precise
evidence language, source-linked resources, and transparent sorting.

### 3.3 Contributors

> "Let me offer useful feedback or a reviewed artifact without pretending my
> suggestion was adopted."

They need scoped conversations, visible context, attribution, and explicit
outcomes recorded only by the Project owner.

### 3.4 Maintainers

> "Let me protect public claims and community safety without making product
> decisions for builders."

They need moderation, evidence review, rate limits, disclosure, rollback, and
clear separation between approval to publish and endorsement of a Project.

## 4. Core objects

| Object | Contract |
| --- | --- |
| **Project** | Durable identity anchored to one canonical public GitHub repository and its builder-controlled summary. |
| **WorkingPlanRevision** | A commit-pinned plan supplied by the builder or a private draft created from explicitly allowlisted public repository material. |
| **ProjectConversation** | A human-authored feedback question anchored to one Project and plan revision. This is the canonical social object. |
| **ProjectReview** | Private, builder-controlled view of plan gaps, stack context, evidence boundaries, and optional suggestions before anything becomes public. |
| **EvidenceSnapshot** | Dated, deterministic observations and builder declarations defined by the Project Evidence Registry PRD. |
| **Artifact** | A source-linked review, skill, prompt, workflow, or Cookbook with version, license, provenance, and limitations. |
| **RecommendationOutcome** | Builder-recorded result: accepted, adapted, declined, or deferred. |
| **MemberProfile** | A read model of Projects, public feedback, Stack context, and Library contributions. It is not a behavioral profile. |

### 4.1 Canonical social object

A `ProjectConversation` leads with a human question such as:

> "How should I structure permissions for this community CRM?"

It must include:

- one Project;
- one human author;
- one current working-plan revision;
- a plain-English Project description;
- Project stage and relevant Stack context;
- the kind of feedback requested;
- open, resolved, or recently improved state; and
- visibly separate human and AI participation.

The question links to the internal conversation and working-plan page. The
Project name links in the Board's red link color to the canonical public GitHub
repository. A letter-stamped Stack pill links to its Stack landing page.

Projects are not upvoted as generic objects. Conversations may be upvoted for
visibility. Project improvement is represented by revisions and recorded
outcomes, not by a popularity score.

## 5. Product surfaces and core loop

CURATIONS.DEV connects four surfaces:

1. **Community Board** - active Project questions and feedback.
2. **Project Review** - working plan, Stack map, gaps, evidence boundaries, and
   revisions.
3. **Community Library** - source-linked reviews, skills, prompts, workflows, and
   Cookbooks.
4. **Member Profile** - Projects, public feedback, Stack context, and Library
   contributions.

```text
Share a public Project and working plan
        |
GitHub maps the builder-selected repository and Stack
        |
Private Project Review separates facts, gaps, and suggestions
        |
Builder writes and previews a human feedback question
        |
Project enters the conversation-first Community Board
        |
People and explicitly requested AI guides provide feedback
        |
Relevant reviewed artifacts are matched
        |
Builder chooses what to run with their own tools
        |
Outcome and stronger plan revision return to the Project
```

The first pilot may expose only a minimal Member Profile read model. Profiles,
following, reputation, and mentoring must not delay proof of the Project loop.

## 6. Onboarding and permission lanes

The entry screen presents two clear paths:

1. **I have a working plan**
2. **Help me create one from my Project**

Both paths converge on the same private Project Review and public-preview
contract. The existing-plan path is implemented first because it proves the
community loop without requiring generated planning.

### 6.1 Existing-plan path

```text
GitHub sign-in
  -> choose an owned public repository
  -> select a Markdown working-plan path
  -> write a Project summary and human feedback question
  -> confirm Stack context
  -> receive a private Project Review
  -> choose exactly what may become public
  -> preview the public Project and conversation
  -> explicitly consent
  -> enter pending maintainer review
```

### 6.2 Reverse-plan path

The builder selects the public material Curations may inspect:

- README and selected documentation;
- dependency manifests;
- framework configuration;
- repository structure; and
- `.env.example` only when explicitly selected.

The path never reads `.env`, credentials, terminal history, private repository
content, or unrelated files. Its output is a private draft for the builder to
edit. Generated text is never treated as the builder's declaration until the
builder explicitly adopts it.

### 6.3 Shared permission contract

- Anonymous visitors may read published Projects and conversations.
- GitHub identity is required for durable public actions.
- Normal sign-in requests minimal identity, reads the profile once, and discards
  the provider token.
- The pilot supports personal public repositories whose owner login matches the
  authenticated login.
- Curations never requests repository write access.
- Selecting a repository or plan does not invite an AI guide.
- Preview does not publish. Consent is bound to the exact preview.
- New Projects enter `pending`; maintainer approval publishes but does not endorse
  the Project.
- Builders can revoke their public Project without operator intervention.

## 7. Private review and public Project hierarchy

### 7.1 Private Project Review

The private review separates:

1. what the builder says;
2. what deterministic rules observed;
3. what remains unknown;
4. gaps or decisions in the working plan;
5. optional human or disclosed AI suggestions;
6. matched reviewed artifacts; and
7. the exact proposed public page.

No suggestion may silently rewrite the working plan, feedback question, declared
Stack, or public summary.

### 7.2 Public Project

The public Project page presents:

1. human feedback question and conversation state;
2. red Project-name backlink to the canonical public GitHub repository;
3. builder-approved plain-English description;
4. stage, Project type, attributes, and linked Stack pills;
5. current public working-plan revision and source;
6. human conversation;
7. declaration and observation evidence, visibly separated;
8. accepted, adapted, declined, or deferred outcomes;
9. revision history; and
10. optional AI guidance in a coral, explicitly labeled block.

The page must never imply that a PRD, dependency, configuration file, maintainer
approval, or AI response proves production use, quality, effectiveness, or
endorsement.

## 8. Conversation-first discovery

The homepage contains one conversation-feed region:

```text
[Active] [New] [Needs Feedback] [Recently Improved]
```

`Active` is server-rendered by default. Each other tab replaces the same region,
uses a linkable URL state, and remains usable without client JavaScript.

The Community Pulse opens three paths:

- **What People Are Building** -> `/projects/`
- **Stacks Showing Up** -> `/stacks/`
- **Useful This Week** -> `/library/`

Project type, attribute, stage, tool, and Stack combination remain separate axes.
Conversations and useful artifacts may receive upvotes. Project categories,
tools, and Stack combinations use Follow. Every aggregate states its timeframe
and sample size.

The detailed route, taxonomy, sorting, linking, and action contract lives in
`plan/community-discovery-architecture.md`.

## 9. Evidence trust layer

The Project Evidence Registry PRD controls:

- repository-owner match and builder consent;
- allowlisted GitHub reads;
- commit-pinned plan and evidence paths;
- deterministic, versioned observation rules;
- declaration versus observation language;
- snapshots, freshness, unavailable and stale states;
- maintainer evidence review; and
- builder revocation.

Evidence supports trust in the Project context. It does not decide which
conversation deserves attention, whether advice is good, whether a Project
improved, or whether a tool is effective.

## 10. Human, AI, and execution boundaries

- Humans own Projects, questions, declarations, decisions, and outcomes.
- AI participation is explicit, default-off, disclosed, scoped, and separately
  revocable.
- AI may summarize, question, cite, critique, or suggest. It cannot establish
  evidence, moderate people, approve publication, accept advice, or modify an
  end-user repository.
- Project preview, deterministic evidence, and public rendering make no model
  call.
- **Use My Copilot** uses a separate, explicit, single-use authorization and the
  authenticated user's Copilot plan.
- **Run in My Terminal** copies a versioned handoff for the builder to run locally.
- Neither execution lane silently falls back to Azure or CURATIONS-funded models.
- Azure AI Foundry is an optional bounded guidance lane, not an automatic product
  dependency or execution subsidy.

## 11. Pilot and smallest proof

### 11.1 Current state

The live site contains an approved, fixture-driven conversation-first discovery
preview. Fixture activity is illustrative, fixture detail routes are noindex,
and no active community or outcome volume is implied.

The discovery shell is visually proven. The remaining visual proof is the
builder journey: both onboarding choices, private Project Review, editable
feedback request, exact public preview, consent, and minimal profile context.

### 11.2 Pilot sequence

1. Complete the fixture-only builder journey with no database or model call.
2. Exercise one maintainer-controlled personal public repository privately.
3. Invite one builder and observe the full flow without publishing.
4. Publish one approved Project and feedback request.
5. Expand to five invited builders.
6. Review the falsification criteria before adding broader social features.

The thin pilot uses personal public repositories, owner-login match, manual
review, explicit refresh, and no Project ranking. The existing-plan path ships
before generated reverse planning.

### 11.3 Falsification criteria

The model must be redesigned if:

1. a builder cannot reach the exact public preview in ten minutes;
2. a reader cannot explain the Project, its question, and its working-plan state
   after reading five rows and one Project page;
3. declaration, deterministic observation, and suggestion are confused;
4. a Project can publish without owner match and preview-bound consent;
5. an agent participates without an explicit request;
6. a builder cannot revoke the public Project;
7. advice cannot be traced to a human decision and later plan revision; or
8. seeded fixtures are mistaken for genuine community activity.

## 12. Delivery gates

### Gate 1 - Contract lock

- Keep the governing contract and subordinate trust contract explicit.
- Resolve source-of-truth references across repository instructions and PRDs.
- Obtain human approval before backend expansion.

### Gate 2 - Visual proof

- Preserve the live discovery shell and Visual Oracle.
- Complete the fixture-only onboarding, private review, public preview, and
  minimal profile context.
- Test comprehension before introducing persistence.

### Gate 3 - Thin Project loop

- Implement the existing-plan path for one invited builder, then five.
- Add Project, plan revision, conversation, review, evidence snapshot, consent,
  moderation, and revocation records only as required by that path.
- Publish no generated trend or popularity claim.

### Gate 4 - Terminal lane

After the Project Review contract is stable, add a local handoff that finds one
useful plan gap within sixty seconds and uploads nothing without approval.

### Gate 5 - Skill matching

Begin with reviewed, version-pinned Cookbooks and artifacts. Record only explicit
accepted, adapted, declined, or deferred outcomes.

### Gate 6 - Earned trends

Add transparent trends only after genuine submissions and outcomes exist. Every
view states its timeframe and sample size; popularity remains separate from
quality.

## 13. Hard boundaries and non-goals

Do not build:

- unsolicited repository crawling;
- private-repository support in the thin pilot;
- repository write access or autonomous code changes;
- `.env`, secret, terminal-history, or browser-cookie collection;
- hidden terminal interception or background daemons;
- sentiment, proficiency, behavioral, or contributor-risk profiling;
- automatic global skill promotion;
- generic Project popularity rankings;
- fabricated active-community or trend claims;
- enterprise compliance claims from repository signals;
- automatic AI participation;
- silent CURATIONS-funded execution; or
- organization and collaborator consent before a separate model is approved.

## 14. Success measures

| Area | Pilot signal |
| --- | --- |
| Comprehension | A newcomer explains the Project, human question, and plain-English description after five rows. |
| Submission | An invited builder reaches the exact public preview in ten minutes or less. |
| Conversation | The builder receives feedback scoped to the stated question and plan revision. |
| Improvement | Accepted or adapted advice connects to a later plan or Project revision. |
| Trust | Readers distinguish declaration, deterministic observation, human feedback, and AI suggestion. |
| Consent | Every public Project has owner match and preview-bound consent. |
| Revocation | The builder can withdraw the public Project without operator intervention. |
| AI boundary | No model call occurs without a separate explicit request. |
| Operations | Maintainers can review, hide, restore, and audit state without direct data editing. |

Page views, raw Project count, model calls, and votes are not pilot success
measures.

## 15. Acceptance criteria

1. README, START-HERE, ROADMAP, AGENTS, and subordinate PRDs link this document as
   the governing product contract.
2. The Project Evidence Registry is clearly subordinate and remains authoritative
   for evidence, consent, snapshots, freshness, and revocation.
3. A human feedback question anchored to a Project and working-plan revision is
   the canonical social object.
4. The entry experience presents both onboarding choices without implying that
   generated text is already the builder's declaration.
5. The existing-plan path can be understood end to end before backend work.
6. Private Project Review visibly separates facts, unknowns, gaps, and optional
   suggestions.
7. Public preview requires an explicit builder decision and publishes nothing.
8. Every published Project has a canonical public GitHub repository.
9. Project names link to GitHub in the Board's red link treatment.
10. Human questions link to internal Project conversations.
11. Stack pills link to corresponding Stack landing pages.
12. The homepage renders one Active-by-default, tab-controlled conversation feed.
13. Community Pulse links to Projects, Stacks, and Community Library masters.
14. Project type, attribute, stage, tool, and Stack combination remain distinct.
15. Upvotes target conversations and useful artifacts; follows target categories,
    tools, and Stack combinations.
16. Fixture activity is labeled illustrative and fixture detail routes are
    noindex.
17. Normal GitHub identity sign-in continues to discard the provider token.
18. No repository write access is requested.
19. Project preview and evidence rendering make no model request.
20. AI invitation defaults off and cannot change evidence or human outcomes.
21. User-funded execution lanes remain separate and have no silent Azure fallback.
22. Dynamic public text is rendered safely without raw HTML.
23. The Visual Oracle's dense rows, score rails, typography, identity colors,
    responsive rail, and accessibility remain intact.
24. Source checks, Astro checks, gateway checks, and dry-run deployment validation
    pass before production rollout.
25. Production deploys only from committed, reviewed source state.

## 16. Rollout and rollback

Roll out in the pilot sequence from Section 11. Do not merge contract approval,
visual proof, persistence, and public pilot into one irreversible release.

Rollback controls must independently:

- hide Project onboarding while preserving public directory and discovery reads;
- return the homepage to the last approved committed fixture shell;
- hide or revoke one Project immediately;
- stop GitHub reads and refresh without removing already reviewed public pages;
- disable optional AI without affecting Projects or conversations; and
- redeploy the last reviewed application revision.
