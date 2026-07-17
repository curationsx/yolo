# Member Profiles and PRD Showcase Plan

**Status:** Working product plan for human review
**Scope:** Curations-native member profiles, settings, inbox, public PRD
Showcase, Copilot CLI breakdowns, and opt-in Rubber Duck Roast
**Product authority:** Subordinate to
[`docs/PRD-curations-community.md`](../docs/PRD-curations-community.md)
**Existing review contract:**
[`community/PRD-SHOWCASE.md`](../community/PRD-SHOWCASE.md)
**Visual contract:** Reuse the conversation-first Lobsters Board and its dense,
brutalist row, thread, tab, and right-rail language

## 0. Product decision

GitHub proves identity and links public source material. CURATIONS owns the
member experience.

A CURATIONS member profile is not a mirror of a GitHub profile. It is the
member's public and private home for:

- Projects;
- standalone PRD Showcases;
- public feedback;
- Stack context;
- Community Library contributions and outcomes;
- drafts and pending reviews;
- notifications and Project-scoped messages; and
- privacy, AI, and account settings.

PRD Showcase is a first-class self-promotion and discussion lane for a public
PRD. It does not require the author to enter the full Project Evidence or
improvement loop first.

The bridge is:

```text
Share one public PRD
        |
Add a builder-approved Copilot CLI purpose breakdown
        |
Ask for discussion, focused review, or an optional Rubber Duck Roast
        |
Appear in the shared Community Board and dedicated Showcase master
        |
Record useful feedback or a revised PRD
        |
Optionally connect the Showcase to a full Project later
```

This preserves the Project as CURATIONS.DEV's durable center without making a
full Project submission the price of entry for every useful PRD conversation.

The first-class Showcase lane itself is optional. Choosing it is an explicit
decision to run the required purpose-breakdown prompt in the author's own
Copilot CLI. No AI runs merely because a PRD URL is entered, and no hosted
CURATIONS agent is invited by this choice.

Builders who cannot or do not want to use Copilot CLI may still:

- share a Project through the AI-free Project path; or
- use the GitHub-native PRD Showcase discussion for human review.

They do not enter the first-class CURATIONS Showcase pilot until its required
local breakdown contract is satisfied.

## 1. Why this addition is needed

The current Project journey is designed around improving a public software
Project and working plan. That is the product moat, but it is not every visitor's
first job.

Some builders primarily want to:

1. show what they have planned;
2. explain the PRD's purpose in plain English;
3. invite discussion before or during implementation;
4. promote their work without disguising promotion as evidence;
5. receive structured critique without surrendering authorship; and
6. discover other PRDs by problem, Stack, stage, or open question.

The existing `community/PRD-SHOWCASE.md` already defines accountable critique.
What is missing is a first-class CURATIONS.DEV surface, profile integration,
discovery route, and builder-controlled submission experience.

### 1.1 Relationship to the GitHub-native PRD Showcase

The two surfaces are related but not automatically mirrored:

| Surface | Role |
| --- | --- |
| GitHub Discussion `prd-showcase` | GitHub-native companion and human-review fallback. It may operate without a Copilot CLI breakdown. |
| CURATIONS `/showcase/` | First-class member, discovery, profile, Stack, revision, and outcome surface defined by this plan. |

`community/PRD-SHOWCASE.md` remains the review and authorship compact for both.
Its Problem, Intent, Users, Requirements, Human x AI, Evidence, Safety, Rollout,
Measures, and Decisions lenses remain the complete review baseline.

The optional Rubber Duck Roast is an additional critique mode, not a replacement
for those lenses.

During the pilot:

- a GitHub Discussion is not automatically copied into CURATIONS;
- a CURATIONS Showcase is not automatically posted to GitHub Discussions;
- each surface uses its own moderation and report path;
- either surface may link to the other;
- a member may later import a Discussion link into a Showcase after satisfying
  the CURATIONS publication contract; and
- no surface is silently declared canonical for content created on the other.

## 2. Product objects and relationships

### 2.1 Member

`Member` is the CURATIONS account anchored to an immutable GitHub user ID.

- GitHub login and avatar may refresh at sign-in.
- A GitHub login rename does not create a new member.
- The GitHub profile remains an external identity source.
- CURATIONS stores only the member fields and preferences required by this
  product.
- Normal GitHub OAuth remains `read:user`; the provider token is discarded after
  profile lookup.

### 2.2 MemberProfile

`MemberProfile` is a Curations-native presentation and settings record.

Public fields may include:

- display name;
- GitHub login and avatar;
- optional plain-English bio;
- optional location or website supplied by the member;
- public Projects;
- public PRD Showcases;
- public feedback contributions;
- explicit Stack follows and Stack context from public submissions;
- public Library contributions; and
- builder-recorded accepted or adapted outcomes.

It must not include:

- inferred proficiency;
- sentiment or personality scores;
- private repository activity;
- copied GitHub follower or star counts;
- hidden behavioral analytics;
- private messages or notification history; or
- a prestige score synthesized from activity.

### 2.3 PRDShowcase

`PRDShowcase` is a standalone public artifact anchored to:

- one CURATIONS member;
- one exact public PRD URL;
- one source version when the host supports commit or revision pinning;
- one builder-approved plain-English title and description;
- one required Copilot CLI purpose breakdown;
- optional Stack context;
- one human-authored discussion question;
- one review mode;
- optional Rubber Duck Roast consent; and
- revision and outcome history.

A PRD Showcase may later attach to a `Project`, but the author may publish the
Showcase without completing full Project intake.

### 2.4 ShowcaseConversation

`ShowcaseConversation` uses the same Board thread contract as a
`ProjectConversation`.

It differs only in its anchor:

- Project conversation -> one Project and working-plan revision.
- Showcase conversation -> one public PRD Showcase and source revision.

Both appear in the shared Active feed. The Showcase also appears in its own
master route and profile tab.

## 3. Information architecture

```text
curations.dev/
├── /                              Shared conversation feed
├── /showcase/                     PRD Showcase master
│   └── /showcase/{slug}/          Showcase detail + conversation
├── /projects/                     Full Project community
├── /members/{login}/              Public Curations member profile
├── /me/                           Private signed-in member home
├── /inbox/                        Notifications + scoped conversation inbox
└── /settings/
    ├── /profile/                  Curations profile fields
    ├── /account/                  GitHub identity, sessions, export, deletion
    ├── /notifications/            Inbox and email preferences
    ├── /privacy/                  Visibility, blocks, safety
    └── /ai-and-execution/         AI defaults and execution disclosures
```

The database keys members by immutable GitHub user ID. Public profile routing may
use the current login for readability, with redirects when a login changes.

## 4. Public member profile

### 4.1 Header

```text
[AVATAR]  MAYA R.  @maya
          GitHub identity linked · View GitHub ↗
          Building practical tools for independent venues.

3 Projects · 2 PRD Showcases · 19 useful replies · 4 adopted outcomes

[PROJECTS] [SHOWCASES] [FEEDBACK] [STACK] [LIBRARY]
```

The GitHub identity link is visually separate from the CURATIONS profile. The
page never implies GitHub endorses the member or CURATIONS verifies the accuracy
of every public claim.

### 4.2 Profile tabs

| Tab | Contents |
| --- | --- |
| **Projects** | Project conversation rows, stages, revisions, and red repository links. |
| **Showcases** | Public PRDs, their purpose breakdowns, review mode, Roast state, and revision status. |
| **Feedback** | Public replies and outcomes the Project or Showcase owner marked accepted, adapted, declined, or deferred. |
| **Stack** | Explicit follows plus tools named in public Projects or Showcases, with declaration clearly separated from observation. |
| **Library** | Reviews, skills, prompts, workflows, and Cookbooks the member contributed or publicly reported an outcome for. |

The page uses dense Board rows, not social-media cards. It favors useful context
over follower counts or vanity metrics.

### 4.3 Public visibility

- A newly authenticated account does not need a public profile page until the
  member publishes or explicitly enables one.
- Public actions remain attributed even if the member later hides optional
  profile fields.
- Deactivation and deletion behavior must distinguish account data from public
  conversation records that other people rely on.
- A member can preview the public profile before enabling it.

## 5. Private member home

`/me/` is the signed-in working dashboard.

```text
MY CURATIONS

[OVERVIEW] [DRAFTS] [PENDING REVIEW] [SAVED] [FOLLOWING]

Needs attention
3 new replies · 1 maintainer note · 1 PRD open for Roast

Your work
Draft Project · Pending Showcase · Recently revised PRD
```

The dashboard includes:

- draft Projects and Showcases;
- pending maintainer reviews;
- open feedback requests;
- saved Library artifacts;
- followed categories, tools, and Stack combinations;
- subscribed Project and Showcase conversations;
- recent revisions;
- explicit recommendation outcomes waiting for the member's decision; and
- inbox summaries.

## 6. Settings

### 6.1 Profile

- display name;
- optional bio;
- optional website and location;
- public profile preview;
- visibility controls for optional fields; and
- avatar source, initially GitHub.

### 6.2 Account and GitHub identity

- current linked GitHub login and stable GitHub identity;
- last successful sign-in;
- active CURATIONS sessions and sign-out controls;
- data export;
- account deactivation and deletion;
- explanation that normal sign-in discards the provider token; and
- separate disclosure for any future one-run Copilot authorization.

Normal identity sign-in does not import repositories, stars, followers, private
activity, organizations, or profile biography.

### 6.3 Notifications

- replies and mentions;
- maintainer review decisions;
- Project and Showcase revision updates;
- feedback invitations;
- followed category, Stack, or artifact updates;
- in-product only versus optional email; and
- per-thread mute controls.

### 6.4 Privacy and safety

- blocked members;
- muted threads;
- report history visible to the reporting member;
- public profile visibility;
- Showcases open for feedback;
- Roast participation defaults; and
- content and account deletion controls.

### 6.5 AI and execution

- hosted or public AI participation remains off by default;
- the optional first-class Showcase lane requires a separate, explicit local
  Copilot CLI breakdown step;
- optional hosted-agent preference remains separate per Project or Showcase;
- separate disclosure for hosted Azure AI versus the user's Copilot CLI;
- **Use My Copilot** and **Run in My Terminal** remain visibly separate; and
- no silent CURATIONS-funded fallback.

## 7. Inbox and messaging

### 7.1 Initial scope

Start with an Inbox, not unrestricted direct messages.

Inbox items include:

- replies;
- mentions;
- feedback invitations;
- maintainer review decisions;
- Project and Showcase revision updates;
- accepted or adapted outcome notices; and
- subscribed-thread updates.

Every reply remains anchored to a public Project or Showcase conversation. A
member can respond from the thread context rather than creating an unscoped
private channel.

### 7.2 Why direct messages wait

Traditional private DMs require a separate approval gate covering:

- spam and rate limits;
- blocking and reporting;
- harassment response;
- retention and deletion;
- legal and safety escalation;
- message-request controls;
- encryption and operator access; and
- moderation of private content.

Private direct messages remain out of the initial profile and Showcase pilot.
The Inbox still gives members the familiar, useful messaging experience without
prematurely creating a private social network.

## 8. PRD Showcase submission

### 8.1 Minimum public contract

A Showcase cannot publish without:

1. GitHub-authenticated CURATIONS identity;
2. pilot owner match between the signed-in GitHub login and the public repository
   containing the PRD;
3. one exact publicly readable PRD URL;
4. a source revision or freshness note;
5. confirmation that secrets, personal data, customer records, and confidential
   material were removed;
6. a builder-approved Copilot CLI purpose breakdown;
7. a plain-English discussion question;
8. review mode and optional Roast consent;
9. an exact public preview; and
10. maintainer review during the pilot.

For the thin pilot, require a commit-pinned Markdown PRD in a personal public
GitHub repository owned by the signed-in login. Collaborator authorization,
organization-owned PRDs, and other public document hosts remain later decisions
after freshness and consent rules are proven.

### 8.2 Self-promotion is allowed, but structured

CURATIONS should explicitly welcome builders sharing their own PRDs.

Allowed self-promotion includes:

- "Here is what I am planning";
- "Here is who it is for";
- "Here is the Stack I expect to use";
- "Here is the decision I want help with"; and
- "Here is what changed after discussion."

Not allowed:

- drive-by links without context;
- repeated promotional drops;
- fabricated users, outcomes, or evidence;
- paid placement hidden as community enthusiasm;
- engagement farming; or
- claims that an AI breakdown proves quality or feasibility.

The structured Showcase contract turns promotion into inspectable context rather
than banning builders from talking about their own work.

## 9. Required Copilot CLI purpose breakdown

### 9.1 Product boundary

The AI breakdown runs in the builder's own GitHub Copilot CLI session, with the
builder's tools, permissions, and billing.

This is a required authoring artifact for the optional first-class Showcase lane.
It is not automatic platform AI participation and does not change the default-off
rule for hosted or public agents.

CURATIONS:

- provides a versioned plain-text prompt;
- does not invent or require undocumented CLI flags;
- does not start the CLI;
- does not read the local repository or terminal;
- receives no transcript;
- receives only the final breakdown the builder chooses to paste or import; and
- treats the output as AI-assisted, builder-approved context, not evidence.

### 9.2 Required output contract

The versioned prompt asks Copilot CLI to return:

```text
PRD title:
Purpose in one sentence:
Problem:
Who it is for:
What the proposed product does:
Key decisions already made:
Important non-goals:
Stacks or tools explicitly named:
Open decisions:
Best first discussion question:
Source PRD URL:
Source revision:
```

The builder reviews and may edit every field before submission.

The public label reads:

```text
AI-ASSISTED PURPOSE BREAKDOWN
Generated in the author's GitHub Copilot CLI · reviewed and approved by the author
```

This is author-declared provenance. CURATIONS must not call it independently
verified merely because the format matches.

### 9.3 Provenance fields

Store only:

- prompt contract version;
- author-declared tool (`GitHub Copilot CLI`);
- generated-at timestamp supplied by the author;
- builder approval timestamp;
- source PRD URL and revision; and
- the approved structured breakdown.

Do not store the local transcript, shell history, hidden prompt, repository
contents, or unrelated CLI context.

## 10. Rubber Duck Roast

### 10.1 Consent

Roast is optional and off by default.

The author selects:

```text
[ ] Open this PRD to a Rubber Duck Roast
```

That checkbox permits structured critique of the public artifact. It does not
permit harassment, personal attacks, repository crawling, private investigation,
or unsolicited changes.

Inviting a hosted AI Rubber Duck is a second, separate control. Selecting Roast
mode alone never invokes an agent.

### 10.2 Roast contract

The full review lenses in `community/PRD-SHOWCASE.md` remain available. Roast is
an opt-in, structured pressure-test layered on top of that review contract.

Every Roast addresses the artifact, not the author:

1. **What holds up**
2. **What quacks**
3. **Biggest hidden assumption**
4. **Most expensive ambiguity**
5. **One falsification test**
6. **One question the author should answer next**

The tone may be playful and direct. It may not be humiliating, discriminatory,
threatening, or abusive.

### 10.3 Status treatment

Use the same brutalist rectangular status language already used for
`NEEDS FEEDBACK`, `BUILDING`, and related states.

```text
PRD SHOWCASE
OPEN FOR ROAST
🔥 ROASTED
```

- `PRD SHOWCASE` identifies the conversation type.
- `OPEN FOR ROAST` means the author currently consents to Roast participation.
- `🔥 ROASTED` appears only after at least one qualifying structured Roast is
  publicly posted.

The author may close Roast participation at any time. Closing it:

- removes `OPEN FOR ROAST`;
- prevents new Roast contributions;
- does not erase already published contributions;
- retains the historical `🔥 ROASTED` state while the Showcase remains public;
  and
- does not imply the author accepted any critique.

If the author withdraws the entire Showcase, its public visibility follows the
Showcase withdrawal and moderation-retention contract. An author cannot keep the
Showcase public while selectively erasing another member's otherwise lawful
contribution; they may report it for moderation.

`🔥 ROASTED` uses one approved complementary purple token alongside the existing
red system. It retains zero radius, opaque fill, hard borders, mono uppercase
type, and tested contrast.

The purple Roast state:

- is not a moderation warning;
- is not a quality grade;
- is not a popularity multiplier;
- does not imply the author accepted the critique; and
- may coexist with Project stage and feedback-state pills.

## 11. Board and discovery behavior

### 11.1 Shared homepage

Showcase conversations remain eligible for the existing homepage:

```text
[Active] [New] [Needs Feedback] [Recently Improved]
```

They display:

- human discussion question;
- PRD title;
- author identity;
- one-line purpose;
- linked Stack pills;
- `PRD SHOWCASE`;
- optional `OPEN FOR ROAST` or `🔥 ROASTED`;
- reply and participant counts; and
- AI disclosure only when an AI actually participated.

This keeps the community alive as one conversation graph.

The approved Community Pulse remains its three compact paths: Projects, Stacks,
and Community Library. Showcase is discovered through the primary Board
navigation, shared conversation feed, dedicated `/showcase/` master, and member
profiles rather than becoming a fourth Pulse directory.

### 11.2 Dedicated master

`/showcase/` uses the same Board shell:

```text
PRD SHOWCASE
Public product plans shared for discussion and accountable critique.

[Active] [New] [Open for Roast] [Roasted] [Recently Revised]

▲ "Does this onboarding explain the first useful outcome?"
  SIGNAL GARDEN · PRD SHOWCASE · 🔥 ROASTED
  A public workspace for turning open questions into testable plan revisions.
  Astro · TypeScript · GitHub Actions
```

The contextual right rail indexes:

- Project types or problem spaces;
- Stacks appearing in Showcases;
- review modes;
- open-for-Roast count;
- recently revised PRDs; and
- a clear **Share your PRD** action.

### 11.3 Sorting and votes

- Upvotes target the Showcase conversation, not the PRD's inherent quality.
- Active means recent conversation activity.
- New means Showcase publication time.
- Open for Roast is an explicit consent filter.
- Roasted means at least one qualifying structured Roast exists.
- Recently Revised requires a newer linked PRD revision after publication.
- Recently Revised is a source-freshness state only. It does not claim community
  feedback caused an improvement.
- Recently Improved remains the stronger causal state and applies only when the
  author links accepted or adapted feedback to the newer PRD revision.
- Every time-based aggregate states its timeframe and sample size.

## 12. Data implications

The plan introduces or extends:

- `Member`
- `MemberProfile`
- `MemberPreference`
- `PRDShowcase`
- `ShowcaseRevision`
- `ShowcaseBreakdown`
- `ShowcaseConversation`
- `RoastConsent`
- `RoastContribution`
- `Notification`
- `ThreadSubscription`
- `Block`
- `Report`

The pilot should not create a generic private `DirectMessage` record.

`PRDShowcase` stores source identity, approved display fields, revision state, and
moderation state. It does not copy the full PRD body by default.

## 13. Safety and failure modes

| Failure | Required response |
| --- | --- |
| Public URL later changes or disappears | Show stale or unavailable state; retain the last approved source identity without presenting it as current. |
| AI breakdown invents claims | Require builder review, source links, narrow labels, report/correction controls, and no "verified" language. |
| Author did not have permission | The pilot requires GitHub owner-login match; later collaborator or organization authorization needs a separate consent model. Report, hide, and audit any bypass or stale ownership state. |
| Roast becomes personal abuse | Artifact-only rules, report/block controls, rate limits, thread lock, and human moderation. |
| Roast checkbox is mistaken for agent consent | Separate Roast-mode consent from explicit AI invitation in UI and data. |
| Self-promotion becomes spam | Structured required context, rate limits, pending review, duplicate detection, and no paid boost. |
| Profile becomes a reputation score | No composite score, hidden profiling, follower race, or inferred expertise. |
| Inbox becomes private social surveillance | Content minimization, scoped notifications, clear retention, export, mute, and deletion behavior. |
| Copilot CLI handoff reads private material | The user controls local scope; CURATIONS provides text only and receives only the approved breakdown. |

## 14. Delivery sequence

### Gate 1 - Contract and fixture proof

1. Approve this plan.
2. Add the proposed Showcase and profile relationships to the governing Community
   PRD without weakening the Project loop.
3. Clarify in the governing AI boundary that the required local Copilot CLI
   breakdown is an explicit authoring action inside an optional lane, not hosted
   or automatic CURATIONS AI participation.
4. Build fixture-only:
   - public member profile;
   - private `/me/` dashboard;
   - settings shell;
   - inbox shell;
   - Showcase master;
   - Showcase detail/thread;
   - submission preview; and
   - Roast pills and states.
5. Make no database, repository, messaging, or model call.
6. Test desktop, narrow, signed-out, and signed-in comprehension.

### Gate 2 - Copilot CLI breakdown artifact

1. Publish a versioned plain-text prompt or Cookbook.
2. Let the builder copy it into their own Copilot CLI.
3. Accept pasted or imported structured output.
4. Validate the output shape without claiming provenance verification.
5. Require builder review and exact public preview.
6. Before any real Roast, implement the minimum safety controls:
   - report;
   - block;
   - thread mute and lock;
   - close-Roast consent;
   - per-member contribution limits;
   - maintainer hide/restore with a reason; and
   - a named human escalation owner.

### Gate 3 - Thin Showcase pilot

1. Confirm the minimum safety controls and named moderator work on fixtures.
2. One maintainer-controlled public PRD.
3. One invited builder without publication.
4. One approved public Showcase.
5. One human-only structured Roast.
6. Exercise consent closure, report, block, hide, and restore.
7. Expand to five invited Showcases.
8. Review abuse, comprehension, and falsification criteria.

### Gate 4 - Member persistence and Inbox

Expand the minimum pilot safety records with only the profile, preferences,
drafts, reviews, notifications, subscriptions, moderation history, and Inbox
state needed by the proven flow.

### Gate 5 - Optional AI Roast

Only after human Roast moderation works:

- evaluate a disclosed AI Rubber Duck on fictional fixtures;
- keep invitation separate and default-off;
- enforce source and scope limits;
- publish identity, model/provider, limits, and change log; and
- require human ownership of every outcome.

### Later - separately approved

- private direct messages;
- non-GitHub PRD hosts;
- organization-owned PRDs;
- profile following or mentoring;
- richer reputation or contribution summaries; and
- automatic conversion from Showcase to Project.

## 15. Smallest proof and success measures

The plan is disproved or must be redesigned if:

1. a builder cannot understand the difference between Showcase and Project;
2. a builder cannot reach an exact Showcase preview in five minutes;
3. a reader cannot explain the PRD's purpose after one row and detail page;
4. readers mistake the Copilot CLI breakdown for independent verification;
5. Roast participants target the author rather than the artifact;
6. a Roast or agent appears without explicit consent;
7. self-promotion overwhelms useful conversation;
8. a profile exposes private GitHub or messaging data;
9. the Inbox cannot remain useful without unrestricted DMs; or
10. a source revision cannot be traced or marked stale.

Pilot signals:

| Area | Signal |
| --- | --- |
| Showcase clarity | Readers distinguish PRD Showcase from full Project submission. |
| Purpose clarity | Readers explain the PRD's purpose after one row and detail page. |
| Promotion quality | Showcase entries include context and a real discussion question rather than a bare link. |
| Copilot boundary | Only builder-approved output is uploaded; no transcript or local repository data reaches CURATIONS. |
| Roast safety | Reviews remain artifact-focused and actionable, with no personal attacks. |
| Revision value | At least one Showcase links a later PRD revision or explicit no-change outcome. |
| Profile trust | Members understand which fields came from GitHub and which belong to CURATIONS. |
| Inbox utility | Members find replies, mentions, and review decisions without requiring DMs. |

## 16. Acceptance criteria

1. CURATIONS profiles are visibly distinct from external GitHub profiles.
2. GitHub identity uses stable user ID, minimal `read:user`, and discarded provider
   token.
3. A public profile includes a dedicated Showcases tab.
4. Private `/me/`, Inbox, and Settings routes never expose their contents to
   signed-out visitors.
5. The initial Inbox contains scoped notifications and thread replies, not private
   DMs.
6. A Showcase may exist without a full Project.
7. Every pilot Showcase has one exact public PRD URL in a personal repository
   owned by the signed-in GitHub login.
8. The pilot requires a commit-pinned public GitHub Markdown PRD.
9. Every Showcase includes a builder-approved Copilot CLI purpose breakdown.
10. The site provides a versioned prompt but never starts or controls the user's
    CLI.
11. CURATIONS receives no CLI transcript, shell history, or unapproved repository
    content.
12. AI-assisted breakdowns are labeled as author-declared, builder-approved
    context rather than verification.
13. Self-promotion is explicitly allowed through the structured Showcase contract.
14. Showcase conversations appear in the shared Active feed.
15. `/showcase/` provides a dedicated conversation-first master route.
16. Stack pills retain links to their Stack landing pages.
17. Roast is optional and off by default.
18. Roast-mode consent and hosted-agent invitation are separate controls.
19. `🔥 ROASTED` appears only after a qualifying structured Roast exists.
20. The Roast pill uses an accessible complementary purple token within the
    existing brutalist status system.
21. `🔥 ROASTED` is never presented as a quality, moderation, or popularity score.
22. Authors retain decision authority and record accepted, adapted, declined, or
    deferred outcomes.
23. Public text is rendered safely without raw HTML.
24. Fixture activity is labeled illustrative and fixture detail routes are
    noindex.
25. No persistence, repository read, message send, or model call occurs during the
    visual-proof gate.
26. The GitHub-native PRD Showcase remains a human-review fallback and is not
    automatically mirrored into CURATIONS.
27. Required local Copilot CLI breakdown does not invite or enable a hosted agent.
28. Report, block, close-Roast, rate-limit, lock, hide, and restore controls work
    before the first real Roast.
29. Closing Roast participation removes `OPEN FOR ROAST`, prevents new Roast
    contributions, and retains the historical `🔥 ROASTED` state while the
    Showcase remains public.

## 17. Recommended first visual slice

Build one fixture member named `@maya` with:

- one Project;
- one standalone PRD Showcase;
- one human feedback contribution;
- one explicit Stack follow;
- one Library contribution;
- one private draft;
- one Inbox notification; and
- one Showcase open to Rubber Duck Roast.

Render the same Showcase in:

1. the shared Active homepage;
2. `/showcase/`;
3. `/showcase/{slug}/`;
4. `/members/maya/`;
5. `/me/`; and
6. `/inbox/`.

This single fixture proves the connections among identity, self-promotion,
conversation, Roast consent, public source, and private member controls before
any backend work.
