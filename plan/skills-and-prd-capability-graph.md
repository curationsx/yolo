# Skills and Accountable PRD Capability Graph Plan

**Status:** Working product plan for human review
**Scope:** `/skills`, reviewed Skill discovery, explicit PRD matching, member
actions, sourced examples, owner claims, profile activity, anchored threads, and
the public Startup Toolkit
**Product authority:** Subordinate to
[`docs/PRD-curations-community.md`](../docs/PRD-curations-community.md)
**Trust authority:** Source, consent, evidence, versioning, and recommendation
boundaries remain subordinate to
[`docs/PRD-project-evidence-registry.md`](../docs/PRD-project-evidence-registry.md)
**Related plans:**
[`community-discovery-architecture.md`](community-discovery-architecture.md) and
[`member-profiles-and-prd-showcase.md`](member-profiles-and-prd-showcase.md)
**Execution contract:**
[`autopilot-execution-contract.md`](autopilot-execution-contract.md)
**Visual contract:** Reuse the dense Lobsters Board, brutalist letter stamps,
score rails, mono metadata, zero radius, opaque surfaces, and contextual right
rails. Do not replace it with a card marketplace.

## 0. Product decision

The Project remains CURATIONS.DEV's durable center. Skills do not become a second
product center, an agent marketplace, or an automatic execution layer.

The expansion creates an accountable capability graph:

```text
Approved PRD revision
        |
Builder selects help intent and chooses Refresh matches
        |
Reviewed, version-pinned Skills with exact fit explanations
        |
Builder chooses Save, Use My Copilot, or Run in My Terminal
        |
Builder explicitly records a SkillUseOutcome: worked, adapted, did not fit, or deferred
        |
Outcome returns to the Project, Skill, profile, and stronger PRD revision
```

The learning moat is explicit outcome history, not invisible telemetry.

Daily automation discovers candidates. It never:

- publishes a Skill;
- promotes a mutable upstream default branch;
- scans a member's repository or PRD;
- generates member recommendations;
- starts a thread;
- saves or runs a Skill;
- converts popularity into quality; or
- writes directly to production.

`/skills` is a first-class master backed by the same canonical `Artifact` catalog
as `/library`. `/library` remains the all-resource view for Reviews, Skills,
prompts, workflows, and Cookbooks.

## 1. Top 0.1% question ladder

The product should be judged in four layers.

| Layer | Forcing question | Locked answer | Smallest falsification |
| --- | --- | --- | --- |
| **Good** | Can a newcomer safely find one relevant capability without understanding agent internals? | Job-first `/skills`, plain-language rows, reviewed sources, and a useful no-match state. | A new Vibe Coder cannot explain what the Skill does, where it came from, or what happens when they click it. |
| **Great** | Can a builder understand exactly why a Skill matches this PRD revision? | Explicit `Refresh matches` uses only the approved PRD revision, controlled taxonomy, Stack, stage, and help intent. | A recommendation cannot name its source, version, match rule, limitations, and PRD revision. |
| **Amazing** | Can the community improve recommendations without surveillance or popularity laundering? | Members Watch, Follow, Save, discuss, and explicitly record outcomes; public examples and community outcomes stay separate. | Stars, installs, hidden behavior, or model guesses become a quality claim. |
| **Moonshot** | Can CURATIONS map which reviewed capabilities helped which kinds of PRDs, under what constraints, over time? | Build an accountable PRD capability graph connecting revisions, Skills, conversations, choices, and explicit outcomes. | The graph becomes a generic social score, autonomous agent system, or uninspectable recommendation engine. |

### 1.1 What makes this good?

1. `/skills` is understandable before it is personalized.
2. Every public Skill has an exact source, version, license, audit state, and
   last-reviewed date.
3. The first browsing question is the job to be done:
   **Plan, Design, Build, Review, Test, Ship, or Grow**.
4. PRD type, stage, Stack, host compatibility, permissions, and risk remain
   filters rather than competing primary taxonomies.
5. A no-match result is a useful empty state, not a `404`.
6. No Skill is installed or run merely because it appears in CURATIONS.

### 1.2 What could make this great?

1. Every match names the exact approved PRD revision and the factors that made the
   Skill eligible.
2. A builder can refresh matches without granting a new repository read or
   inviting AI.
3. Public source examples explain documented use without claiming community
   adoption or effectiveness.
4. Community outcomes explain what worked, what needed adaptation, and what did
   not fit.
5. The member dashboard reconnects new reviewed Skills to the Projects and PRDs
   the member already controls.

### 1.3 What could make this amazing?

1. Community members can submit their own Skill or nominate a public Skill without
   confusing discovery credit with authorship.
2. Builders can start an anchored Skill Request when no reviewed match exists.
3. Owners can claim a publicly sourced PRD, preserving the discovery timeline
   while unlocking community participation.
4. Profiles show intentional public contributions without exposing private
   Watches, Follows, Saves, contact fields, or matching history.
5. The Startup Toolkit helps a builder move from PRD to launch without pretending
   fundraising and promotion programs are Skills.

### 1.4 Moonshot - the Top 0.1%

The moonshot is not "the biggest Skills directory."

It is a public, inspectable capability graph where a future builder can answer:

- Which reviewed Skills were relevant to PRDs like mine?
- Why were they matched?
- Which exact versions were used?
- What permissions and risks did they carry?
- What did builders explicitly report afterward?
- Which conversations or plan revisions resulted?
- Where is the evidence, and where is the uncertainty?

CURATIONS should know less about the person and more about the explicit,
source-linked decision path.

## 2. Product invariants

1. **Project remains central:** A Skill supports a Project or PRD decision; it does
   not replace the Project.
2. **Discovery is not publication:** External popularity may prioritize a private
   audit queue only.
3. **Review before recommendation:** A Skill must be source-pinned, licensed,
   audited, and compatible before it can appear as a match.
4. **No silent execution:** Saving, matching, and watching never install or run
   anything.
5. **Explicit refresh:** Default matching runs only when the member chooses
   `Refresh matches`.
6. **Bounded input:** Default matching uses the approved PRD revision and explicit
   taxonomy, Stack, stage, and help intent only.
7. **No automatic AI:** A model-assisted deeper match remains a separate,
   disclosed, future opt-in.
8. **Exact provenance:** Community submission, owner claim, public sourcing,
   AI curation, human review, and outcome evidence remain separate states.
9. **Popularity is not quality:** Stars, installs, Watch counts, saves, and
   upvotes never become effectiveness claims.
10. **Human question first:** Upvotes raise the visibility of a concrete
    conversation or useful Artifact, not the inherent quality of a PRD.
11. **Private interest by default:** Watch, Follow, Save, contact visibility, and
    matching history are private unless the member explicitly publishes them.
12. **Source-controlled catalog:** Published Artifact records, audit rules,
    matching rules, labels, and Program listings remain reviewed in Git.

## 3. One action vocabulary

| Action | Target | Meaning | Public by default |
| --- | --- | --- | --- |
| **Upvote** | Project, Showcase, Skill, or Program conversation; useful Artifact | This question or resource deserves more visibility | Aggregate only |
| **Watch** | One Project, Showcase, Skill, or Toolkit Program | Notify me about concrete updates | No |
| **Follow** | Project type, tool, or Stack combination | Show me activity across this taxonomy | No |
| **Save** | Skill, other Artifact, or Toolkit Program | Keep this in my member collection | No |
| **Refresh matches** | One approved PRD revision | Recalculate reviewed Skill matches from approved context | No |
| **Report outcome** | One Skill use tied to one PRD revision | Worked, worked after adaptation, did not fit, or deferred | Member chooses whether outcome is public |

Do not use `Subscribe` as a fifth overlapping concept.

### 3.1 Authenticated upvotes

- GitHub-authenticated CURATIONS identity is required.
- One member may hold one active upvote per target conversation or Artifact.
- Removing an upvote reverses that member's action.
- Server-side uniqueness, idempotency, rate limits, abuse review, and audit
  history are required.
- The score rail's accessible label names `conversation upvotes` or
  `useful-artifact upvotes`.
- Upvotes never change audit, evidence, owner, or recommendation states.

GitHub SSO raises the cost of abuse; it does not prove a person is unique or
eliminate coordinated voting.

### 3.2 Watch privacy and counts

Watch is an update subscription, not a popularity vote.

- Watch identities are private by default.
- A public aggregate appears only after a small privacy threshold.
- Toolkit Program Watch aggregates remain private because they may reveal
  fundraising, geography, or eligibility interests.
- The exact launch threshold remains configurable and must be approved before
  persistence.
- Watch count never powers default sorting, recommendations, badges, or
  trend claims.
- A watcher can choose in-product notifications and later optional email.
- Muting a thread does not silently remove the underlying Watch.

## 4. Information architecture

```text
curations.dev/
├── /skills/                         Reviewed Skills master
│   ├── /skills/jobs/{job}/          Plan, Design, Build, Review, Test, Ship, Grow
│   └── /skills/{slug}/              Exact source, audit, use cases, discussion
├── /library/                        All reviewed Artifact types
├── /toolkit/                        Public Startup Program catalog
│   └── /toolkit/{slug}/             Official source, eligibility, review state
├── /projects/{owner}/{repo}/        Canonical Project and working-plan context
├── /showcase/{slug}/                Standalone PRD Showcase
├── /members/{login}/                Intentional public contributions
├── /me/
│   ├── /me/work/                    Projects, Showcases, drafts, reviews
│   ├── /me/matches/                 PRD-scoped reviewed Skill matches
│   ├── /me/watched/                 Watched concrete objects
│   ├── /me/following/               Followed taxonomy
│   ├── /me/saved/                   Saved Artifacts and Programs
│   └── /inbox/                      Scoped updates and requests
└── /settings/
    ├── /profile/
    ├── /contact/
    ├── /notifications/
    ├── /privacy/
    └── /ai-and-execution/
```

New routes are conceptual until the fixture proof establishes the least confusing
composition. The required shareable `/projects/{owner}/{repo}/` route remains
canonical. The shared Board shell remains the presentation contract.

## 5. `/skills` master

### 5.1 Primary navigation

The master leads with jobs to be done:

1. **Plan** - problem framing, requirements, research, prioritization
2. **Design** - information architecture, interaction, accessibility, visual system
3. **Build** - implementation, data, integration, migration
4. **Review** - product, architecture, code, security, evidence
5. **Test** - QA, evaluation, falsification, performance
6. **Ship** - release, operations, observability, rollback
7. **Grow** - launch, community, distribution, and Toolkit pathways

Secondary filters:

- Project type;
- Project stage;
- Stack tool and Stack combination;
- supported agent host;
- required permissions;
- network access;
- risk level;
- audit state;
- exact version; and
- public outcome availability.

### 5.2 Board row

```text
▲ 42  Project-plan gap review
     Finds missing decisions, unclear users, and untested assumptions.
     REVIEWED · v1.3.0 · REVIEW · Copilot CLI + Claude Code
     GitHub source ↗ · MIT · reviewed 3d ago
     8 worked · 3 adapted · 1 did not fit
```

Every row includes:

- title and plain-English purpose;
- job to be done;
- exact version or commit;
- source owner and canonical repository;
- license;
- audit state and date;
- supported hosts;
- high-risk permissions when present;
- relevant Project types and Stacks;
- explicit outcome counts; and
- discussion count.

Do not show:

- a five-star quality rating;
- a generic `Verified` badge;
- GitHub stars as a quality signal;
- skills.sh installs as an effectiveness signal; or
- unsupported "best for your Project" copy.

### 5.3 Right rail

The contextual right rail indexes:

- jobs to be done;
- Project types;
- Stack roles and tools;
- supported hosts;
- recently reviewed updates;
- community-contributed Skills;
- `Submit my Skill`;
- `Nominate a public Skill`; and
- the public Startup Toolkit link under **Grow**.

### 5.4 No-match state

No match is a valid result, not a `404`.

```text
NO REVIEWED MATCH YET

We could not find a reviewed Skill for this PRD revision and help request.
Nothing unreviewed was substituted.

[Broaden filters] [Watch for future matches] [Start a Skill Request]
```

The member may:

1. inspect which constraints removed candidates;
2. broaden Project type, Stack, host, or job filters;
3. Watch for future reviewed matches; or
4. explicitly start an anchored Skill Request thread.

CURATIONS never auto-creates the public thread.

## 6. Skill record and trust states

### 6.1 Required published metadata

Before a Skill can be public or recommended, record:

- canonical author and source owner;
- repository numeric ID;
- repository root URL;
- exact file path;
- exact tag, version, and commit SHA;
- content integrity hash when distributed;
- license and required attribution;
- source copyright notice when required;
- plain-English purpose;
- jobs to be done;
- supported Project types and stages;
- supported Stack tools and versions;
- supported agent hosts;
- required permissions;
- allowed tools;
- network access;
- filesystem, shell, MCP, plugin, or secret-access requirements;
- known risks;
- installation or activation boundary;
- verification and rollback steps;
- audit status and reviewer;
- reviewed-at and review-expiry dates;
- update source;
- known limitations; and
- public outcomes where explicitly reported.

### 6.2 Public lifecycle

| State | Exact meaning |
| --- | --- |
| **REVIEWED** | The exact pinned revision completed the current audit contract. This is not a quality guarantee. |
| **UPDATE AVAILABLE** | Upstream changed after the reviewed pin. The reviewed revision remains available while the new revision waits for audit. |
| **STALE** | The review window expired, source disappeared, or compatibility could not be reconfirmed. |
| **RETIRED** | CURATIONS no longer recommends the Artifact. Historical references and outcomes retain their exact version. |

Outcome counts remain separate from lifecycle state.

### 6.3 Community introduction paths

Authenticated members may choose:

```text
[Submit my Skill]      [Nominate a public Skill]
```

`Submit my Skill`:

- requires owner-login match for the source repository during the first pilot;
- attributes authorship only after exact ownership checks;
- places the candidate in review.

`Nominate a public Skill`:

- credits discovery without implying authorship;
- requires the canonical public source;
- places the candidate in the same review queue; and
- cannot publish merely because it received nominations.

Human review may add compatibility, permission, risk, limitation, and provenance
copy that was not present at initial submission. Before an owner-submitted Skill
publishes, the owner must review the complete post-audit public record and provide
consent bound to its exact digest. Any later public-field change invalidates that
consent and requires a new preview decision.

A nominated Skill may publish only as a human-reviewed, publicly sourced record.
It receives no owner attribution or community-submitted stamp without the same
owner-match and final-preview consent.

### 6.4 Owner objection and delisting

The verified owner of a publicly sourced Skill or PRD may request delisting
without:

- claiming the record;
- creating a CURATIONS profile;
- consenting to community participation; or
- accepting any public summary.

An approved delisting:

- removes the sourced record and CURATIONS-authored summary from public discovery;
- prevents new matches, Public Examples, and AI-curated copy;
- marks existing private references unavailable rather than silently redirecting;
- preserves only the minimum internal audit record needed to prevent accidental
  republication; and
- provides an appeal and correction path.

A non-owner may report an error, unsafe Artifact, license problem, impersonation,
or stale source. Nomination credit never overrides an owner-verified objection.

## 7. Daily discovery Action

### 7.1 Purpose

At 9:00 AM `America/Los_Angeles`, a scheduled GitHub Action discovers new or
changed candidate metadata and opens or updates one bounded review pull request.

Conceptual schedule:

```yaml
on:
  schedule:
    - cron: '0 9 * * *'
      timezone: 'America/Los_Angeles'
  workflow_dispatch: {}
```

Scheduled Actions are best effort. The workflow must be idempotent and safe when
delayed, retried, skipped, or manually dispatched.

GitHub added IANA timezone support for scheduled workflows on March 19, 2026.
Revalidate the syntax against current GitHub documentation before implementation.

### 7.2 Candidate sources

Initial adapters may inspect:

1. **Community submissions and nominations**
2. **skills.sh discovery metadata**
3. **Canonical public GitHub Skill repositories**
4. **gstack and other separately audited, licensed sources**
5. **Official GitHub Search API queries** using topics, stars, creation date,
   pushed date, and update time

GitHub exposes no official Trending API and no native star-velocity field.
CURATIONS must not scrape `github.com/trending` as a hidden product dependency.

skills.sh installs, GitHub stars, recency, and source activity may prioritize the
private candidate queue only.

### 7.3 Canonical source rule

skills.sh or another directory may help discover a Skill. The canonical Artifact
source remains:

```text
GitHub owner + repository numeric ID + file path + exact commit SHA
```

Do not depend on an undocumented hosted registry endpoint. Do not copy a Skill
until license, attribution, source identity, and exact revision are known.

### 7.4 Workflow output

The Action:

1. fetches source metadata through allowlisted adapters;
2. records adapter version and retrieval time;
3. resolves the canonical GitHub source;
4. deduplicates by repository ID, path, and commit;
5. identifies new, changed, unavailable, or license-changed candidates;
6. applies static structural and risk checks;
7. limits the review batch to a small configurable maximum;
8. opens or updates one candidate pull request;
9. attaches exact source diffs and risk flags; and
10. publishes nothing.

Overflow remains in the workflow artifact or next bounded batch. It must not
silently expand a pull request beyond human review capacity.

### 7.5 Candidate pull request

Each candidate entry includes:

- why it entered the audit queue;
- source signal, without calling it quality;
- exact source and commit;
- license result;
- file and integrity changes;
- declared tools and permissions;
- static risk flags;
- prior review state;
- suggested jobs, Project types, and Stacks;
- unresolved questions; and
- explicit reviewer promotion or rejection controls.

Human review promotes an exact revision through normal source control.

### 7.6 Supply-chain boundary

Markdown instructions are executable social and model inputs, not harmless text.

The discovery job must not feed unreviewed Skill bodies into a model. Static
checks should flag:

- hidden or zero-width characters;
- raw HTML and encoded instructions;
- shell, filesystem, network, MCP, plugin, or secret access;
- destructive commands;
- credential-shaped examples;
- instructions to override system or user intent;
- dynamic downloads or remote execution;
- mutable dependencies;
- telemetry;
- unclear license; and
- host capabilities beyond the declared contract.

A Skill that requests Bash or broad network access receives a higher review tier.

## 8. Explicit PRD matching

### 8.1 Inputs

Default matching may use only:

- approved PRD revision ID and exact source;
- builder-approved structured purpose;
- Project type;
- Project stage;
- curated attributes;
- explicit Stack tools and combinations;
- selected job to be done;
- requested help mode; and
- agent host the builder intends to use.

It may not use:

- a new repository crawl;
- private repository data;
- `.env` files;
- terminal or browser history;
- hidden profile behavior;
- Watch, Follow, or Save history;
- inferred proficiency;
- sentiment;
- private messages; or
- an automatic model call.

### 8.2 Match result

Every result names:

- the exact PRD revision;
- exact Skill revision;
- eligible match rules;
- conflicting or unknown compatibility;
- required permissions;
- risk and limitations;
- why other candidates were excluded;
- last-reviewed date; and
- available public outcomes.

Use explainable fit language:

- **Strong fit for this request**
- **Possible fit - review constraints**
- **No reviewed fit**

Do not publish a hidden numeric quality score.

### 8.3 Match snapshot

A match result is a private, dated snapshot:

```text
PRD revision + approved context + matching-rule version + catalog revision
```

Editing the PRD or matching inputs invalidates the snapshot. The member chooses
when to refresh.

### 8.4 Watch for matches

If a no-match member explicitly chooses `Watch for future matches`:

1. CURATIONS stores only the approved matching keys and subscription;
2. a newly reviewed Artifact may trigger a deterministic eligibility check;
3. the Inbox says `New reviewed match available`;
4. no recommendation snapshot changes automatically; and
5. the member chooses `Refresh matches`.

### 8.5 User-controlled execution

From an exact reviewed Skill, a member may:

- **Save** the reference;
- **Use My Copilot** through the existing separate one-run authorization; or
- **Run in My Terminal** by copying a versioned handoff.

CURATIONS does not auto-install, auto-run, or silently fall back to Azure.

## 9. Outcomes and use cases

### 9.1 Community Skill Use Outcomes

`SkillUseOutcome` is distinct from the governing `RecommendationOutcome`:

- `RecommendationOutcome` records the builder's decision about advice:
  **accepted, adapted, declined, or deferred**.
- `SkillUseOutcome` records the builder's explicit result for one exact Skill
  revision: **worked, worked after adaptation, did not fit, or deferred**.

Declining advice does not imply a Skill was run. `Did not fit` cannot be inferred
unless the builder explicitly reports the Skill-use result.

A builder may explicitly report:

- **Worked**
- **Worked after adaptation**
- **Did not fit**
- **Deferred**

An outcome is tied to:

- member;
- Project or Showcase;
- PRD revision;
- exact Skill revision;
- date;
- optional public explanation;
- optional later plan revision; and
- member-controlled visibility.

The builder owns the outcome. CURATIONS does not infer success from clicks,
copies, runs, commits, or time spent.

### 9.2 Public Examples

Public examples form a separate rail.

They may include:

- official documentation;
- exact public repository examples;
- source-authored case studies; and
- publicly readable PRDs.

Each example shows:

- `PUBLICLY SOURCED`;
- exact source;
- retrieved and reviewed date;
- claim limitations;
- `AI-CURATED` only when a model actually selected or summarized it; and
- human review before public AI-curated copy appears.

Do not call an example "implemented well" unless the cited source supports that
exact claim.

### 9.3 Skill detail composition

```text
SKILL PURPOSE + EXACT VERSION + REVIEW STATE

[Save] [Watch] [Use My Copilot] [Run in My Terminal]

WHY IT MAY FIT
Permissions · risks · hosts · Stack · verification

COMMUNITY OUTCOMES
Worked · adapted · did not fit · deferred

PUBLIC EXAMPLES
Publicly sourced · optional AI-curated · exact citations

DISCUSSION
Anchored human questions and replies
```

## 10. Publicly sourced PRDs and owner claim

### 10.1 Unclaimed state

An unclaimed sourced PRD:

- appears only as a cited Public Example;
- is not presented as community-submitted;
- has no community upvotes;
- has no Watch count;
- has no comments or community thread;
- does not appear in the shared Active community feed; and
- carries an info disclosure:

> Sourced from public material; not a community contribution - yet.

### 10.2 Public labels

| Stamp | Exact meaning |
| --- | --- |
| `PUBLICLY SOURCED` | CURATIONS found the exact public source; the owner has not submitted or claimed it. |
| `AI-CURATED` | A disclosed model helped select or summarize the public source; human review is still required. |
| `✓ COMMUNITY SUBMITTED` | The authenticated owner directly submitted and consented to the community record. |
| `✓ OWNER CLAIMED` | The authenticated owner claimed an existing sourced record and consented to community participation. |

The blue check stamps confirm identity and consent only. They do not mean the PRD
is accurate, feasible, effective, secure, endorsed, or independently verified.

### 10.3 Claim transition

Use one record with immutable provenance:

```text
PUBLICLY SOURCED
        |
Authenticated owner match
        |
Exact source and public preview
        |
Owner consent + maintainer review
        |
✓ OWNER CLAIMED
```

The transition preserves:

- original discovery source;
- discovery adapter and date;
- any AI-curated disclosure;
- exact pre-claim source revision;
- claim request;
- owner-match result;
- exact preview digest;
- consent date;
- maintainer decision; and
- later revisions.

Claim unlocks the community conversation, Watch, profile attribution, and
intentional public activity. It does not erase the original sourced history.

Conflicting ownership or claim disputes require a separate human review path.

An owner may also request delisting without claiming the record or consenting to
community participation. After owner verification, CURATIONS removes the sourced
record from public discovery, preserves only the minimum internal audit history
needed to prevent accidental republication, and provides an appeal path. Any
visitor may submit a correction or report without claiming ownership.

## 11. Homepage and discovery behavior

### 11.1 Shared Active feed

The homepage remains one conversation graph.

Community-submitted or owner-claimed Project and Showcase conversations may
appear. Unclaimed Public Examples do not.

Rows may show:

- human question;
- Project or PRD title;
- exact provenance stamp;
- one-line purpose;
- Stack pills;
- conversation upvotes;
- Watch action;
- public Watch aggregate after threshold;
- replies and participants;
- activity time; and
- AI label only when AI actually participated.

### 11.2 Badge treatment

`✓ COMMUNITY SUBMITTED` and `✓ OWNER CLAIMED` use the existing brutalist stamp
language and an accessible light-blue treatment paired with a tested dark-blue
foreground.

The accessible name and tooltip spell out:

- authenticated owner identity matched;
- exact publication consent recorded; and
- no quality or effectiveness claim.

### 11.3 Sorting

Allowed sorts remain transparent:

- Active conversation;
- New submission;
- Needs feedback;
- Recently improved;
- recently reviewed Skill update; and
- explicit Artifact upvotes within a named window.

Watch counts, GitHub stars, skills.sh installs, and profile activity do not power
default ranking.

## 12. Member dashboard and public profiles

### 12.1 `/me`

The private dashboard includes:

- **My Work** - Projects, Showcases, drafts, and reviews;
- **Matches** - PRD-scoped reviewed Skill snapshots;
- **Watched** - concrete Project, Showcase, and Skill updates;
- **Following** - Project types, tools, and Stack combinations;
- **Saved** - Artifacts and Toolkit Programs;
- **Outcomes** - choices waiting for an explicit result;
- **Inbox** - replies, review decisions, revisions, and new-match notices; and
- **Settings** - profile, contact, notifications, privacy, AI, and execution.

### 12.2 Public contribution feed

Every public human handle links to `/members/{login}/`. The record remains keyed
by immutable GitHub user ID, with redirects after login changes.

The Lobsters-style public feed includes only intentional public contributions:

- submitted or claimed Projects and Showcases;
- anchored threads;
- public replies;
- public recommendation outcomes;
- reviewed Artifact contributions;
- Skill submissions;
- Skill nominations, labeled as discovery credit; and
- public Program experience reports.

Watch, Follow, Save, matching history, and contact visibility stay private unless
the member explicitly publishes them.

### 12.3 Profile fields

Member-controlled fields may include:

- display name;
- bio;
- website;
- location;
- social links;
- GitHub identity backlink;
- public contribution tabs; and
- optional contact email.

Social links are member-declared. CURATIONS normalizes and validates URLs but
does not imply ownership or endorsement without a separate proof.

### 12.4 Contact email

GitHub email is never imported automatically.

A member may separately:

1. enter a contact email;
2. verify it through a single-purpose token;
3. choose `Public`, `Signed-in members`, or `Private`; and
4. revoke or change visibility.

Default is `Private`.

Signed-in visibility reduces casual exposure but does not prevent scraping.
Rate limits, reveal controls, abuse handling, export, deletion, and clear copy are
required before the field ships.

## 13. Anchored threads and controlled tags

### 13.1 Allowed subjects

The first expanded model permits a thread only when anchored to:

- one Project and PRD revision;
- one PRD Showcase revision;
- one reviewed Skill or other Artifact; or
- one Startup Toolkit Program listing.

No free-floating forum or category-only thread ships in the first expansion.
Category, Stack, and Skill landing pages aggregate anchored conversations.

### 13.2 Creation contract

An authenticated human starts a thread by providing:

1. one concrete subject;
2. one human question;
3. one help intent;
4. requested feedback mode;
5. exact revision where applicable;
6. optional reviewed Skill references;
7. exact public preview; and
8. publication consent.

### 13.3 Tag sources

The subject contributes approved metadata:

- Project type;
- attributes;
- stage;
- Stack tools and combinations;
- Artifact jobs;
- supported hosts; and
- provenance state.

The author selects:

- one primary help intent; and
- optional reviewed Skill references.

AI may suggest tags only through a separate disclosed step. The author approves
each suggestion before it becomes public.

No free-form public hashtags ship initially.

### 13.4 Skill Request

When no reviewed Skill matches, the member may explicitly start a Skill Request
anchored to the PRD revision.

The request includes:

- no-match explanation;
- Project or Showcase context;
- job to be done;
- Stack and host constraints;
- permissions the member will not grant;
- the question for the community; and
- Watch-for-matches option.

The system never auto-posts the request.

## 14. Startup Toolkit

### 14.1 Separate public catalog

`/toolkit` is a public Program catalog, not a Skill category.

Examples may include:

- launch and discovery platforms;
- startup communities;
- accelerators;
- crowdfunding platforms;
- grants and credits;
- founder education;
- distribution channels; and
- transparent promotion pathways.

The **Grow** job on `/skills` may cross-link relevant Toolkit pathways.

### 14.2 Public Program record

Every listing includes:

- official program name and URL;
- operator;
- program type;
- geography;
- stage and eligibility;
- application or availability window;
- cost or equity terms where publicly stated;
- official source date;
- last-reviewed date;
- known limitations;
- correction/report path; and
- affiliate, sponsorship, or referral disclosure.

CURATIONS does not promise acceptance, funding, investment suitability, legal
eligibility, or current availability.

### 14.3 Signed-in value

GitHub sign-in unlocks:

- Save;
- private eligibility notes;
- application checklists;
- explicit Watch for deadline or terms updates;
- Project-aware pathways;
- explicit outcome notes; and
- Inbox reminders.

The public index remains readable without authentication.

## 15. Data and source-control implications

The plan introduces or extends:

- `Artifact`
- `ArtifactRevision`
- `SkillAudit`
- `ArtifactPublicationConsent`
- `SkillCompatibility`
- `SkillSourceCandidate`
- `CandidateDiscoveryRun`
- `MatchingRule`
- `SkillMatchSnapshot`
- `RecommendationOutcome`
- `SkillUseOutcome`
- `Watch`
- `Follow`
- `Save`
- `MatchWatch`
- `Notification`
- `Conversation`
- `ConversationSubject`
- `ConversationTagReference`
- `PublicSourceProvenance`
- `OwnerClaim`
- `SourceDelistRequest`
- `MemberContactMethod`
- `ProgramListing`
- `ProgramRevision`
- `ProgramSave`

Authority:

- **Git:** published Artifacts, exact revisions, audit metadata, matching rules,
  labels, Program listings, schemas, and application behavior.
- **GitHub pull requests:** daily candidate review and human promotion.
- **Member data store:** private Watches, Follows, Saves, match snapshots,
  visibility, notifications, outcomes, and contact settings.
- **Public community store:** approved conversations, replies, claims, and public
  outcomes.

The candidate queue does not become a second unreviewed public catalog.

## 16. Safety and failure modes

| Failure | Required response |
| --- | --- |
| Malicious Skill contains prompt injection | Never feed unreviewed bodies into a model; static flags, exact diff, human audit, least privilege, and rejection path. |
| Popular upstream is compromised | Keep the reviewed pin; mark `UPDATE AVAILABLE`; never advance automatically. |
| License or attribution is missing | Do not copy, publish, distribute, or recommend the Artifact. |
| GitHub stars or skills.sh installs appear as quality | Use the signal only in the private audit queue and state that boundary in code and copy. |
| Match is wrong | Show exact rules and exclusions; allow `did not fit`; never call it verified or best. |
| Matching silently scans a repository | Default matching accepts only approved structured PRD context and explicit taxonomy. |
| No match produces a dead end | Render the no-match state with broaden, Watch, and optional Skill Request actions. |
| Watch count becomes a leaderboard | Threshold the aggregate, hide identities, and prohibit Watch-based sorting. |
| Blue check implies PRD quality | Spell out identity and consent only in visible text, accessible name, and methodology. |
| Sourced PRD looks community-submitted | Keep it out of community feeds and threads until owner claim and consent. |
| Claim is hijacked | Owner-login match, exact source, preview digest, maintainer review, dispute path, and audit log. |
| Source owner objects without wanting to claim | Provide owner-verified delisting without community consent, retain minimal anti-republication audit history, and allow appeal. |
| Skill review changes public claims after owner consent | Invalidate the preview digest and require a new exact owner decision before publication. |
| AI-curated copy invents a claim | Exact citations, narrow label, human review, correction path, and no unsupported outcome language. |
| Email visibility causes spam or doxxing | Separate verification, default private, granular visibility, reveal controls, rate limits, and revocation. |
| Profile becomes behavioral surveillance | Publish intentional contributions only; keep private actions and matching history private. |
| Toolkit listing becomes stale or promotional | Official source, reviewed date, correction path, expiry, and sponsorship disclosure. |
| Thread tags drift or become spam | Inherit controlled subject metadata; one author-selected intent; no free-form hashtags. |
| Upvotes are coordinated or automated | Authentication, uniqueness, idempotency, rate limits, anomaly review, and no quality claim. |
| Daily Action overwhelms reviewers | Bound the batch, preserve overflow, measure review capacity, and stop scheduling before bypassing review. |

## 17. Delivery sequence

These expansion gates remain subordinate to the governing Community PRD. They do
not move persisted Skill matching ahead of the thin Project loop.

### Expansion Gate 1 - Contract and fixture-only visual proof

Build fixture-only:

- `/skills` master;
- job-first navigation and filters;
- Skill detail with trust, permissions, Community Outcomes, and Public Examples;
- reviewed match, possible match, and no-match states;
- Watch, Follow, Save, and authenticated Upvote appearances;
- `✓ COMMUNITY SUBMITTED` and `✓ OWNER CLAIMED` stamps;
- `PUBLICLY SOURCED` and `AI-CURATED` disclosures;
- member Matches, Watched, Following, Saved, and Inbox shells;
- public contribution feed;
- anchored Skill Request preview; and
- `/toolkit` shell.

Make no database write, candidate fetch, scheduled Action, repository read, model
call, email send, Skill install, or execution request.

### Expansion Gate 2 - Artifact schema and audit contract

1. Lock required metadata and lifecycle states.
2. Define reviewer roles, audit checklist, expiration, and retirement.
3. Audit fictional and existing CURATIONS-owned fixtures first.
4. Exercise one separately licensed public Skill as a private review fixture.
5. Confirm exact attribution and source pinning.
6. Define compatibility and risk rules in Git.

### Expansion Gate 3 - Community submission and nomination

1. Add `Submit my Skill` and `Nominate a public Skill`.
2. Require authenticated identity and exact source.
3. Keep all candidates pending.
4. Add duplicate, report, withdraw, owner-delist, reject, and appeal behavior.
5. Render the complete post-audit public preview.
6. Require digest-bound owner consent for owner-submitted Skills.
7. Publish one approved owner-submitted Skill manually.
8. Publish one approved nominated Skill manually as publicly sourced.

### Expansion Gate 4 - Member action persistence

Add only the state needed for:

- authenticated Artifact upvotes;
- Watch;
- Follow;
- Save;
- profile contribution feed;
- notifications;
- visibility;
- verified contact email; and
- moderation.

Prove privacy, abuse controls, export, deletion, and Watch-count threshold before
showing public aggregates.

### Expansion Gate 5 - Explicit deterministic matching

1. Add approved PRD matching inputs.
2. Publish versioned matching rules.
3. Require member-triggered `Refresh matches`.
4. Store private match snapshots.
5. Explain every result and exclusion.
6. Add no-match state and opt-in Match Watch.
7. Record explicit `SkillUseOutcome` results without changing
   `RecommendationOutcome`.
8. Expand only after five real builders can understand the result.

### Expansion Gate 6 - Daily candidate Action

1. Audit each source adapter.
2. Run metadata-only dry runs.
3. Confirm rate limits, license behavior, and deduplication.
4. Generate one bounded candidate PR manually.
5. Enable `workflow_dispatch`.
6. Enable the 9:00 AM Los Angeles schedule only when review ownership exists.
7. Stop automatically if candidate backlog exceeds human capacity.

### Expansion Gate 7 - Public Examples and owner claim

1. Publish one human-reviewed Public Example.
2. Keep it outside community engagement.
3. Exercise owner claim privately.
4. Test conflict, rejection, withdrawal, owner delisting without claim, and
   source-change paths.
5. Publish one approved owner-claimed record.
6. Exercise one verified owner delisting request.
7. Add AI-curated public copy only after the human editorial workflow works.

### Expansion Gate 8 - Startup Toolkit

1. Lock the Program schema and disclosure rules.
2. Publish a small public fixture catalog.
3. Add member Saves and private checklists.
4. Add reviewed update notifications.
5. Test stale, closed, region-limited, sponsored, and corrected Programs.

### Expansion Gate 9 - Earned capability graph

Only after genuine outcomes exist:

- connect outcomes to exact PRD and Skill revisions;
- expose transparent, sufficiently aggregated patterns;
- state timeframe and sample size;
- separate community outcomes from public examples;
- provide correction and withdrawal; and
- reject any composite person, Project, PRD, or Skill quality score.

## 18. Smallest proof and success measures

The model is disproved or must be redesigned if:

1. a newcomer cannot find a plausible reviewed Skill within sixty seconds;
2. a builder cannot explain why a Skill matched their PRD;
3. a member mistakes Save or Watch for execution;
4. a public candidate is mistaken for community participation;
5. a blue check is interpreted as PRD quality;
6. a Skill update silently changes a reviewed recommendation;
7. no-match feels like an error or abandonment;
8. members feel required to expose their interests or contact email;
9. a thread loses its concrete source or revision;
10. the daily Action creates more review work than humans can safely complete;
11. outcomes are inferred from telemetry rather than explicitly reported; or
12. the capability graph cannot be inspected back to exact sources and decisions.

Pilot signals:

| Area | Signal |
| --- | --- |
| Discovery clarity | Newcomers distinguish job, Project type, Stack, host, and risk filters. |
| Trust clarity | Readers explain `REVIEWED`, `UPDATE AVAILABLE`, `STALE`, and `RETIRED`. |
| Match clarity | Builders identify the PRD revision and rules behind each result. |
| No-match utility | Builders broaden, Watch, or start a Skill Request rather than abandon the flow. |
| Action clarity | Members distinguish Upvote, Watch, Follow, Save, Refresh, and Run. |
| Provenance | Readers distinguish public sourcing, AI curation, community submission, and owner claim. |
| Outcome quality | Reports include exact revisions and useful explanations without invisible telemetry. |
| Profile trust | Private interest and contact data do not appear without explicit visibility. |
| Review capacity | Candidate intake remains below the agreed human audit capacity. |
| Safety | No unreviewed Skill is installed, run, matched, or published. |

Page views, GitHub stars, skills.sh installs, Watch counts, raw Skill count, model
calls, and execution count are not success measures.

## 19. Acceptance criteria

1. `/skills` is first-class and shares one canonical Artifact catalog with
   `/library`.
2. Jobs to be done lead navigation; PRD type and Stack remain separate filters.
3. Every public Skill shows exact source, version, license, audit state, and date.
4. Skill states are `REVIEWED`, `UPDATE AVAILABLE`, `STALE`, and `RETIRED`.
5. Community Outcomes and Public Examples are separate rails.
6. External popularity influences only the private audit queue.
7. GitHub Trending is not treated as an official API.
8. Daily automation produces one bounded candidate pull request.
9. Daily automation never writes directly to production.
10. Unreviewed Skill bodies are not supplied to a model.
11. Updates never advance a reviewed pin automatically.
12. Members may submit their own Skill or nominate a public Skill.
13. Ownership and nomination credit remain distinct.
14. Default matching requires an explicit member `Refresh matches`.
15. Default matching uses only approved PRD and controlled context.
16. Every match names exact PRD, Skill, catalog, and matching-rule revisions.
17. No match renders a useful empty state rather than a `404`.
18. Match Watch sends only a new-match notice; it does not regenerate results.
19. Save, Watch, Follow, and Match do not install or run anything.
20. Execution remains user-controlled through the existing two lanes.
21. Upvotes require authenticated identity.
22. Upvotes target conversations and useful Artifacts, not PRD quality.
23. Watch counts appear only after an approved privacy threshold.
24. Watch counts never power ranking.
25. `PUBLICLY SOURCED` records stay outside community feeds before claim.
26. `AI-CURATED` appears only when a model actually curated the item.
27. AI-curated public copy requires human review and exact citations.
28. `✓ COMMUNITY SUBMITTED` means owner identity and consent only.
29. `✓ OWNER CLAIMED` means identity and consent only, makes no quality claim,
    and preserves immutable pre-claim provenance.
30. Public profiles show intentional contributions only.
31. Watch, Follow, Save, and matching history remain private by default.
32. Contact email is separately entered, verified, and default-private.
33. Threads are anchored to a concrete Project, Showcase, reviewed Artifact, or
    Program.
34. Thread taxonomy is inherited from approved metadata.
35. Authors select one help intent; AI tag suggestions require approval.
36. Skill Requests are member-started and PRD-revision scoped.
37. `/toolkit` remains a separate public Program catalog.
38. Toolkit personalization requires sign-in; the public index does not.
39. Toolkit listings show official sources, review dates, eligibility caveats,
    and commercial disclosures.
40. Fixture detail routes are noindex and labeled illustrative.
41. The visual-proof gate makes no persistence, fetch, model, email, or execution
    call.
42. Capability-graph patterns appear only after genuine, sufficiently aggregated
    outcomes exist.
43. `SkillUseOutcome` remains distinct from the governing
    `RecommendationOutcome`.
44. A verified source owner can request delisting without claiming the record or
    consenting to community participation.
45. Owner-submitted Skill publication requires consent bound to the complete
    post-audit public preview.
46. Toolkit Program updates require an explicit Watch; Save alone never enables
    notifications.

## 20. Top 0.1% open questions before backend work

These do not block the fixture-only visual plan. They must be answered before the
corresponding persisted gate.

1. What exact public Watch-count threshold protects privacy without hiding useful
   community momentum?
2. Who owns daily Skill review, and what backlog automatically pauses discovery?
3. What is the maximum candidate batch size a reviewer can audit deeply?
4. How long does a Skill remain `REVIEWED` before compatibility revalidation?
5. Which permission combinations require security-specialist review?
6. What exact taxonomy distinguishes **Review** from **Test**, and **Ship** from
   **Grow**, for ambiguous Skills?
7. How many match results remain useful before the page becomes another directory?
8. How should deterministic match ties be ordered without hiding a quality score?
9. Which outcome details can be public without exposing confidential Project
   context?
10. When may an outcome count appear without identifying a one-person cohort?
11. What proof resolves a claim conflict for organization or collaborator-owned
    repositories?
12. Which model, prompt, sources, cost ceiling, and reviewer contract would govern
    future `AI-CURATED` copy?
13. How should a member challenge or correct an AI-curated summary?
14. How should signed-in contact email resist harvesting by authenticated bots?
15. Which Toolkit fields require jurisdiction-specific language or legal review?
16. What sponsorship or affiliate relationships would disqualify a Toolkit
    listing?
17. When does a Program update require member notification versus a new review?
18. What minimum sample size permits a public capability-graph pattern?
19. How does an Artifact retirement affect saved references, old outcomes, and
    reproducible Project history?
20. What is the rollback path if one source adapter or daily Action begins
    generating unsafe or low-quality candidate volume?

## 21. Source notes for discovery design

These sources inform candidate discovery only. They are not adopted runtime
dependencies by this plan.

- **skills.sh:** https://skills.sh and
  https://github.com/vercel-labs/skills
- **Open skills.sh-compatible API implementation:**
  https://github.com/mastra-ai/skills-api
- **gstack:** https://github.com/garrytan/gstack
- **GitHub repository search:**
  https://docs.github.com/en/rest/search/search#search-repositories
- **GitHub Actions schedule syntax:**
  https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule
- **GitHub Actions timezone support announcement:**
  https://github.blog/changelog/2026-03-19-github-actions-late-march-2026-updates/
- **OWASP LLM and supply-chain guidance:**
  https://owasp.org/www-project-llm-security/

Before an implementation depends on any source:

1. verify current ownership and license;
2. inspect every network and executable path;
3. confirm rate limits and terms;
4. pin adapter behavior;
5. document rollback; and
6. preserve the canonical GitHub source as the Artifact authority.
