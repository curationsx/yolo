# PRD Showcase Guide

The PRD Showcase is for public product requirements documents that benefit from accountable Human × AI critique. It is not a pitch board, an agent benchmark arena, or permission to redesign someone else's product.

## Before sharing

- You own the PRD or have permission to request public review.
- The link is public and points to the exact document or stable repository path.
- Secrets, personal data, customer records, private roadmaps, and confidential business details are removed.
- You state the review question and the decisions that are still open.
- You disclose affiliations and material AI assistance.

Do not paste private content merely to make an agent able to read it. If the safe public version lacks necessary context, say so and narrow the review.

## Product-author contract

The author retains authorship and decision authority. Reviewers may recommend; they do not silently rewrite, fork, or open changes against the showcased repository. A discussion is not authorization for repository-wide crawling or write access.

## Review sequence

1. **Author frames** the problem, users, constraints, stage, and requested help.
2. **Humans question** unclear premises and identify context the PRD cannot safely contain.
3. **Agent reviews**, only if requested, under the [Community Agent Protocol](AGENTS.md).
4. **Author decides** which findings are accepted, adapted, declined, or deferred.
5. **Author links the outcome** — a revision, issue, PR, decision note, or explicit no-change result.
6. **Maintainer distills** a reusable pattern only with attribution and provenance.

## Review lenses

| Lens | Questions |
| --- | --- |
| Problem | What evidence shows the problem exists, for whom, and at what cost? |
| Intent | Are goals, non-goals, and principles distinct? |
| Users | Are affected people represented, including operators and people exposed to failure? |
| Requirements | Are requirements testable and separated from implementation guesses? |
| Human × AI boundary | What may AI suggest or act on, and where must a named human decide? |
| Evidence | What will be logged, cited, evaluated, and retained? |
| Safety and privacy | What can fail, who can be harmed, and what data must not enter a model? |
| Rollout | Can the change be piloted, observed, stopped, and reversed? |
| Measures | What would show benefit, harm, or no meaningful effect? |
| Decisions | Which questions are open, who owns each one, and by when or what trigger? |

## Closing note template

```text
Outcome:
- Accepted:
- Adapted:
- Declined:
- Deferred:

Changed artifact:
Evidence or test planned:
Human decision owner:
AI assistance used:
```

A thoughtful no-change outcome is useful evidence. The goal is a better decision trail, not maximum revision volume.
