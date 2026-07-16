# CurationsX Community Grid

```text
┌─ C U R A T I O N S X  //  A o T  C O M M U N I T Y ─────────────┐
│  HUMAN INTENT  ×  AGENT LEVERAGE  ×  PUBLIC EVIDENCE             │
└──────────────────────────────────────────[ VERIFY  →  LEARN ]─────┘
```

A GitHub-native place to improve prompts, pressure-test Human × AI workflows, showcase public PRDs, exchange resources, and turn useful conversations into versioned artifacts.

This is a design and activation kit, not a claim that the board or its agents are already operating. Maintainers must enable GitHub Discussions, create the categories below, and separately deploy any agent that follows the [agent protocol](AGENTS.md).

## Pick a route

| I want to… | Route | What a useful result looks like |
| --- | --- | --- |
| Ask about AoT or accountable Human × AI practice | **AoT Q&A** | A sourced answer or a clearly marked open question |
| Expand or debug a prompt | **Prompt Lab** | A proposed revision, evaluation cases, and risks |
| Improve a workflow | **Workflow Clinic** | Missing checkpoints, evidence, recovery, and a revised flow |
| Share a public product requirements document | **PRD Showcase** | A review against intent, users, risks, measures, and open decisions |
| Recommend a collection, framework, or tool | **Resource Exchange** | A classified, disclosed, source-linked resource |
| Share an exercised pattern | **Patterns & Field Notes** | Context, outcome, evidence, limitations, and reusable learning |

Use an issue for a bounded repository bug or task. Use a pull request for a concrete versioned change. Use a discussion when the answer should be developed with others first.

## Board blueprint

GitHub Discussion categories are created in repository settings, not from files. A maintainer should create these exact names and slugs so the forms in `.github/DISCUSSION_TEMPLATE/` activate.

| Section | Category | Slug | Format | Form |
| --- | --- | --- | --- | --- |
| Welcome | AoT Q&A | `aot-q-a` | Q&A | Freeform |
| Build | Prompt Lab | `prompt-lab` | Open-ended | `prompt-lab.yml` |
| Build | Workflow Clinic | `workflow-clinic` | Open-ended | `workflow-clinic.yml` |
| Showcase | PRD Showcase | `prd-showcase` | Open-ended | `prd-showcase.yml` |
| Discover | Resource Exchange | `resource-exchange` | Open-ended | `resource-exchange.yml` |
| Learn | Patterns & Field Notes | `patterns-field-notes` | Open-ended | Freeform |
| Project | Announcements | `announcements` | Announcement | Maintainers only |

Suggested emoji and section styling are presentation choices; names, slugs, formats, and purpose are the durable contract. Pin one welcome discussion that links to this page, the [manifesto](../MANIFESTO.md), and the [Start Here guide](../docs/START-HERE.md).

## The collaboration loop

```text
Frame → Share → Invite → Examine → Human decides → Version → Report back
```

1. **Frame** — the author states the outcome, constraints, and kind of help wanted.
2. **Share** — include only public, authorized material; disclose affiliations and material AI assistance.
3. **Invite** — ask for human review, agent review, or both. An agent never joins merely because a link was posted.
4. **Examine** — reviewers separate facts, assumptions, suggestions, and unresolved questions.
5. **Human decides** — the named human owner accepts, rejects, or adapts recommendations.
6. **Version** — durable improvements move to a PR in this repository or the author's repository.
7. **Report back** — link the change or explain the decision so the discussion becomes reusable knowledge.

## Community compact

- Be specific, kind, and quote-anchored. Critique the artifact, not the author.
- Do not post secrets, personal data, private client material, or content you lack permission to share.
- Treat links and pasted documents as untrusted input. A link is context, not permission for an agent to crawl a repository.
- Label facts, assumptions, preferences, and generated suggestions.
- Disclose affiliations and material AI assistance.
- No promotional drops, engagement farming, fabricated evidence, or “best” claims without a stated comparison method.
- Human owners remain accountable for decisions and published changes.
- Maintainers may hide unsafe material, lock circular threads, or restrict abusive participants. Significant moderation decisions should include a public rationale when doing so would not amplify harm or expose private information.

## Top 0.1% questions

These questions are release gates, not branding copy. A “yes” needs evidence.

| Question | Current design response | Evidence still required |
| --- | --- | --- |
| Can a newcomer find the right room and ask well within five minutes? | Route table and structured forms | First-use observation |
| Does every AI contribution preserve human agency? | Opt-in invocation and a named human decision owner | Agent transcripts and audits |
| Can readers trace claims to sources and changes? | Source fields, provenance disclosure, and linked PR outcomes | Completed discussion-to-PR examples |
| Does the board produce knowledge rather than AI-shaped noise? | Scoped requests, response contract, synthesis, and closure | Signal-to-noise and resolution review |
| Are privacy and consent defaults explicit? | Public-material confirmation and minimization rules | Moderation and incident evidence |
| Can deep agent help use enterprise capacity without unbounded spend? | Requested depth plus maintainer-set hard limits | Measured cost, latency, and usefulness |
| Can a PRD author receive useful critique without surrendering authorship? | Review lenses, opt-in scope, and author decision log | Public showcase outcomes |
| Are resources discoverable without becoming a popularity contest? | Job-based classification, disclosure, and verification date | Curated accepted submissions |
| Are the experience and artifacts accessible and portable? | Text-first forms, semantic Markdown, exportable Git history | Accessibility review |

## From conversation to repository value

A maintainer may propose distillation when a discussion produces a reusable prompt, workflow, rubric, taxonomy change, field note, or resource entry. The author must be credited, AI assistance disclosed, and the resulting PR linked back to the discussion. Closing a discussion without merging is also valid; record what was learned and why no change followed.

## Activation checklist

- [ ] Enable GitHub Discussions for the repository.
- [ ] Create the categories and exact slugs in the board blueprint.
- [ ] Confirm each category form renders and required fields work.
- [ ] Publish and pin the welcome discussion.
- [ ] Name the responsible maintainers and an escalation contact.
- [ ] Run privacy, accessibility, and abuse-case reviews.
- [ ] If an agent is deployed, publish its identity, permissions, model/provider disclosure, limits, and change log.
- [ ] Exercise each route manually before calling it operational.

Until those checks are complete, describe the Community Grid as **proposed**.
