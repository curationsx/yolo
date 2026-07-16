# Community Discovery Architecture

**Status:** Approved product direction for draft PR #12  
**Approved:** 2026-07-16  
**Scope:** Community Pulse, Projects, Stacks, Community Library, taxonomy,
ranking, and voting semantics  
**Visual contract:** Reuse the conversation-first Lobsters Board and Project-row
subtitle pattern

## Purpose

The homepage Community Pulse should open three compact paths into the wider
community:

1. **What People Are Building** → Project discovery.
2. **Stacks Showing Up** → tool roles and stack combinations.
3. **Useful This Week** → reviews, skills, and Cookbooks.

These paths share one community graph and one Board design. They are not three
disconnected directories.

## Community Pulse

Each Community Pulse divider ends with a compact, explicit link:

```text
WHAT PEOPLE ARE BUILDING
CRM & operations                 18
Research assistants              12
Creative tools                    9
View all projects →

STACKS SHOWING UP
Supabase + Next.js               14
Cloudflare + Astro                8
Ollama + Obsidian                 7
View all stacks →

USEFUL THIS WEEK
Project-plan gap review      REVIEW
Schema-first planning         SKILL
Security pre-mortem        COOKBOOK
View all useful resources →
```

The homepage list remains a weekly snapshot. The View All pages provide the
complete taxonomy, time controls, and deeper feeds.

## 1. Projects — What People Are Building

### Master route

`/projects/`

```text
WHAT PEOPLE ARE BUILDING

[Active] [New] [Top] [Needs Feedback] [Recently Improved]

PROJECT TYPES
CRM & Operations · Research & Knowledge · Creative Tools
Commerce · Community & Events · Developer Tools · AI Assistants

▲ 31  “I’m building a CRM for independent venues. What am I missing?”
      Backstage · BUILDING · 18 replies
      A lightweight workspace for bookings, contacts, and follow-ups.
```

### Category route

Example: `/projects/crm-and-operations/`

```text
CRM & OPERATIONS
18 public projects · 42 active conversations

[Active] [New] [Top This Week] [Needs Feedback]
```

The feed uses the same homepage Project rows:

- a human feedback question as the headline;
- Project name, author, and stage;
- one plain-English sentence explaining what the Project does;
- stack tags;
- replies and participants;
- an AI tag only when an AI guide participated; and
- update time.

### Project taxonomy

Project discovery uses separate axes:

| Axis | Examples | Purpose |
| --- | --- | --- |
| **Project type** | CRM & Operations, Research & Knowledge, Creative Tools, Commerce, Community & Events, Developer Tools, AI Assistants | What is being built |
| **Attribute** | local-first, privacy-focused, open source, offline-capable | How it behaves or what it values |
| **Stage** | idea, building, needs feedback, shipped, recently improved | Where the Project is now |
| **Stack** | Next.js, Supabase, Cloudflare, Ollama | What supports it |

Do not mix these axes. For example:

- CRM is a Project type.
- Local-first is an attribute.
- Building is a stage.
- Supabase is a tool.

A Project has one primary Project type and may have multiple curated attributes,
stacks, and stages over time.

## 2. Stacks — What Tools Appear Together

### Master route

`/stacks/`

The Stacks master has two layers.

```text
BROWSE BY ROLE
Application Frameworks · Data & Storage · Hosting & Deployment
Automation · AI Models · Observability · Identity & Payments

COMMON COMBINATIONS
Supabase + Next.js
Cloudflare + Astro
Ollama + Obsidian
```

### Tool roles

| Role | Example tools |
| --- | --- |
| Application Frameworks | Next.js, Astro, Svelte |
| Data & Storage | Supabase, PostgreSQL, SQLite |
| Hosting & Deployment | Vercel, Cloudflare Pages, Azure Static Web Apps |
| Automation & Integration | n8n, GitHub Actions |
| AI Models & Runtimes | Ollama, hosted model providers |
| Observability & Evaluation | Langfuse, tracing and evaluation tools |
| Identity & Payments | GitHub OAuth, Stripe, identity providers |

A tool may serve more than one role, but its directory record identifies a
primary role for browsing.

### Stack combinations

`Supabase + Next.js` is a Stack combination, not a category.

Example route: `/stacks/supabase-nextjs/`

```text
SUPABASE + NEXT.JS
14 submitted projects · 31 conversations

[Active] [New] [Top] [Recently Improved]

▲ 31  “How should I structure permissions for a community CRM?”
      Backstage · Next.js · Supabase · Stripe
      Bookings, contacts, and follow-ups for small venue teams.
```

Combination pages remain conversation-first. They show Projects and questions
involving that Stack instead of presenting an abstract technology leaderboard.

## 3. Community Library — Useful Resources

### Master route

`/library/`

The homepage keeps the engaging title **Useful This Week**. Its View All link
opens the durable Community Library.

```text
COMMUNITY LIBRARY
Reviews, skills, and Cookbooks people are finding useful.

[All] [Reviews] [Skills] [Cookbooks]

[Week] [Month] [Year] [All Time]

▲ 42  Project-plan gap review
      Finds missing decisions, unclear users, and untested assumptions.
      REVIEW · tested with 12 public projects · updated 3d ago
```

Library rows include:

- artifact title;
- one plain-English sentence explaining its purpose;
- artifact type;
- exact version;
- source and license;
- last-reviewed date;
- supported stacks or Project types;
- useful/adapted outcome counts where explicitly reported; and
- discussion count.

## Voting and following

Not every object should receive an upvote.

| Object | Community action | Meaning |
| --- | --- | --- |
| Project conversation | **Upvote** | This conversation deserves more visibility |
| Review, skill, or Cookbook | **Upvote** | This resource was useful |
| Project category | **Follow** or **I’m building this** | I want updates or identify with this category |
| Tool or Stack combination | **Follow** | I want updates about Projects using this tool or combination |
| Individual Project | Activity comes from its conversations | Avoid turning Projects into a generic popularity contest |

Do not add category-level upvotes. An upvote on "CRM" cannot distinguish:

- interest in the category;
- personal use;
- desire for more content; or
- a quality judgment.

Category and Stack momentum should come from submitted Projects and real
discussion activity. Following is the clearer user action.

Example:

```text
CRM & OPERATIONS
18 projects · 6 added this month · 42 active conversations

[Follow category]
```

Popularity remains separate from quality.

## Sorting

Use transparent sort labels:

| Sort | Meaning |
| --- | --- |
| **Active** | Recent conversation activity |
| **New** | Submission time |
| **Top This Week** | Project-thread upvotes during the last seven days |
| **Needs Feedback** | Unresolved human feedback request |
| **Recently Improved** | A new plan revision followed community feedback |

"Trending" may appear in explanatory copy, but each actual sort states what it
measures.

Time windows display their scope:

- Week
- Month
- Year
- All Time

Every trend or aggregate view shows its timeframe and sample size.

## Shared Board shell

Projects, Stacks, Stack combinations, and Community Library pages reuse one
visual and structural shell:

```text
Breadcrumb
Title + plain-English subtitle
Tabs and time controls
Dense Lobsters feed
Contextual right rail
```

The right rail changes with the current lens:

| Page | Contextual right rail |
| --- | --- |
| Project category | Common Stacks, useful resources, related Project types |
| Stack role | Tools in the role, active combinations, recent Project questions |
| Stack combination | Projects using the combination, relevant skills, official sources |
| Community Library | Resource types, recent explicit outcomes, new contributors |

The shared shell preserves:

- dense text-first rows;
- score rails;
- plain-English subtitles;
- mono metadata;
- blue human identity;
- coral AI identity;
- zero-radius opaque surfaces;
- hard shadows with no blur; and
- the desktop right rail moving below content on narrow screens.

Do not introduce generic card grids or editorial-scale hero sections.

## Project identity and required GitHub backlinks

Every public Project must include a canonical, publicly readable GitHub
repository root URL. A Project cannot publish without it.

Project links have distinct jobs:

| Element | Destination |
| --- | --- |
| Human feedback question | Internal Project conversation and working-plan page |
| Project name, such as `Backstage` | Canonical public GitHub repository root |
| `Project plan` metadata | Exact public PRD or working-plan path when supplied |
| Letter-stamped Stack pill | Corresponding Stack landing page |

Whenever a Project name is linked to GitHub:

- render it in the Board's established red link color rather than black;
- use the same treatment in Project rows, category feeds, Stack feeds, profiles,
  and the Project-detail title;
- append an understated external-link cue where space permits;
- use `rel="noopener"` and an accessible label naming the destination; and
- never silently redirect the Project name to an unrelated internal route.

The question remains the entry into the community conversation. The red Project
name is the direct proof path back to the builder's public repository.

Fixture names such as `Backstage` are illustrative. Real records obtain their
name and repository URL from the builder-confirmed Project submission.

## Homepage conversation views

The homepage uses one conversation-feed region rather than rendering separate
Active and New lists on top of each other.

```text
[Active] [New] [Needs Feedback] [Recently Improved]

ACTIVE CONVERSATIONS
────────────────────────────────────────────────────
▲ Project conversation row
▲ Project conversation row
▲ Project conversation row
▲ Project conversation row
▲ Project conversation row
```

Behavior:

1. **Active** is the default server-rendered view.
2. The main feed uses the vertical space previously occupied by the separate
   **New This Week** section, allowing more Active conversations to appear.
3. Selecting **New** replaces the feed contents with New This Week Projects.
4. **Needs Feedback** and **Recently Improved** use the same region and row
   contract.
5. A view is never duplicated elsewhere on the homepage at the same time.
6. The selected view is reflected in the URL (for example `?view=new`) so it can
   be linked and restored.
7. Without client JavaScript, each tab remains a normal link that requests the
   chosen server-rendered view.
8. Loading and empty states preserve the feed's dimensions and plain-language
   explanation.

The right-side Community Pulse remains visible while tabs change the main feed.

## Data model implications

The discovery model requires distinct records:

- `Project`
- `ProjectCategory`
- `ProjectAttribute`
- `ProjectStage`
- `Tool`
- `ToolRole`
- `StackCombination`
- `Artifact` (`review | skill | cookbook`)
- `Conversation`
- `Vote`
- `Follow`
- `RecommendationOutcome`

Votes target conversations and useful artifacts. Follows target categories,
tools, and Stack combinations.

The homepage Community Pulse is a read model derived from these records. It is
not a separately curated source of truth.

`Project` includes a required canonical public GitHub repository URL and an
optional exact public working-plan URL. `Conversation` views are queryable by
the homepage view states defined above.

## Delivery order

1. Add three compact View All links to the local Community Pulse.
2. Build fixture-only `/projects/`, `/stacks/`, and `/library/` master pages.
3. Add one fixture Project category page.
4. Add one fixture Stack-combination page.
5. Reuse the homepage Project row and subtitle pattern everywhere.
6. Make Project names consistently backlink to their public GitHub repositories.
7. Consolidate homepage conversations into one tab-controlled feed with Active
   as the default.
8. Review the full click path at desktop and narrow viewports.
9. Lock taxonomy and action meanings before connecting votes, follows, or live
   data.
10. Connect real data only after the visual and semantic model receives human
   approval.

## Acceptance checks

1. Every Community Pulse section has one clear View All destination.
2. A visitor can distinguish Project type, attribute, stage, tool, and Stack
   combination without reading methodology documentation.
3. Category and Stack pages remain conversation-first.
4. No category receives an ambiguous upvote action.
5. Library time controls explain the wider meaning behind Useful This Week.
6. Every feed row retains a human headline and plain-English subtitle.
7. Sorting labels state what they measure.
8. Trend displays include timeframe and sample size.
9. The three master pages visibly belong to the same product.
10. No new route replaces the approved Board with a generic card directory.
11. Every published Project name links in red to its canonical public GitHub
    repository.
12. Stack pills link to their corresponding Stack landing pages.
13. The homepage renders one conversation feed, with Active as its default
    server-rendered state.
14. Selecting New, Needs Feedback, or Recently Improved replaces that feed
    instead of adding another static section.
